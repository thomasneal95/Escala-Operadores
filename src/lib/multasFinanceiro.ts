// Cálculo do valor devido de uma multa aprovada, com juros de 50% compostos
// a cada segunda-feira de atraso — ver regras exibidas no dashboard de
// multas. Puramente derivado (data_vencimento + valor_base + hoje), sem
// nenhum job programado: o valor "cresce sozinho" só de recalcular na hora
// de exibir.

const JUROS_POR_SEMANA = 0.5;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function paraDataUtc(data: string) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

// Quantas segundas-feiras de vencimento já passaram (incluindo a própria
// data_vencimento, se já chegou) sem pagamento, a partir de hoje.
export function semanasEmAtraso(dataVencimento: string, hoje: Date = new Date()): number {
  const vencimentoUtc = paraDataUtc(dataVencimento);
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());

  if (hojeUtc < vencimentoUtc) return 0;

  const diasDeAtraso = Math.floor((hojeUtc - vencimentoUtc) / UM_DIA_MS);
  return Math.floor(diasDeAtraso / 7) + 1;
}

export function valorAtualMulta(
  valorBase: number,
  dataVencimento: string,
  paga: boolean,
  hoje: Date = new Date()
): number {
  if (paga) return valorBase;

  const semanas = semanasEmAtraso(dataVencimento, hoje);
  const valor = valorBase * Math.pow(1 + JUROS_POR_SEMANA, semanas);
  return Math.round(valor * 100) / 100;
}

export function formatarReais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
