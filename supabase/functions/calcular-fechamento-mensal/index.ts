import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { calcularFechamento } from "../_shared/calculoFechamento.ts";
import { carregarEntradaFechamento } from "../_shared/carregarEntradaFechamento.ts";

// Fechamento mensal a partir da base de vendas importada do Excel
// (tabela vendas_importadas). As regras ficam em _shared/calculoFechamento.ts
// e o carregamento dos dados em _shared/carregarEntradaFechamento.ts.

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (!ctx.userClaims) {
      return Response.json({ erro: "Não autenticado." }, { status: 401 });
    }

    const { data: perfilChamador } = await ctx.supabase
      .from("perfis")
      .select("papel")
      .eq("id", ctx.userClaims.id)
      .single();

    if (perfilChamador?.papel !== "administrador") {
      return Response.json(
        { erro: "Apenas administradores podem calcular fechamento." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const mes: string = body.mes; // "YYYY-MM-01"

    if (!mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
      return Response.json(
        { erro: "Informe 'mes' no formato YYYY-MM-01 (primeiro dia do mês)." },
        { status: 400 }
      );
    }

    const carregado = await carregarEntradaFechamento(ctx.supabaseAdmin, mes);
    if (carregado.erro !== undefined) {
      return Response.json({ erro: carregado.erro }, { status: 500 });
    }

    return Response.json(calcularFechamento(carregado.entrada));
  }),
};
