import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { PeriodoOperacao } from '../../types/database';

// Esquema de fim de semana: por equipe e por dia trabalham 2 pessoas, sem
// formulário de disponibilidade — quem trabalha sai do histórico.
//   - Dupla A: Manhã + Tarde
//   - Dupla B: Tarde + Noite
// Prioridade para quem MAIS trabalhou fins de semana (dias trabalhados em
// escalas confirmadas, sem contar faltas). Cada pessoa trabalha no máximo
// 1 dia por fim de semana e, opcionalmente, um máximo de fins de semana no mês.
//
// As escalas continuam sendo linhas normais de `escalas` (uma por turno), então
// histórico, assiduidade, trocas e comissionamento seguem funcionando iguais.

interface ColaboradorParaGeracao {
  id: string;
  nome_completo: string;
  equipe_id: string | null;
  turno_semana_id: string | null;
}

interface TurnoParaGeracao {
  id: string;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
  ordem_exibicao: number | null;
}

type Dupla = 'A' | 'B';

interface LinhaEscala {
  colaborador_id: string;
  periodo_id: string;
  data: string;
  turno_id: string;
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

export function useGerarEscalaMensal() {
  const [gerando, setGerando] = useState(false);

  // Preenche as duplas ainda vazias dos períodos informados (em ordem de
  // data), sem mexer no que já está escalado.
  async function distribuir({
    periodos,
    periodosDoMes,
    adminId,
    colaboradores,
    turnos,
    maxFinsDeSemanaNoMes,
  }: {
    periodos: PeriodoOperacao[];
    periodosDoMes: PeriodoOperacao[];
    adminId: string;
    colaboradores: ColaboradorParaGeracao[];
    turnos: TurnoParaGeracao[];
    maxFinsDeSemanaNoMes: number | null;
  }): Promise<{ erro: string | null; adicionadas: number; duplasSemGente: number }> {
    const ordenados = [...turnos].sort(
      (a, b) => (a.ordem_exibicao ?? 999) - (b.ordem_exibicao ?? 999)
    );
    if (ordenados.length < 3) {
      return {
        erro: 'São necessários 3 turnos ativos (Manhã, Tarde e Noite) para gerar a escala.',
        adicionadas: 0,
        duplasSemGente: 0,
      };
    }
    const [manha, tarde, noite] = ordenados;
    const turnosDaDupla: Record<Dupla, TurnoParaGeracao[]> = {
      A: [manha, tarde],
      B: [tarde, noite],
    };
    // O turno que identifica a dupla (Tarde é compartilhada pelas duas).
    const turnoMarcador: Record<Dupla, TurnoParaGeracao> = { A: manha, B: noite };

    // Histórico: dias de fim de semana trabalhados em escalas confirmadas,
    // ignorando faltas (compareceu = false). Paginado, porque o Supabase
    // devolve no máximo 1000 linhas por consulta.
    const historico: {
      colaborador_id: string;
      data: string;
      turno_id: string;
      compareceu: boolean | null;
      periodos_operacao: unknown;
    }[] = [];
    const TAMANHO_PAGINA = 1000;
    for (let inicio = 0; ; inicio += TAMANHO_PAGINA) {
      const { data: pagina, error: erroHistorico } = await supabase
        .from('escalas')
        .select('colaborador_id, data, turno_id, compareceu, periodos_operacao!inner(data_inicio, status)')
        .in('periodos_operacao.status', ['confirmado', 'encerrado'])
        .order('id')
        .range(inicio, inicio + TAMANHO_PAGINA - 1);

      if (erroHistorico) {
        return { erro: 'Não foi possível carregar o histórico de escalas.', adicionadas: 0, duplasSemGente: 0 };
      }
      historico.push(...(pagina ?? []));
      if ((pagina ?? []).length < TAMANHO_PAGINA) break;
    }

    const diasTrabalhados = new Map<string, Set<string>>();
    const preferenciaDia = new Map<string, number>(); // `${colab}|sab` / `${colab}|dom`
    const preferenciaTurno = new Map<string, number>(); // `${colab}|${turno}`

    function somar(mapa: Map<string, number>, chave: string) {
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }

    for (const e of historico) {
      if (e.compareceu === false) continue;
      const periodo = e.periodos_operacao as unknown as { data_inicio: string };
      const dias = diasTrabalhados.get(e.colaborador_id) ?? new Set<string>();
      if (!dias.has(e.data)) {
        dias.add(e.data);
        somar(preferenciaDia, `${e.colaborador_id}|${e.data === periodo.data_inicio ? 'sab' : 'dom'}`);
      }
      diasTrabalhados.set(e.colaborador_id, dias);
      somar(preferenciaTurno, `${e.colaborador_id}|${e.turno_id}`);
    }

    function pontuacao(colaboradorId: string) {
      return diasTrabalhados.get(colaboradorId)?.size ?? 0;
    }

    // Escalas já existentes nos fins de semana do mês: contam para o limite
    // mensal, para o "1 dia por fim de semana" e para as duplas já ocupadas.
    const idsDoMes = periodosDoMes.map((p) => p.id);
    const { data: existentes, error: erroExistentes } = idsDoMes.length
      ? await supabase
          .from('escalas')
          .select('colaborador_id, periodo_id, data, turno_id')
          .in('periodo_id', idsDoMes)
      : { data: [], error: null };

    if (erroExistentes) {
      return { erro: 'Não foi possível carregar as escalas do mês.', adicionadas: 0, duplasSemGente: 0 };
    }

    const finsDeSemanaPorColaborador = new Map<string, Set<string>>();
    const escaladoNoPeriodo = new Set<string>(); // `${periodo}|${colab}`
    const turnosOcupados = new Set<string>(); // `${data}|${turno}|${colab}`

    function registrar(e: LinhaEscala) {
      const fins = finsDeSemanaPorColaborador.get(e.colaborador_id) ?? new Set<string>();
      fins.add(e.periodo_id);
      finsDeSemanaPorColaborador.set(e.colaborador_id, fins);
      escaladoNoPeriodo.add(`${e.periodo_id}|${e.colaborador_id}`);
      turnosOcupados.add(`${e.data}|${e.turno_id}|${e.colaborador_id}`);
    }

    for (const e of existentes ?? []) registrar(e);

    const equipeIds = Array.from(
      new Set(colaboradores.map((c) => c.equipe_id).filter((id): id is string => !!id))
    );

    const novasLinhas: (LinhaEscala & { created_by: string })[] = [];
    let duplasSemGente = 0;

    const periodosEmOrdem = [...periodos].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

    for (const periodo of periodosEmOrdem) {
      const dias = [
        { data: periodo.data_inicio, chave: 'sab' as const },
        { data: periodo.data_fim, chave: 'dom' as const },
      ];

      for (const equipeId of equipeIds) {
        const membros = colaboradores.filter((c) => c.equipe_id === equipeId);

        function duplaOcupada(data: string, dupla: Dupla) {
          const marcador = turnoMarcador[dupla].id;
          return membros.some((m) => turnosOcupados.has(`${data}|${marcador}|${m.id}`));
        }

        // Duplas vazias deste fim de semana, só nos dias em que o turno
        // marcador da dupla funciona.
        const vagas: { data: string; chave: 'sab' | 'dom'; dupla: Dupla }[] = [];
        for (const dia of dias) {
          for (const dupla of ['A', 'B'] as Dupla[]) {
            const marcador = turnoMarcador[dupla];
            const funciona = dia.chave === 'sab' ? marcador.ativo_sabado : marcador.ativo_domingo;
            if (funciona && !duplaOcupada(dia.data, dupla)) vagas.push({ ...dia, dupla });
          }
        }
        if (vagas.length === 0) continue;

        // Candidatos: ainda não trabalham neste fim de semana e não
        // passaram do limite do mês. Quem mais trabalhou vem primeiro.
        const candidatos = membros
          .filter((m) => !escaladoNoPeriodo.has(`${periodo.id}|${m.id}`))
          .filter(
            (m) =>
              maxFinsDeSemanaNoMes === null ||
              (finsDeSemanaPorColaborador.get(m.id)?.size ?? 0) < maxFinsDeSemanaNoMes
          )
          .sort(
            (a, b) =>
              pontuacao(b.id) - pontuacao(a.id) || a.nome_completo.localeCompare(b.nome_completo)
          );

        const escolhidos = candidatos.slice(0, vagas.length);
        duplasSemGente += vagas.length - escolhidos.length;

        // Distribui os escolhidos entre as vagas pela afinidade: dupla do
        // turno da semana, dupla que mais fez e dia em que mais vem.
        function afinidade(c: ColaboradorParaGeracao, vaga: (typeof vagas)[number]) {
          const marcador = turnoMarcador[vaga.dupla].id;
          return (
            (c.turno_semana_id === marcador ? 1000 : 0) +
            (preferenciaTurno.get(`${c.id}|${marcador}`) ?? 0) * 10 +
            (preferenciaDia.get(`${c.id}|${vaga.chave}`) ?? 0)
          );
        }

        const restantes = [...escolhidos];
        const vagasRestantes = [...vagas];
        while (restantes.length > 0 && vagasRestantes.length > 0) {
          let melhor = { colaborador: 0, vaga: 0, valor: -1 };
          restantes.forEach((c, i) => {
            vagasRestantes.forEach((v, j) => {
              const valor = afinidade(c, v);
              if (valor > melhor.valor) melhor = { colaborador: i, vaga: j, valor };
            });
          });

          const colaborador = restantes.splice(melhor.colaborador, 1)[0];
          const vaga = vagasRestantes.splice(melhor.vaga, 1)[0];

          for (const turno of turnosDaDupla[vaga.dupla]) {
            const funciona = vaga.chave === 'sab' ? turno.ativo_sabado : turno.ativo_domingo;
            if (!funciona || turnosOcupados.has(`${vaga.data}|${turno.id}|${colaborador.id}`)) continue;
            const linha = {
              colaborador_id: colaborador.id,
              periodo_id: periodo.id,
              data: vaga.data,
              turno_id: turno.id,
            };
            registrar(linha);
            novasLinhas.push({ ...linha, created_by: adminId });
          }
        }
      }
    }

    if (novasLinhas.length > 0) {
      const { error } = await supabase.from('escalas').insert(novasLinhas);
      if (error) {
        return {
          erro: 'Não foi possível salvar a escala gerada. Tente novamente.',
          adicionadas: 0,
          duplasSemGente: 0,
        };
      }
    }

    return { erro: null, adicionadas: novasLinhas.length, duplasSemGente };
  }

  // Cria (se ainda não existirem) os períodos de todos os fins de semana do
  // mês, já "em organização", e preenche as duplas. Fins de semana já
  // confirmados ou que já passaram não são alterados.
  async function gerarMes({
    ano,
    mes,
    adminId,
    colaboradores,
    turnos,
    maxFinsDeSemanaNoMes,
  }: {
    ano: number;
    mes: number;
    adminId: string;
    colaboradores: ColaboradorParaGeracao[];
    turnos: TurnoParaGeracao[];
    maxFinsDeSemanaNoMes: number | null;
  }) {
    setGerando(true);
    try {
      const fins = finsDeSemanaDoMes(ano, mes);
      const hoje = hojeIso();

      const { data: existentes, error: erroPeriodos } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim, status')
        .in('data_inicio', fins.map((f) => f.sabado));

      if (erroPeriodos) {
        return { erro: 'Não foi possível carregar os fins de semana do mês.', adicionadas: 0, duplasSemGente: 0, finsDeSemana: 0, primeiroPeriodoId: null };
      }

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

        if (erroCriacao) {
          return { erro: 'Não foi possível criar os fins de semana do mês.', adicionadas: 0, duplasSemGente: 0, finsDeSemana: 0, primeiroPeriodoId: null };
        }
        periodosDoMes.push(...(criados ?? []));
      }

      // Período ainda "aberto" (do esquema antigo) passa a "em organização".
      const abertos = periodosDoMes.filter((p) => p.status === 'aberto' && p.data_fim >= hoje);
      if (abertos.length > 0) {
        const { error } = await supabase
          .from('periodos_operacao')
          .update({ status: 'em_organizacao' })
          .in('id', abertos.map((p) => p.id));
        if (error) {
          return { erro: 'Não foi possível atualizar os fins de semana do mês.', adicionadas: 0, duplasSemGente: 0, finsDeSemana: 0, primeiroPeriodoId: null };
        }
        for (const p of abertos) p.status = 'em_organizacao';
      }

      const aPreencher = periodosDoMes.filter(
        (p) => p.status === 'em_organizacao' && p.data_fim >= hoje
      );

      const resultado = await distribuir({
        periodos: aPreencher,
        periodosDoMes,
        adminId,
        colaboradores,
        turnos,
        maxFinsDeSemanaNoMes,
      });

      const primeiroPeriodoId =
        [...aPreencher].sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))[0]?.id ?? null;

