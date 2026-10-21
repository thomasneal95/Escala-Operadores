// Bloco de trabalho: todos os turnos de uma pessoa numa data (ex.: Manhã +
// Tarde). As trocas de turno são feitas por bloco, não turno a turno.

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

// Agrupa os turnos de UMA pessoa em blocos, um por data, em ordem de data.
export function agruparEmBlocos(escalas: EscalaDoBloco[]): BlocoDeTrabalho[] {
  const porData = new Map<string, EscalaDoBloco[]>();
  for (const e of escalas) {
    porData.set(e.data, [...(porData.get(e.data) ?? []), e]);
  }
  return [...porData.values()]
    .map(montarBloco)
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Bloco a que pertence uma linha de escala, procurando as outras linhas da
// mesma pessoa na mesma data em `todas`.
export function blocoDaEscala(
  referencia: EscalaDoBloco | null,
  todas: EscalaDoBloco[]
): BlocoDeTrabalho | null {
  if (!referencia) return null;
  const doBloco = todas.filter(
    (e) => e.colaborador_id === referencia.colaborador_id && e.data === referencia.data
  );
  return montarBloco(doBloco.length > 0 ? doBloco : [referencia]);
}

export function rotuloBloco(bloco: BlocoDeTrabalho) {
  const [ano, mes, dia] = bloco.data.split('-').map(Number);
  const diaDaSemana = diasDaSemana[new Date(ano, mes - 1, dia).getDay()];
  const data = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
  return `${diaDaSemana} ${data} · ${bloco.turnos.join(' + ')} (${bloco.inicio}–${bloco.fim})`;
}
