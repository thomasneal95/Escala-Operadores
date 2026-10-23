// Formatadores usados nas telas do portal do operador.

const nomesMeses = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function mesAtual() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
}

export function nomeDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return `${nomesMeses[m - 1]} de ${a}`;
}

// "outubro de 2026" -> "Outubro de 2026", para títulos.
export function tituloDoMes(mes: string) {
  const nome = nomeDoMes(mes);
  return nome[0].toUpperCase() + nome.slice(1);
}

export function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'USD' });
}

export function dataBr(data: string | null) {
  if (!data) return '—';
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
