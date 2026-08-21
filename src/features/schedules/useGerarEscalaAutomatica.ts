import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { PeriodoOperacao } from '../../types/database';

interface ColaboradorParaGeracao {
  id: string;
  equipe_id: string | null;
  turno_semana_id: string | null;
}

interface TurnoParaGeracao {
  id: string;
  nome: string;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
  ordem_exibicao: number;
}

interface EscalaExistente {
  colaborador_id: string;
  data: string;
  turno_id: string;
}

interface DisponibilidadeExistente {
  colaborador_id: string;
  data: string;
  turno_id: string;
  disponivel: boolean;
}

interface VagaEquipeTurno {
  equipe_id: string;
  turno_id: string;
  vagas: number;
}

interface ParametrosGeracao {
  periodo: PeriodoOperacao;
  adminId: string;
  colaboradores: ColaboradorParaGeracao[];
  turnos: TurnoParaGeracao[];
  escalasExistentes: EscalaExistente[];
  disponibilidades: DisponibilidadeExistente[];
  vagas: VagaEquipeTurno[];
}

export function useGerarEscalaAutomatica() {
  const [gerando, setGerando] = useState(false);

  async function gerar({
    periodo,
    adminId,
    colaboradores,
    turnos,
    escalasExistentes,
    disponibilidades,
    vagas,
  }: ParametrosGeracao) {
    setGerando(true);

    const dias = [periodo.data_inicio, periodo.data_fim];
    const equipeIds = Array.from(
      new Set(colaboradores.map((c) => c.equipe_id).filter((id): id is string => !!id))
    );

    // Turnos ordenados pela ordem de exibição (Manhã, Tarde, Noite, etc.),
    // necessário para calcular "turno mais próximo".
    const turnosOrdenados = [...turnos].sort((a, b) => a.ordem_exibicao - b.ordem_exibicao);

    function indiceDoTurno(turnoId: string) {
      return turnosOrdenados.findIndex((t) => t.id === turnoId);
    }

    // 1. Histórico: quantas vezes cada colaborador já foi escalado no total
    // (usado como critério de desempate) e quantas vezes em cada turno
    // específico (usado para decidir o turno preferido de dobra quando o
    // turno da semana é o do meio).
    const { data: historicoEscalas, error: erroHistorico } = await supabase
      .from('escalas')
      .select('colaborador_id, turno_id');

    if (erroHistorico) {
      setGerando(false);
      return { erro: 'Não foi possível carregar o histórico de escalas.', quantidadeAdicionada: 0 };
    }

    const totalHistoricoPorColaborador = new Map<string, number>();
    const historicoPorColaboradorETurno = new Map<string, number>();

    for (const e of historicoEscalas ?? []) {
      totalHistoricoPorColaborador.set(
        e.colaborador_id,
        (totalHistoricoPorColaborador.get(e.colaborador_id) ?? 0) + 1
      );
      const chave = `${e.colaborador_id}|${e.turno_id}`;
      historicoPorColaboradorETurno.set(chave, (historicoPorColaboradorETurno.get(chave) ?? 0) + 1);
    }

    function totalHistorico(colaboradorId: string) {
      return totalHistoricoPorColaborador.get(colaboradorId) ?? 0;
    }

    function historicoNoTurno(colaboradorId: string, turnoId: string) {
      return historicoPorColaboradorETurno.get(`${colaboradorId}|${turnoId}`) ?? 0;
    }

    const novasLinhas: {
      colaborador_id: string;
      periodo_id: string;
      data: string;
      turno_id: string;
      created_by: string;
    }[] = [];

    // Estado mutável de quem está escalado, crescendo conforme preenchemos.
    const escaladosAtuais = new Set(
      escalasExistentes.map((e) => `${e.data}|${e.turno_id}|${e.colaborador_id}`)
    );

    // Quantos turnos cada colaborador já pegou em cada dia (máximo 2).
    const turnosNoDiaPorColaborador = new Map<string, number>();
    for (const e of escalasExistentes) {
      const chave = `${e.data}|${e.colaborador_id}`;
      turnosNoDiaPorColaborador.set(chave, (turnosNoDiaPorColaborador.get(chave) ?? 0) + 1);
    }

    function jaEscalado(colaboradorId: string, data: string, turnoId: string) {
      return escaladosAtuais.has(`${data}|${turnoId}|${colaboradorId}`);
    }

    function turnosNoDia(colaboradorId: string, data: string) {
      return turnosNoDiaPorColaborador.get(`${data}|${colaboradorId}`) ?? 0;
    }

    function disponivel(colaboradorId: string, data: string, turnoId: string) {
      return disponibilidades.some(
        (d) =>
          d.colaborador_id === colaboradorId &&
          d.data === data &&
          d.turno_id === turnoId &&
          d.disponivel
      );
    }

    function vagasConfiguradas(equipeId: string, turnoId: string) {
      return vagas.find((v) => v.equipe_id === equipeId && v.turno_id === turnoId)?.vagas ?? 0;
    }

    function vagasPreenchidas(equipeId: string, data: string, turnoId: string) {
      let contagem = 0;
      for (const c of colaboradores) {
        if (c.equipe_id === equipeId && jaEscalado(c.id, data, turnoId)) contagem++;
      }
      return contagem;
    }

    function vagasLivres(equipeId: string, data: string, turnoId: string) {
      return vagasConfiguradas(equipeId, turnoId) - vagasPreenchidas(equipeId, data, turnoId);
    }

    function escalar(colaboradorId: string, data: string, turnoId: string) {
      novasLinhas.push({
        colaborador_id: colaboradorId,
        periodo_id: periodo.id,
        data,
        turno_id: turnoId,
        created_by: adminId,
      });
      escaladosAtuais.add(`${data}|${turnoId}|${colaboradorId}`);
      const chaveDia = `${data}|${colaboradorId}`;
      turnosNoDiaPorColaborador.set(chaveDia, (turnosNoDiaPorColaborador.get(chaveDia) ?? 0) + 1);
    }

    // Ordena candidatos: primeiro quem tem o turno como "turno da semana",
    // depois os demais; dentro de cada grupo, quem tem mais histórico primeiro.
    function ordenarCandidatos(
      candidatos: ColaboradorParaGeracao[],
      turnoId: string
    ): ColaboradorParaGeracao[] {
      const prioritarios = candidatos.filter((c) => c.turno_semana_id === turnoId);
      const demais = candidatos.filter((c) => c.turno_semana_id !== turnoId);

      const porHistorico = (a: ColaboradorParaGeracao, b: ColaboradorParaGeracao) =>
        totalHistorico(b.id) - totalHistorico(a.id);

      prioritarios.sort(porHistorico);
      demais.sort(porHistorico);

      return [...prioritarios, ...demais];
    }

    for (const data of dias) {
      const ehSabado = data === periodo.data_inicio;
      const turnosDoDia = turnosOrdenados.filter((t) =>
        ehSabado ? t.ativo_sabado : t.ativo_domingo
      );

      for (const equipeId of equipeIds) {
        // ================================================================
        // PASSADA 1 — garante no máximo 1 turno por pessoa primeiro.
        // ================================================================
        for (const turno of turnosDoDia) {
          let livres = vagasLivres(equipeId, data, turno.id);
          if (livres <= 0) continue;

          const candidatos = colaboradores.filter(
            (c) =>
              c.equipe_id === equipeId &&
              disponivel(c.id, data, turno.id) &&
              !jaEscalado(c.id, data, turno.id) &&
              turnosNoDia(c.id, data) === 0 // ainda não trabalhou nada nesse dia
          );

          const ordenados = ordenarCandidatos(candidatos, turno.id);

          for (const candidato of ordenados) {
            if (livres <= 0) break;
            escalar(candidato.id, data, turno.id);
            livres--;
          }
        }

        // ================================================================
        // PASSADA 2 — dobras, só com quem sobrou vaga.
        // ================================================================
        for (const turno of turnosDoDia) {
          let livres = vagasLivres(equipeId, data, turno.id);
          if (livres <= 0) continue;

          // Candidatos a dobra: já trabalharam exatamente 1 turno nesse dia,
          // estão disponíveis para este turno, e ainda não chegaram a 2.
          const candidatosDobra = colaboradores.filter(
            (c) =>
              c.equipe_id === equipeId &&
              disponivel(c.id, data, turno.id) &&
              !jaEscalado(c.id, data, turno.id) &&
              turnosNoDia(c.id, data) === 1
          );

          if (candidatosDobra.length === 0) continue;

          // Para cada candidato, calcula qual é o "turno ideal" de dobra
          // dele (o mais próximo do turno da semana, com desempate pelo
          // turno que ele mais trabalhou historicamente quando o turno da
          // semana é o do meio) e só o aceita aqui se este turno for esse
          // ideal, OU se o turno ideal dele já não tiver mais vaga livre.
          function turnoIdealDeDobra(c: ColaboradorParaGeracao): string | null {
            if (!c.turno_semana_id) return null;
            const indiceSemana = indiceDoTurno(c.turno_semana_id);
            if (indiceSemana === -1) return null;

            const vizinhos = turnosDoDia.filter((t) => {
              const indiceT = indiceDoTurno(t.id);
              return Math.abs(indiceT - indiceSemana) === 1;
            });

            if (vizinhos.length === 1) return vizinhos[0].id;
            if (vizinhos.length === 0) return null;

            // Dois vizinhos (turno da semana é o do meio): prioriza o que
            // ele mais trabalhou historicamente.
            let escolhido = vizinhos[0];
            let melhorContagem = historicoNoTurno(c.id, escolhido.id);
            for (const v of vizinhos.slice(1)) {
              const contagem = historicoNoTurno(c.id, v.id);
              if (contagem > melhorContagem) {
                escolhido = v;
                melhorContagem = contagem;
              }
            }
            return escolhido.id;
          }

          const elegiveisAqui = candidatosDobra.filter((c) => {
            const ideal = turnoIdealDeDobra(c);
            if (ideal === null || ideal === turno.id) return true;
            // Só aceita aqui (fora do ideal) se o turno ideal dele não tiver
            // mais vaga livre para ele.
            return vagasLivres(equipeId, data, ideal) <= 0;
          });

          const ordenados = ordenarCandidatos(elegiveisAqui, turno.id);

          for (const candidato of ordenados) {
            if (livres <= 0) break;
            escalar(candidato.id, data, turno.id);
            livres--;
          }
        }
      }
    }

    if (novasLinhas.length === 0) {
      setGerando(false);
      return { erro: null, quantidadeAdicionada: 0 };
    }

    const { error } = await supabase.from('escalas').insert(novasLinhas);

    setGerando(false);

    if (error) {
      return {
        erro: 'Não foi possível gerar a escala automaticamente. Tente novamente.',
        quantidadeAdicionada: 0,
      };
    }

    return { erro: null, quantidadeAdicionada: novasLinhas.length };
  }

  return { gerar, gerando };
}