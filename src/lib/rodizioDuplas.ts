// Rodízio das duplas do fim de semana: cada dupla segue o ciclo
// Sábado → Domingo (home office) → Folga, sem reiniciar de um mês para o
// outro. A fase vem do número da dupla, contado a partir do fim de semana
// de referência, em que a Dupla 1 trabalha sábado, a Dupla 2 domingo e a
// Dupla 3 folga. Para mudar quem está em qual fase, troque a numeração das
// duplas na tela de Equipes.

export const SABADO_REFERENCIA = '2026-10-24';

export type PapelDupla = 'sabado' | 'domingo' | 'folga';

const CICLO: PapelDupla[] = ['sabado', 'domingo', 'folga'];

function diasDesdeEpoca(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia) / 86_400_000;
}

export function papelDaDupla(numero: number, sabado: string): PapelDupla {
  const semanas = Math.round((diasDesdeEpoca(sabado) - diasDesdeEpoca(SABADO_REFERENCIA)) / 7);
  const indice = (((numero - 1 + semanas) % 3) + 3) % 3;
  return CICLO[indice];
}

export const rotuloPapel: Record<PapelDupla, string> = {
  sabado: 'Sábado',
  domingo: 'Domingo (home)',
  folga: 'Folga',
};
