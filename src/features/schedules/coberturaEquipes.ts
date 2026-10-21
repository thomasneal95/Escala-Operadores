import type { PeriodoOperacao } from '../../types/database';

// Regra: toda equipe precisa ter pelo menos 1 pessoa em cada turno que
// funciona no dia, no sábado e no domingo. A escala só pode ser confirmada
// sem lacunas.

interface TurnoCobertura {
  id: string;
  nome: string;
  ativo_sabado: boolean;
  ativo_domingo: boolean;
}

interface ColaboradorCobertura {
  id: string;
  equipe_id: string | null;
  equipe_nome: string | null;
}

interface EscalaCobertura {
  colaborador_id: string;
  data: string;
  turno_id: string;
}

export interface LacunaCobertura {
  data: string;
  equipe: string;
  turno: string;
}

export function lacunasDeCobertura(
  periodo: PeriodoOperacao,
  turnos: TurnoCobertura[],
  colaboradores: ColaboradorCobertura[],
  escalas: EscalaCobertura[]
): LacunaCobertura[] {
  const equipes = new Map<string, string>();
  for (const c of colaboradores) {
    if (c.equipe_id) equipes.set(c.equipe_id, c.equipe_nome ?? 'Equipe');
  }

  const equipeDoColaborador = new Map(colaboradores.map((c) => [c.id, c.equipe_id]));
  const cobertos = new Set(
    escalas.map((e) => `${e.data}|${e.turno_id}|${equipeDoColaborador.get(e.colaborador_id)}`)
  );

  const lacunas: LacunaCobertura[] = [];
  for (const data of [periodo.data_inicio, periodo.data_fim]) {
    const ehSabado = data === periodo.data_inicio;
    for (const turno of turnos) {
      if (!(ehSabado ? turno.ativo_sabado : turno.ativo_domingo)) continue;
      for (const [equipeId, equipeNome] of equipes) {
        if (!cobertos.has(`${data}|${turno.id}|${equipeId}`)) {
          lacunas.push({ data, equipe: equipeNome, turno: turno.nome });
        }
      }
    }
  }

  return lacunas.sort(
    (a, b) => a.data.localeCompare(b.data) || a.equipe.localeCompare(b.equipe)
  );
}
