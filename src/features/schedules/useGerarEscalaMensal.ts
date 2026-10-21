import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { papelDaDupla } from '../../lib/rodizioDuplas';
import type { PeriodoOperacao } from '../../types/database';

// Escala do fim de semana pelas duplas fixas de cada equipe (tabela
// duplas_fim_de_semana). A cada fim de semana, uma dupla trabalha no
// sábado, outra no domingo (home office) e a terceira folga, girando no
// ciclo Sábado → Domingo → Folga (ver lib/rodizioDuplas). Na dupla, uma
// pessoa faz Manhã + Tarde e a outra Tarde + Noite.
//
// As escalas continuam sendo linhas normais de `escalas` (uma por turno), então
// histórico, assiduidade, trocas e comissionamento seguem funcionando iguais.

interface ColaboradorParaGeracao {
  id: string;
  equipe_id: string | null;
  equipe_nome: string | null;
}

interface TurnoParaGeracao {
  id: string;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
  ordem_exibicao: number | null;
}

interface Dupla {
  equipe_id: string;
  numero: number;
  manha_tarde_id: string | null;
  tarde_noite_id: string | null;
}

interface ResultadoDistribuicao {
  erro: string | null;
  adicionadas: number;
  // Posições de dupla sem pessoa ativa (dupla incompleta ou pessoa desativada).
  posicoesVazias: number;
  equipesSemDuplas: string[];
}

function paraIso(data: Date) {
  const ano = data.getUTCFullYear();
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function hojeIso() {
  const agora = new Date();
  return paraIso(new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())));
}

// Fins de semana do mês: todo sábado do mês (o domingo seguinte pode cair no
// mês seguinte — o fim de semana pertence ao mês do sábado).
export function finsDeSemanaDoMes(ano: number, mes: number) {
  const fins: { sabado: string; domingo: string }[] = [];
  const data = new Date(Date.UTC(ano, mes - 1, 1));
  while (data.getUTCDay() !== 6) data.setUTCDate(data.getUTCDate() + 1);
  while (data.getUTCMonth() === mes - 1) {
    const domingo = new Date(data);
    domingo.setUTCDate(domingo.getUTCDate() + 1);
    fins.push({ sabado: paraIso(data), domingo: paraIso(domingo) });
    data.setUTCDate(data.getUTCDate() + 7);
  }
  return fins;
}

const SEM_RESULTADO = { adicionadas: 0, posicoesVazias: 0, equipesSemDuplas: [] as string[] };

