import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { calcularFechamento, diaReal } from "../_shared/calculoFechamento.ts";
import {
  carregarEntradaFechamento,
  somarDias,
  ultimoDiaDoMes,
} from "../_shared/carregarEntradaFechamento.ts";

// "Meus ganhos" do portal do operador: roda o MESMO cálculo do fechamento do
// admin e devolve só o que é da pessoa logada (a linha dela, o detalhe por
// dia e as vendas rejeitadas dela) e números agregados da equipe dela (FTDs
// e bolo por dia, sem nomes nem valores de colegas).

function mesAnterior(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return m === 1 ? `${a - 1}-12-01` : `${a}-${String(m - 1).padStart(2, "0")}-01`;
}

// "+57 315 1927532" -> "•••• 7532"
function mascarar(texto: string | null) {
  if (!texto) return null;
  const digitos = texto.replace(/\D/g, "");
  return digitos.length >= 4 ? `•••• ${digitos.slice(-4)}` : "••••";
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (!ctx.userClaims) {
      return Response.json({ erro: "Não autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const mes: string = body.mes;
    if (!mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
      return Response.json({ erro: "Informe 'mes' no formato YYYY-MM-01." }, { status: 400 });
    }

    const db = ctx.supabaseAdmin;

    const { data: eu } = await db
      .from("colaboradores")
      .select("id, nome_base")
      .eq("perfil_id", ctx.userClaims.id)
      .maybeSingle();

    if (!eu) {
      return Response.json({ erro: "Seu cadastro de colaborador não foi encontrado." }, { status: 404 });
    }

    const carregado = await carregarEntradaFechamento(db, mes);
    if (carregado.erro !== undefined) {
      return Response.json({ erro: carregado.erro }, { status: 500 });
    }

    const resultado = calcularFechamento({ ...carregado.entrada, detalheDe: eu.id });
    const config = carregado.entrada.config;
    const minhaLinha = resultado.linhas.find((l) => l.colaborador_id === eu.id) ?? null;
    const minhaEquipe = minhaLinha?.equipe ?? null;
    const nomeBase = (eu.nome_base ?? "").trim().toLowerCase();

    // Minhas vendas rejeitadas no mês (cliente mascarado).
    const rejeitadas = nomeBase
      ? (
          await db
            .from("vendas_importadas")
            .select("cliente, etapa, data, hora, operador")
            .gte("data", mes)
            .lte("data", somarDias(ultimoDiaDoMes(mes), 1))
            .ilike("operador", nomeBase)
            .ilike("etapa", "rejeitado")
        ).data ?? []
      : [];

    // Meus FTDs no mês anterior (para comparação).
    let ftdsMesAnterior: number | null = null;
    if (nomeBase) {
      const anterior = mesAnterior(mes);
      const { data } = await db
        .from("vendas_importadas")
        .select("etapa, data, hora")
        .gte("data", anterior)
        .lte("data", somarDias(ultimoDiaDoMes(anterior), 1))
        .ilike("operador", nomeBase)
        .limit(5000);
      if (data && data.length > 0) {
        ftdsMesAnterior = data.filter((v: { etapa: string; data: string; hora: string }) => {
          const dia = diaReal(v, config.hora_virada_dia);
          return v.etapa.trim().toLowerCase() !== "rejeitado" && dia >= anterior && dia <= ultimoDiaDoMes(anterior);
        }).length;
      }
    }

    const { data: arquivado } = await db.from("meses_arquivados").select("arquivado_em").eq("mes", mes).maybeSingle();

    return Response.json({
      mes,
      ultimaData: resultado.ultimaData,
      arquivadoEm: arquivado?.arquivado_em ?? null,
      nomeNaBaseConfigurado: !!eu.nome_base,
      minhaLinha,
      meusDias: resultado.paineis.detalheDesligados.find((d) => d.colaborador_id === eu.id)?.dias ?? [],
      ftdsMesAnterior,
      rejeitadas: rejeitadas
        .map((v: { cliente: string | null; data: string; hora: string }) => ({
          dia: diaReal(v, config.hora_virada_dia),
          hora: v.hora.slice(0, 5),
          cliente: mascarar(v.cliente),
        }))
        .filter((v: { dia: string }) => v.dia >= mes && v.dia <= ultimoDiaDoMes(mes))
        .sort((a: { dia: string }, b: { dia: string }) => a.dia.localeCompare(b.dia)),
      equipe: minhaEquipe
        ? {
            nome: minhaEquipe,
            ativos: resultado.paineis.porEquipe.find((e) => e.equipe === minhaEquipe)?.ativos ?? 0,
            porDia: resultado.paineis.comissaoPorEquipeEDia
              .filter((c) => c.equipe === minhaEquipe)
              .map((c) => ({ dia: c.dia, ftds: c.ftds, valor: c.valor })),
          }
        : null,
      regras: {
        inicio_regra_nova: config.inicio_regra_nova,
        valor_regra_nova: config.valor_regra_nova,
        valor_antigo_dia_util: config.valor_antigo_dia_util,
        valor_antigo_fds: config.valor_antigo_fds,
        hora_virada_dia: config.hora_virada_dia,
        percentual_infoproduto: config.percentual_infoproduto,
        taxa_total_a_pagar: config.taxa_total_a_pagar,
      },
    });
  }),
};
