// Bloco de trabalho: o que entra numa troca de turno. Desde 13/11/2026 é um
// turno só (Manhã 08–17 ou Noite 17–02) — antes era o dia inteiro da pessoa
// (ex.: Manhã + Tarde). Quem trabalha os dois turnos no dia troca cada um
// separadamente.

export interface EscalaDoBloco {
  id: string;
  colaborador_id?: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
}

export interface BlocoDeTrabalho {
  // Id de uma das linhas do bloco (a primeira do dia), usado na solicitação.
  id: string;
  data: string;
  turnos: string[];
  inicio: string;
  fim: string;
}

const diasDaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function montarBloco(escalas: EscalaDoBloco[]): BlocoDeTrabalho {
  const ordenadas = [...escalas].sort((a, b) =>
    a.turno_hora_inicio_snapshot.localeCompare(b.turno_hora_inicio_snapshot)
  );
  const ultima = ordenadas[ordenadas.length - 1];
  return {
    id: ordenadas[0].id,
    data: ordenadas[0].data,
    turnos: ordenadas.map((e) => e.turno_nome_snapshot),
    inicio: ordenadas[0].turno_hora_inicio_snapshot.slice(0, 5),
    fim: ultima.turno_hora_fim_snapshot.slice(0, 5),
  };
}

// Os turnos de UMA pessoa como blocos (um por turno), em ordem de data e hora.
export function agruparEmBlocos(escalas: EscalaDoBloco[]): BlocoDeTrabalho[] {
  return escalas
    .map((e) => montarBloco([e]))
    .sort((a, b) => a.data.localeCompare(b.data) || a.inicio.localeCompare(b.inicio));
}

// Bloco da linha de escala referenciada numa solicitação (só o turno dela).
export function blocoDaEscala(
  referencia: EscalaDoBloco | null,
  _todas: EscalaDoBloco[]
): BlocoDeTrabalho | null {
  return referencia ? montarBloco([referencia]) : null;
}

export function rotuloBloco(bloco: BlocoDeTrabalho) {
  const [ano, mes, dia] = bloco.data.split('-').map(Number);
  const diaDaSemana = diasDaSemana[new Date(ano, mes - 1, dia).getDay()];
  const data = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
  return `${diaDaSemana} ${data} · ${bloco.turnos.join(' + ')} (${bloco.inicio}–${bloco.fim})`;
}
