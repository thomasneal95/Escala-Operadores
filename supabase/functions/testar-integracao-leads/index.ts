const CHAVE = "int_0b27e695b9e11e98cf31d29de58499ab390ef116d90ee0941f0f0692c5340906";
const URL_BASE = "https://mypainel.site/api/integracao/apuracao/leads";

interface Tentativa {
  descricao: string;
  status: number;
  corpo: string;
}

Deno.serve(async () => {
  const tentativas: Tentativa[] = [];

  async function tentar(descricao: string, url: string) {
    try {
      const resp = await fetch(url, { headers: { "x-api-key": CHAVE } });
      const texto = await resp.text();
      tentativas.push({ descricao, status: resp.status, corpo: texto.slice(0, 1200) });
    } catch (e) {
      tentativas.push({ descricao, status: 0, corpo: `Erro de rede: ${e}` });
    }
  }

  const inicio = "2026-08-15";
  const fim = "2026-08-16";

  await tentar(
    "eixo=conversao",
    `${URL_BASE}?inicio=${inicio}&fim=${fim}&eixo=conversao`
  );
  await tentar(
    "eixo=data_conversao",
    `${URL_BASE}?inicio=${inicio}&fim=${fim}&eixo=data_conversao`
  );
  await tentar(
    "eixo=ftd",
    `${URL_BASE}?inicio=${inicio}&fim=${fim}&eixo=ftd`
  );
  await tentar(
    "so convertido=true",
    `${URL_BASE}?inicio=${inicio}&fim=${fim}&convertido=true`
  );

  return new Response(JSON.stringify(tentativas, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});