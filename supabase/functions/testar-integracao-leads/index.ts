const CHAVE = "int_0b27e695b9e11e98cf31d29de58499ab390ef116d90ee0941f0f0692c5340906";
const URL_BASE = "https://mypainel.site/api/integracao/apuracao/leads";

function diaRealComCorte(dataHoraUtc: string): string {
  const dataUtc = new Date(dataHoraUtc);
  let dataLocal = new Date(dataUtc.getTime() - 3 * 60 * 60 * 1000);
  if (dataLocal.getUTCHours() < 6) {
    dataLocal = new Date(dataLocal.getTime() - 24 * 60 * 60 * 1000);
  }
  return dataLocal.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  // Janela bem mais larga que agosto, pra pegar tudo que pode "vazar" pra
  // dentro ou pra fora do mês quando aplicamos o corte às 6h.
  const inicio = "2026-07-28";
  const fim = "2026-08-27";

  const todosOsLeads: any[] = [];
  let pagina = 1;
  let temMais = true;

  while (temMais && pagina <= 20) {
    const url = `${URL_BASE}?inicio=${inicio}&fim=${fim}&eixo=conversao&pagina=${pagina}`;
    const resp = await fetch(url, { headers: { "x-api-key": CHAVE } });
    const dados = await resp.json();
    todosOsLeads.push(...(dados.leads ?? []));
    temMais = dados.tem_mais;
    pagina++;
  }

  const convertidos = todosOsLeads.filter((l) => l.convertido);

  const contandoComDiaReal = convertidos.filter((l) => {
    const diaReal = diaRealComCorte(l.data_conversao);
    return diaReal >= "2026-08-01" && diaReal <= "2026-08-31";
  });

  return new Response(
    JSON.stringify(
      {
        totalConvertidosNaJanelaLarga: convertidos.length,
        totalContandoComDiaRealDentroDeAgosto: contandoComDiaReal.length,
      },
      null,
      2
    ),
    { headers: { "Content-Type": "application/json" } }
  );
});