export function useGerarEscalaMensal() {
  const [gerando, setGerando] = useState(false);

  // Preenche os fins de semana informados pelas duplas, sem mexer no que já
  // está escalado.
  async function distribuir({
    periodos,
    adminId,
    colaboradores,
    turnos,
  }: {
    periodos: PeriodoOperacao[];
    adminId: string;
    colaboradores: ColaboradorParaGeracao[];
    turnos: TurnoParaGeracao[];
  }): Promise<ResultadoDistribuicao> {
    const ordenados = [...turnos].sort(
      (a, b) => (a.ordem_exibicao ?? 999) - (b.ordem_exibicao ?? 999)
    );
    if (ordenados.length < 3) {
      return {
        erro: 'São necessários 3 turnos ativos (Manhã, Tarde e Noite) para gerar a escala.',
        ...SEM_RESULTADO,
      };
    }
    const [manha, tarde, noite] = ordenados;

    const { data: duplasData, error: erroDuplas } = await supabase
      .from('duplas_fim_de_semana')
      .select('equipe_id, numero, manha_tarde_id, tarde_noite_id');

    if (erroDuplas) {
      return { erro: 'Não foi possível carregar as duplas das equipes.', ...SEM_RESULTADO };
    }
    const duplas: Dupla[] = duplasData ?? [];

    const ids = periodos.map((p) => p.id);
    const { data: existentes, error: erroExistentes } = ids.length
      ? await supabase
          .from('escalas')
          .select('colaborador_id, data, turno_id')
          .in('periodo_id', ids)
      : { data: [], error: null };

    if (erroExistentes) {
      return { erro: 'Não foi possível carregar as escalas do mês.', ...SEM_RESULTADO };
    }

    const turnosOcupados = new Set(
      (existentes ?? []).map((e) => `${e.data}|${e.turno_id}|${e.colaborador_id}`)
    );
    const ativos = new Map(colaboradores.map((c) => [c.id, c]));

    const equipes = new Map<string, string>();
    for (const c of colaboradores) {
      if (c.equipe_id) equipes.set(c.equipe_id, c.equipe_nome ?? 'Equipe');
    }
    const equipesSemDuplas = [...equipes]
      .filter(([id]) => !duplas.some((d) => d.equipe_id === id))
      .map(([, nome]) => nome)
      .sort();

    const novasLinhas: {
      colaborador_id: string;
      periodo_id: string;
      data: string;
      turno_id: string;
      created_by: string;
    }[] = [];
    let posicoesVazias = 0;

    for (const periodo of periodos) {
      for (const dupla of duplas) {
        if (!equipes.has(dupla.equipe_id)) continue;

        const papel = papelDaDupla(dupla.numero, periodo.data_inicio);
        if (papel === 'folga') continue;

        const ehSabado = papel === 'sabado';
        const data = ehSabado ? periodo.data_inicio : periodo.data_fim;
        const membros = colaboradores.filter((c) => c.equipe_id === dupla.equipe_id);

        const posicoes = [
          { pessoaId: dupla.manha_tarde_id, marcador: manha, turnosDaPosicao: [manha, tarde] },
          { pessoaId: dupla.tarde_noite_id, marcador: noite, turnosDaPosicao: [tarde, noite] },
        ];

        for (const { pessoaId, marcador, turnosDaPosicao } of posicoes) {
          if (!(ehSabado ? marcador.ativo_sabado : marcador.ativo_domingo)) continue;

          // Posição já coberta por alguém da equipe (ex.: ajuste manual).
          if (membros.some((m) => turnosOcupados.has(`${data}|${marcador.id}|${m.id}`))) continue;

          const pessoa = pessoaId ? ativos.get(pessoaId) : undefined;
          if (!pessoa) {
            posicoesVazias++;
            continue;
          }

          for (const turno of turnosDaPosicao) {
            if (!(ehSabado ? turno.ativo_sabado : turno.ativo_domingo)) continue;
            const chave = `${data}|${turno.id}|${pessoa.id}`;
            if (turnosOcupados.has(chave)) continue;
            turnosOcupados.add(chave);
            novasLinhas.push({
              colaborador_id: pessoa.id,
              periodo_id: periodo.id,
              data,
              turno_id: turno.id,
              created_by: adminId,
            });
          }
        }
      }
    }

    if (novasLinhas.length > 0) {
      const { error } = await supabase.from('escalas').insert(novasLinhas);
      if (error) {
        return { erro: 'Não foi possível salvar a escala gerada. Tente novamente.', ...SEM_RESULTADO };
      }
    }

    return { erro: null, adicionadas: novasLinhas.length, posicoesVazias, equipesSemDuplas };
  }

  // Cria (se ainda não existirem) os períodos de todos os fins de semana do
  // mês, já "em organização", e preenche pelas duplas. Fins de semana já
  // confirmados ou que já passaram não são alterados.
  async function gerarMes({
    ano,
    mes,
    adminId,
    colaboradores,
    turnos,
  }: {
    ano: number;
    mes: number;
    adminId: string;
    colaboradores: ColaboradorParaGeracao[];
    turnos: TurnoParaGeracao[];
  }) {
    setGerando(true);
    try {
      const fins = finsDeSemanaDoMes(ano, mes);
      const hoje = hojeIso();
      const falha = (erro: string) => ({
        erro,
        ...SEM_RESULTADO,
        finsDeSemana: 0,
        primeiroPeriodoId: null,
      });

      const { data: existentes, error: erroPeriodos } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim, status')
        .in('data_inicio', fins.map((f) => f.sabado));

      if (erroPeriodos) return falha('Não foi possível carregar os fins de semana do mês.');

      const periodosDoMes: PeriodoOperacao[] = [...(existentes ?? [])];
      const aCriar = fins.filter(
        (f) => f.domingo >= hoje && !periodosDoMes.some((p) => p.data_inicio === f.sabado)
      );

      if (aCriar.length > 0) {
        const { data: criados, error: erroCriacao } = await supabase
          .from('periodos_operacao')
          .insert(
            aCriar.map((f) => ({
              data_inicio: f.sabado,
              data_fim: f.domingo,
              status: 'em_organizacao',
              created_by: adminId,
            }))
          )
          .select('id, data_inicio, data_fim, status');

        if (erroCriacao) return falha('Não foi possível criar os fins de semana do mês.');
        periodosDoMes.push(...(criados ?? []));
      }

      // Período ainda "aberto" (do esquema antigo) passa a "em organização".
      const abertos = periodosDoMes.filter((p) => p.status === 'aberto' && p.data_fim >= hoje);
      if (abertos.length > 0) {
        const { error } = await supabase
          .from('periodos_operacao')
          .update({ status: 'em_organizacao' })
          .in('id', abertos.map((p) => p.id));
        if (error) return falha('Não foi possível atualizar os fins de semana do mês.');
        for (const p of abertos) p.status = 'em_organizacao';
      }

      const aPreencher = periodosDoMes
        .filter((p) => p.status === 'em_organizacao' && p.data_fim >= hoje)
        .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

      const resultado = await distribuir({ periodos: aPreencher, adminId, colaboradores, turnos });

      return {
        ...resultado,
        finsDeSemana: aPreencher.length,
        primeiroPeriodoId: aPreencher[0]?.id ?? null,
      };
    } finally {
      setGerando(false);
    }
  }

  // Preenche um único fim de semana pelas duplas (ex.: depois de excluir a
  // escala para remontar).
  async function gerarFimDeSemana({
    periodo,
    adminId,
    colaboradores,
    turnos,
  }: {
    periodo: PeriodoOperacao;
    adminId: string;
    colaboradores: ColaboradorParaGeracao[];
    turnos: TurnoParaGeracao[];
  }) {
    setGerando(true);
    try {
      return await distribuir({ periodos: [periodo], adminId, colaboradores, turnos });
    } finally {
      setGerando(false);
    }
  }

  return { gerarMes, gerarFimDeSemana, gerando };
}
