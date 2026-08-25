import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface LeadExterno {
  id: number;
  data_hora: string;
  email_operador: string;
  nome_operador: string;
  convertido: boolean;
}

interface RespostaApiExterna {
  total: number;
  tem_mais: boolean;
  leads: LeadExterno[];
}

const VALOR_DIA_DE_SEMANA = 2;
const VALOR_FIM_DE_SEMANA = 3;

// Converte um timestamp UTC (ex.: "2026-08-17T02:49:54.735Z") para a data
// local (America/Sao_Paulo, UTC-3 fixo — sem horário de verão atualmente)
// e o dia da semana correspondente (0=domingo...6=sábado, mesma convenção
// usada no restante do sistema).
function dataLocalEDiaDaSemana(dataHoraUtc: string) {
  const dataUtc = new Date(dataHoraUtc);
  const dataLocal = new Date(dataUtc.getTime() - 3 * 60 * 60 * 1000);
  const diaDaSemana = dataLocal.getUTCDay();
  const dataFormatada = dataLocal.toISOString().slice(0, 10); // YYYY-MM-DD
  return { dataFormatada, diaDaSemana };
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
        { erro: "Apenas administradores podem calcular comissionamento." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const inicio: string = body.inicio;
    const fim: string = body.fim;

    if (!inicio || !fim) {
      return Response.json({ erro: "Informe 'inicio' e 'fim' (formato YYYY-MM-DD)." }, { status: 400 });
    }

    // 1. Busca os leads na API externa.
    const urlBase = Deno.env.get("MYPAINEL_API_URL")!;
    const chaveApi = Deno.env.get("MYPAINEL_API_KEY")!;

    // ⚠️ NOTA: usando o filtro padrão da API (eixo=declaracao, data de
    // CRIAÇÃO do lead). Assim que o desenvolvedor corrigir o bug do
    // parâmetro "eixo=conversao", trocar a linha abaixo para incluir
    // "&eixo=conversao" na URL, para filtrar pela data de CONVERSÃO.
    const urlLeads = `${urlBase}?inicio=${inicio}&fim=${fim}`;

    const respostaApi = await fetch(urlLeads, {
      headers: { "x-api-key": chaveApi },
    });

    if (!respostaApi.ok) {
      return Response.json(
        { erro: `A API de leads retornou erro (status ${respostaApi.status}).` },
        { status: 502 }
      );
    }

    const dadosApi: RespostaApiExterna = await respostaApi.json();
    const leadsConvertidos = dadosApi.leads.filter((l) => l.convertido);

    // 2. Busca os colaboradores (com e-mail e equipe) para cruzar com os leads.
    const { data: colaboradoresData, error: erroColaboradores } = await ctx.supabaseAdmin
      .from("colaboradores")
      .select("id, equipe_id, ativo, perfis(email, nome_completo)")
      .eq("ativo", true);

    if (erroColaboradores) {
      return Response.json({ erro: "Não foi possível carregar os colaboradores." }, { status: 500 });
    }

    interface ColaboradorInfo {
      id: string;
      equipe_id: string | null;
      email: string | null;
      nome: string;
    }

    const colaboradores: ColaboradorInfo[] = (colaboradoresData ?? []).map((c: any) => ({
      id: c.id,
      equipe_id: c.equipe_id,
      email: c.perfis?.email?.toLowerCase().trim() ?? null,
      nome: c.perfis?.nome_completo ?? "(sem nome)",
    }));

    const colaboradorPorEmail = new Map<string, ColaboradorInfo>();
    for (const c of colaboradores) {
      if (c.email) colaboradorPorEmail.set(c.email, c);
    }

    // Quantidade de colaboradores ativos por equipe (usado na divisão de
    // dia de semana).
    const ativosPorEquipe = new Map<string, number>();
    for (const c of colaboradores) {
      if (!c.equipe_id) continue;
      ativosPorEquipe.set(c.equipe_id, (ativosPorEquipe.get(c.equipe_id) ?? 0) + 1);
    }

    // 3. Busca as presenças confirmadas no período (para dividir os leads
    // de fim de semana só entre quem realmente veio trabalhar).
    const { data: escalasData, error: erroEscalas } = await ctx.supabaseAdmin
      .from("escalas")
      .select("colaborador_id, data, compareceu")
      .gte("data", inicio)
      .lte("data", fim)
      .eq("compareceu", true);

    if (erroEscalas) {
      return Response.json({ erro: "Não foi possível carregar as presenças confirmadas." }, { status: 500 });
    }

    const colaboradorPorId = new Map(colaboradores.map((c) => [c.id, c]));

    // presentesPorEquipeEDia: chave "equipeId|data" -> lista de colaborador_id presentes
    const presentesPorEquipeEDia = new Map<string, Set<string>>();
    for (const e of escalasData ?? []) {
      const colaborador = colaboradorPorId.get(e.colaborador_id);
      if (!colaborador || !colaborador.equipe_id) continue;
      const chave = `${colaborador.equipe_id}|${e.data}`;
      const conjunto = presentesPorEquipeEDia.get(chave) ?? new Set<string>();
      conjunto.add(e.colaborador_id);
      presentesPorEquipeEDia.set(chave, conjunto);
    }

    // 4. Processa os leads: separa em dia de semana / fim de semana, e
    // acumula quantos leads cada equipe gerou (geral, e por dia específico
    // no caso de fim de semana).
    const leadsSemDonoConhecido: { id: number; email: string }[] = [];
    const leadsPorEquipeDiaSemana = new Map<string, number>(); // equipeId -> contagem
    const leadsPorEquipeEDiaFimDeSemana = new Map<string, number>(); // "equipeId|data" -> contagem

    for (const lead of leadsConvertidos) {
      const emailLead = lead.email_operador?.toLowerCase().trim();
      const colaborador = emailLead ? colaboradorPorEmail.get(emailLead) : undefined;

      if (!colaborador || !colaborador.equipe_id) {
        leadsSemDonoConhecido.push({ id: lead.id, email: lead.email_operador });
        continue;
      }

      const { dataFormatada, diaDaSemana } = dataLocalEDiaDaSemana(lead.data_hora);
      const ehFimDeSemana = diaDaSemana === 0 || diaDaSemana === 6;

      if (ehFimDeSemana) {
        const chave = `${colaborador.equipe_id}|${dataFormatada}`;
        leadsPorEquipeEDiaFimDeSemana.set(chave, (leadsPorEquipeEDiaFimDeSemana.get(chave) ?? 0) + 1);
      } else {
        leadsPorEquipeDiaSemana.set(
          colaborador.equipe_id,
          (leadsPorEquipeDiaSemana.get(colaborador.equipe_id) ?? 0) + 1
        );
      }
    }

    // 5. Calcula o valor de cada colaborador.
    const comissaoPorColaborador = new Map<string, number>();

    function adicionarComissao(colaboradorId: string, valor: number) {
      comissaoPorColaborador.set(colaboradorId, (comissaoPorColaborador.get(colaboradorId) ?? 0) + valor);
    }

    // Dia de semana: valor da equipe dividido por TODOS os ativos da equipe.
    for (const [equipeId, quantidadeLeads] of leadsPorEquipeDiaSemana.entries()) {
      const ativos = ativosPorEquipe.get(equipeId) ?? 0;
      if (ativos === 0) continue;
      const valorTotalEquipe = quantidadeLeads * VALOR_DIA_DE_SEMANA;
      const valorPorPessoa = valorTotalEquipe / ativos;
      for (const c of colaboradores) {
        if (c.equipe_id === equipeId) adicionarComissao(c.id, valorPorPessoa);
      }
    }

    // Fim de semana: valor do dia dividido só entre quem confirmou presença
    // naquele dia específico, dentro da mesma equipe.
    const diasSemPresencaConfirmada: { equipeId: string; data: string; leads: number }[] = [];

    for (const [chave, quantidadeLeads] of leadsPorEquipeEDiaFimDeSemana.entries()) {
      const [equipeId, data] = chave.split("|");
      const presentes = presentesPorEquipeEDia.get(chave);

      if (!presentes || presentes.size === 0) {
        diasSemPresencaConfirmada.push({ equipeId, data, leads: quantidadeLeads });
        continue;
      }

      const valorTotalDia = quantidadeLeads * VALOR_FIM_DE_SEMANA;
      const valorPorPessoa = valorTotalDia / presentes.size;
      for (const colaboradorId of presentes) {
        adicionarComissao(colaboradorId, valorPorPessoa);
      }
    }

    // 6. Monta a resposta final.
    const resultado = colaboradores
      .map((c) => ({
        colaborador_id: c.id,
        nome: c.nome,
        comissao: Math.round((comissaoPorColaborador.get(c.id) ?? 0) * 100) / 100,
      }))
      .filter((r) => r.comissao > 0)
      .sort((a, b) => b.comissao - a.comissao);

    return Response.json({
      periodo: { inicio, fim },
      totalLeadsConvertidos: leadsConvertidos.length,
      resultado,
      avisos: {
        leadsSemColaboradorConhecido: leadsSemDonoConhecido,
        diasDeFimDeSemanaSemPresencaConfirmada: diasSemPresencaConfirmada,
      },
    });
  }),
};