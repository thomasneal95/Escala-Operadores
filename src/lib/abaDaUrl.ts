// Aba pedida no endereço (?aba=trocas), usada ao tocar numa notificação.
// Lê uma vez, tira o parâmetro do endereço e devolve a aba se ela existir.
export function abaDaUrl<T extends string>(validas: readonly T[], padrao: T): T {
  const params = new URLSearchParams(window.location.search);
  const aba = params.get('aba');
  if (aba === null) return padrao;
  params.delete('aba');
  const resto = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (resto ? `?${resto}` : '') + window.location.hash);
  return (validas as readonly string[]).includes(aba) ? (aba as T) : padrao;
}
