const CHAVE = "int_518d903d07a471dca27c11b3f8d365a1bed7b831a51b686d2ed181971f60dce2";

interface Tentativa {
  descricao: string;
  status: number;
  corpo: string;
}

Deno.serve(async () => {
  const tentativas: Tentativa[] = [];

  async function tentarPost(descricao: string, url: string) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": CHAVE,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inicio: "2026-08-15",
          fim: "2026-08-16",
        }),
      });
      const texto = await resp.text();
      tentativas.push({ descricao, status: resp.status, corpo: texto.slice(0, 800) });
    } catch (e) {
      tentativas.push({ descricao, status: 0, corpo: `Erro de rede: ${e}` });
    }
  }

  await tentarPost("POST admin/apuracao/leads", "https://mypainel.site/api/admin/apuracao/leads");
  await tentarPost("POST admin/apuracao/vendedor", "https://mypainel.site/api/admin/apuracao/vendedor");
  await tentarPost("POST admin/apuracao/operador", "https://mypainel.site/api/admin/apuracao/operador");
  await tentarPost("POST admin/apuracao/atendente", "https://mypainel.site/api/admin/apuracao/atendente");
  await tentarPost("POST admin/apuracao/conversoes", "https://mypainel.site/api/admin/apuracao/conversoes");

  return new Response(JSON.stringify(tentativas, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});