      return { ...resultado, finsDeSemana: aPreencher.length, primeiroPeriodoId };
    } finally {
      setGerando(false);
    }
  }

  // Preenche as duplas vazias de um único fim de semana (ex.: depois de o
  // admin tirar alguém), respeitando o limite mensal do mês do sábado.
  async function gerarFimDeSemana({
    periodo,
    adminId,
    colaboradores,
    turnos,
    maxFinsDeSemanaNoMes,
  }: {
    periodo: PeriodoOperacao;
    adminId: string;
    colaboradores: ColaboradorParaGeracao[];
    turnos: TurnoParaGeracao[];
    maxFinsDeSemanaNoMes: number | null;
  }) {
    setGerando(true);
    try {
      const [ano, mes] = periodo.data_inicio.split('-').map(Number);
      const sabados = finsDeSemanaDoMes(ano, mes).map((f) => f.sabado);

      const { data: periodosDoMes, error } = await supabase
        .from('periodos_operacao')
        .select('id, data_inicio, data_fim, status')
        .in('data_inicio', sabados);

      if (error) {
        return { erro: 'Não foi possível carregar os fins de semana do mês.', adicionadas: 0, duplasSemGente: 0 };
      }

      return await distribuir({
        periodos: [periodo],
        periodosDoMes: periodosDoMes ?? [periodo],
        adminId,
        colaboradores,
        turnos,
        maxFinsDeSemanaNoMes,
      });
    } finally {
      setGerando(false);
    }
  }

  return { gerarMes, gerarFimDeSemana, gerando };
}
