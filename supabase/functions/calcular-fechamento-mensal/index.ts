import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  calcularFechamento,
  type ColaboradorFechamento,
  type ConfiguracaoComissao,
  type Venda,
} from "../_shared/calculoFechamento.ts";

// Fechamento mensal a partir da base de vendas importada do Excel
// (tabela vendas_importadas). As regras ficam em _shared/calculoFechamento.ts.

function somarDias(data: string, dias: number) {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

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

    const db = ctx.supabaseAdmin;

    const { data: config, error: erroConfig } = await db
      .from("configuracao_comissao")
      .select(
        "inicio_regra_nova, valor_regra_nova, valor_antigo_dia_util, valor_antigo_fds, valor_ftd_individual, taxa_total_a_pagar, hora_virada_dia, percentual_infoproduto"
      )
      .single();

    if (erroConfig || !config) {
      return Response.json({ erro: "Não foi possível carregar os parâmetros de comissão." }, { status: 500 });
    }

    // Vendas do mês e do 1º dia do mês seguinte (as da madrugada ainda
    // contam para o último dia deste mês). Paginado: o Supabase devolve no
    // máximo 1000 linhas por consulta.
    const vendas: Venda[] = [];
    const ate = somarDias(ultimoDiaDoMes(mes), 1);
    for (let inicio = 0; ; inicio += 1000) {
      const { data, error } = await db
        .from("vendas_importadas")
        .select("operador, etapa, data, hora")
        .gte("data", mes)
        .lte("data", ate)
        .order("id")
        .range(inicio, inicio + 999);
      if (error) {
        return Response.json({ erro: "Não foi possível carregar a base de vendas." }, { status: 500 });
      }
      vendas.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }

    const [
      colaboradoresRes,
      vigenciasRes,
      equipesRes,
      adiantamentosRes,
      externosRes,
      fixosRes,
      infoprodutosRes,
      acertosRes,
      desligadosForaRes,
    ] =
      await Promise.all([
        db
          .from("colaboradores")
          .select(
            "id, nome_base, equipe_id, data_admissao, desativado_em, auxilio_mensal, comissionamento_individual, ativo, perfis(nome_completo, papel)"
          )
          .or(`ativo.eq.true,desativado_em.gte.${mes}`),
        db.from("historico_equipe").select("colaborador_id, equipe_id, valido_de, valido_ate"),
        db.from("equipes").select("id, nome"),
        db.from("adiantamentos_mensais").select("colaborador_id, valor").eq("mes", mes),
        db.from("operadores_externos").select("nome_base, valor_por_ftd"),
        db.from("pagamentos_fixos").select("id, nome, tipo, valor, data_inicio, adiantamento").eq("ativo", true),
        db
          .from("vendas_infoprodutos")
          .select("data, operador, valor")
          .gte("data", mes)
          .lte("data", ultimoDiaDoMes(mes)),
        db.from("acertos_desligamento").select("colaborador_id, valor_pago").eq("mes", mes),
        db
          .from("colaboradores")
          .select("nome_base, desativado_em, perfis(nome_completo)")
          .eq("ativo", false)
          .not("nome_base", "is", null)
          .or(`desativado_em.is.null,desativado_em.lt.${mes}`),
      ]);

    const falha = [
      colaboradoresRes,
      vigenciasRes,
      equipesRes,
      adiantamentosRes,
      externosRes,
      fixosRes,
      infoprodutosRes,
      acertosRes,
      desligadosForaRes,
    ].find(
      (r) => r.error
    );
    if (falha) {
      return Response.json({ erro: "Não foi possível carregar os cadastros do fechamento." }, { status: 500 });
    }

    const colaboradores: ColaboradorFechamento[] = (colaboradoresRes.data ?? [])
      // Fora do fechamento: administradores e cadastros de "comissionamento
      // individual" (não é mais usado — quem recebe por FTD, como o João, é
      // operador externo; manter os dois duplicaria o pagamento).
      // deno-lint-ignore no-explicit-any
      .filter((c: any) => c.perfis?.papel !== "administrador" && !c.comissionamento_individual)
      // deno-lint-ignore no-explicit-any
      .map((c: any) => ({
        id: c.id,
        nome: c.perfis?.nome_completo ?? "(sem nome)",
        nome_base: c.nome_base,
        equipe_id: c.equipe_id,
        data_admissao: c.data_admissao,
        desativado_em: c.ativo ? null : c.desativado_em,
        auxilio_mensal: Number(c.auxilio_mensal) || 0,
        comissionamento_individual: !!c.comissionamento_individual,
      }));

    const resultado = calcularFechamento({
      mes,
      vendas,
      colaboradores,
      vigencias: vigenciasRes.data ?? [],
      equipes: new Map((equipesRes.data ?? []).map((e) => [e.id, e.nome])),
      adiantamentos: new Map(
        (adiantamentosRes.data ?? []).map((a) => [a.colaborador_id, Number(a.valor)])
      ),
      externos: (externosRes.data ?? []).map((e) => ({
        nome_base: e.nome_base,
        valor_por_ftd: e.valor_por_ftd === null ? null : Number(e.valor_por_ftd),
      })),
      fixos: (fixosRes.data ?? []).map((f) => ({
        id: f.id,
        nome: f.nome,
        tipo: f.tipo,
        valor: Number(f.valor),
        data_inicio: f.data_inicio,
        adiantamento: Number(f.adiantamento),
      })),
      // deno-lint-ignore no-explicit-any
      desligadosForaDoMes: (desligadosForaRes.data ?? []).map((d: any) => ({
        nome: d.perfis?.nome_completo ?? d.nome_base,
        nome_base: d.nome_base,
        desativado_em: d.desativado_em,
      })),
      acertosPagos: new Map(
        (acertosRes.data ?? []).map((a) => [a.colaborador_id, Number(a.valor_pago)])
      ),
      infoprodutos: (infoprodutosRes.data ?? []).map((v) => ({
        data: v.data,
        operador: v.operador,
        valor: Number(v.valor),
      })),
      config: {
        inicio_regra_nova: config.inicio_regra_nova,
        valor_regra_nova: Number(config.valor_regra_nova),
        valor_antigo_dia_util: Number(config.valor_antigo_dia_util),
        valor_antigo_fds: Number(config.valor_antigo_fds),
        valor_ftd_individual: Number(config.valor_ftd_individual),
        taxa_total_a_pagar: Number(config.taxa_total_a_pagar),
        hora_virada_dia: Number(config.hora_virada_dia),
        percentual_infoproduto: Number(config.percentual_infoproduto),
      } satisfies ConfiguracaoComissao,
    });

    return Response.json(resultado);
  }),
};
