import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

interface LeadExterno {
  id: number;
  data_hora: string;
  data_conversao: string;
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

function dataLocalEDiaDaSemana(dataHoraUtc: string) {
  const dataUtc = new Date(dataHoraUtc);
  const dataLocal = new Date(dataUtc.getTime() - 3 * 60 * 60 * 1000);
  const diaDaSemana = dataLocal.getUTCDay();
  const dataFormatada = dataLocal.toISOString().slice(0, 10);
  return { dataFormatada, diaDaSemana };
}

function todosOsDiasDoMes(mesInicio: string): string[] {
  const [ano, mes] = mesInicio.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dias: string[] = [];
  for (let dia = 1; dia <= ultimoDia; dia++) {
    dias.push(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`);
  }
  return dias;
}

function diaDaSemanaDeString(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
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
    const mesInicio: string = body.mes; // formato "YYYY-MM-01"

    if (!mesInicio || !/^\d{4}-\d{2}-01$/.test(mesInicio)) {
      return Response.json(
        { erro: "Informe 'mes' no formato YYYY-MM-01 (primeiro dia do mês)." },
        { status: 400 }
      );
    }

    const diasDoMes = todosOsDiasDoMes(mesInicio);
    const mesFim = diasDoMes[diasDoMes.length - 1];

    // 1. Busca TODOS os leads do mês na API externa (com paginação).
    const urlBase = Deno.env.get("MYPAINEL_API_URL")!;
    const chaveApi = Deno.env.get("MYPAINEL_API_KEY")!;

    const todosOsLeads: LeadExterno[] = [];
    let pagina = 1;
    let temMais = true;
    let paginasLidas = 0;

    while (temMais && paginasLidas < 20) {
      const url = `${urlBase}?inicio=${mesInicio}&fim=${mesFim}&eixo=conversao&pagina=${pagina}`;
      const resp = await fetch(url, { headers: { "x-api-key": chaveApi } });

      if (!resp.ok) {
        return Response.json(
          { erro: `A API de leads retornou erro (status ${resp.status}) na página ${pagina}.` },
          { status: 502 }
        );
      }

      const dados: RespostaApiExterna = await resp.json();
      todosOsLeads.push(...dados.leads);
      temMais = dados.tem_mais;
      pagina++;
      paginasLidas++;
    }

    const leadsConvertidos = todosOsLeads.filter((l) => l.convertido);

    // 2. Colaboradores ativos (com e-mail, auxílio, admissão).
        const { data: colaboradoresData, error: erroColaboradores } = await ctx.supabaseAdmin
      .from("colaboradores")
      .select(
        "id, equipe_id, data_admissao, auxilio_mensal, comissionamento_individual, ativo, perfis(email, nome_completo)"
      )
      .eq("ativo", true);

    if (erroColaboradores) {
      return Response.json({ erro: "Não foi possível carregar os colaboradores." }, { status: 500 });
    }

        interface ColaboradorInfo {
      id: string;
      equipe_id: string | null;
      data_admissao: string | null;
      auxilio_mensal: number;
      email: string | null;
      nome: string;
      comissionamentoIndividual: boolean;
    }

    const colaboradores: ColaboradorInfo[] = (colaboradoresData ?? []).map((c: any) => ({
      id: c.id,
      equipe_id: c.equipe_id,
      data_admissao: c.data_admissao,
      auxilio_mensal: Number(c.auxilio_mensal) || 0,
      email: c.perfis?.email?.toLowerCase().trim() ?? null,
      nome: c.perfis?.nome_completo ?? "(sem nome)",
      comissionamentoIndividual: !!c.comissionamento_individual,
    }));

    const colaboradorPorEmail = new Map<string, ColaboradorInfo>();
    for (const c of colaboradores) {
      if (c.email) colaboradorPorEmail.set(c.email, c);
    }
    const colaboradorPorId = new Map(colaboradores.map((c) => [c.id, c]));

    // 3. Histórico de vigência de equipe — para saber a equipe de cada
    // colaborador em cada dia específico do mês (considera trocas).
    const { data: historicoData, error: erroHistorico } = await ctx.supabaseAdmin
      .from("historico_equipe")
      .select("colaborador_id, equipe_id, valido_de, valido_ate");

    if (erroHistorico) {
      return Response.json({ erro: "Não foi possível carregar o histórico de equipe." }, { status: 500 });
    }

    function equipeVigenteEm(colaboradorId: string, data: string): string | null {
      const registros = (historicoData ?? []).filter((h) => h.colaborador_id === colaboradorId);
      for (const r of registros) {
        if (r.valido_de <= data && (r.valido_ate === null || r.valido_ate >= data)) {
          return r.equipe_id;
        }
      }
      // Sem histórico específico: usa a equipe atual do cadastro como fallback.
      return colaboradorPorId.get(colaboradorId)?.equipe_id ?? null;
    }

        // 4. Todas as escalas do mês (não só as confirmadas) — precisamos
    // saber quem foi confirmado (compareceu=true), quem foi confirmado
    // como falta (compareceu=false) e quem nunca teve presença
    // confirmada (compareceu=null, comum em dados anteriores ao sistema).
    const { data: escalasData, error: erroEscalas } = await ctx.supabaseAdmin
      .from("escalas")
      .select("colaborador_id, data, compareceu")
      .gte("data", mesInicio)
      .lte("data", mesFim);

    if (erroEscalas) {
      return Response.json({ erro: "Não foi possível carregar as presenças confirmadas." }, { status: 500 });
    }

    // 5. Processa os leads: agrupa contagem por (equipe, dia), separando
    // dia de semana de fim de semana, e registra a 1ª conversão do mês de
    // cada colaborador (usada para saber quando ele "entra" no rateio).
    const leadsSemDonoConhecido: { id: number; email: string }[] = [];
    const contagemDiaSemanaPorEquipeEDia = new Map<string, number>(); // "equipeId|data"
    const contagemFimDeSemanaPorEquipeEDia = new Map<string, number>();
    const primeiraConversaoNoMes = new Map<string, string>(); // colaborador_id -> data
    const colaboradoresComLeadNoDia = new Map<string, Set<string>>(); // "data" -> Set(colaborador_id)
    const comissaoIndividualPorColaborador = new Map<string, number>(); // colaborador_id -> valor
    const VALOR_INDIVIDUAL = 2;
    for (const lead of leadsConvertidos) {
      const emailLead = lead.email_operador?.toLowerCase().trim();
      const colaborador = emailLead ? colaboradorPorEmail.get(emailLead) : undefined;

      if (!colaborador) {
        leadsSemDonoConhecido.push({ id: lead.id, email: lead.email_operador });
        continue;
      }

            const { dataFormatada } = dataLocalEDiaDaSemana(lead.data_conversao);

      // Comissionamento individual: valor fixo por lead, sem divisão e
      // sem distinção de dia. Não entra em nenhuma lógica de equipe.
      if (colaborador.comissionamentoIndividual) {
        comissaoIndividualPorColaborador.set(
          colaborador.id,
          (comissaoIndividualPorColaborador.get(colaborador.id) ?? 0) + VALOR_INDIVIDUAL
        );
        continue;
      }

      const atual = primeiraConversaoNoMes.get(colaborador.id);
      if (!atual || dataFormatada < atual) {
        primeiraConversaoNoMes.set(colaborador.id, dataFormatada);
      }

      const equipeDoDia = equipeVigenteEm(colaborador.id, dataFormatada);
      if (!equipeDoDia) continue; // sem equipe nesse dia, não entra em rateio de equipe

      const diaDaSemana = diaDaSemanaDeString(dataFormatada);
      const ehFimDeSemana = diaDaSemana === 0 || diaDaSemana === 6;
      const chave = `${equipeDoDia}|${dataFormatada}`;

            if (ehFimDeSemana) {
        contagemFimDeSemanaPorEquipeEDia.set(chave, (contagemFimDeSemanaPorEquipeEDia.get(chave) ?? 0) + 1);
        const conjuntoDoDia = colaboradoresComLeadNoDia.get(dataFormatada) ?? new Set<string>();
        conjuntoDoDia.add(colaborador.id);
        colaboradoresComLeadNoDia.set(dataFormatada, conjuntoDoDia);
      } else {
        contagemDiaSemanaPorEquipeEDia.set(chave, (contagemDiaSemanaPorEquipeEDia.get(chave) ?? 0) + 1);
      }
    }

    // 6. Calcula, dia a dia, o rateio de dia de semana e de fim de semana.
    const comissaoDiaSemanaPorColaborador = new Map<string, number>();
    const comissaoFimDeSemanaPorColaborador = new Map<string, number>();
    const diasDeFimDeSemanaSemPresencaConfirmada: { equipeId: string; data: string; leads: number }[] = [];

    function adicionar(mapa: Map<string, number>, colaboradorId: string, valor: number) {
      mapa.set(colaboradorId, (mapa.get(colaboradorId) ?? 0) + valor);
    }

    for (const dia of diasDoMes) {
      const diaDaSemana = diaDaSemanaDeString(dia);
      const ehFimDeSemana = diaDaSemana === 0 || diaDaSemana === 6;

      // Todas as equipes distintas presentes na contagem desse dia.
      const equipesDoDia = new Set<string>();
      for (const c of colaboradores) {
        const eq = equipeVigenteEm(c.id, dia);
        if (eq) equipesDoDia.add(eq);
      }

      for (const equipeId of equipesDoDia) {
        const chave = `${equipeId}|${dia}`;

                if (ehFimDeSemana) {
          const quantidadeLeads = contagemFimDeSemanaPorEquipeEDia.get(chave);
          if (!quantidadeLeads) continue;

          // Prioridade 1: quem teve presença explicitamente confirmada.
          let presentes = colaboradores.filter((c) => {
            if (equipeVigenteEm(c.id, dia) !== equipeId) return false;
            return (escalasData ?? []).some(
              (e) => e.colaborador_id === c.id && e.data === dia && e.compareceu === true
            );
          });

                    // Prioridade 2 (só se ninguém tiver confirmação nenhuma): usa
          // quem foi escalado sem confirmação (compareceu = null) como
          // aproximação — útil para períodos anteriores ao sistema.
          if (presentes.length === 0) {
            presentes = colaboradores.filter((c) => {
              if (equipeVigenteEm(c.id, dia) !== equipeId) return false;
              return (escalasData ?? []).some(
                (e) => e.colaborador_id === c.id && e.data === dia && e.compareceu === null
              );
            });
          }

          // Prioridade 3 (só se não existir NENHUM registro de escala pra
          // esse dia): usa quem converteu pelo menos 1 lead nesse dia como
          // prova de que trabalhou — necessário para dados anteriores ao
          // sistema, quando nem a escala foi registrada.
          if (presentes.length === 0) {
            const comLeadNesseDia = colaboradoresComLeadNoDia.get(dia) ?? new Set<string>();
            presentes = colaboradores.filter((c) => {
              if (equipeVigenteEm(c.id, dia) !== equipeId) return false;
              return comLeadNesseDia.has(c.id);
            });
          }

          if (presentes.length === 0) {
            diasDeFimDeSemanaSemPresencaConfirmada.push({ equipeId, data: dia, leads: quantidadeLeads });
            continue;
          }

          const valorTotal = quantidadeLeads * VALOR_FIM_DE_SEMANA;
          const valorPorPessoa = valorTotal / presentes.length;
          for (const p of presentes) {
            adicionar(comissaoFimDeSemanaPorColaborador, p.id, valorPorPessoa);
          }
        } else {
          const quantidadeLeads = contagemDiaSemanaPorEquipeEDia.get(chave);
          if (!quantidadeLeads) continue;

          const ativos = colaboradores.filter((c) => {
            if (equipeVigenteEm(c.id, dia) !== equipeId) return false;
            const inicio = primeiraConversaoNoMes.get(c.id);
            return inicio !== undefined && inicio <= dia;
          });

          if (ativos.length === 0) continue;

          const valorTotal = quantidadeLeads * VALOR_DIA_DE_SEMANA;
          const valorPorPessoa = valorTotal / ativos.length;
          for (const a of ativos) {
            adicionar(comissaoDiaSemanaPorColaborador, a.id, valorPorPessoa);
          }
        }
      }
    }

    // 7. Auxílio proporcional à data de admissão.
    const diasNoMes = diasDoMes.length;

    function auxilioProporcional(c: ColaboradorInfo): number {
      if (!c.data_admissao) return c.auxilio_mensal;
      if (c.data_admissao <= mesInicio) return c.auxilio_mensal;
      if (c.data_admissao > mesFim) return 0;

      const [anoA, mesA, diaA] = c.data_admissao.split("-").map(Number);
      const [anoF, mesF, diaF] = mesFim.split("-").map(Number);
      const admissao = Date.UTC(anoA, mesA - 1, diaA);
      const fim = Date.UTC(anoF, mesF - 1, diaF);
      const diasRestantes = Math.round((fim - admissao) / (1000 * 60 * 60 * 24)) + 1;

      return (c.auxilio_mensal * diasRestantes) / diasNoMes;
    }

    // 8. Adiantamentos já lançados para este mês.
    const { data: adiantamentosData } = await ctx.supabaseAdmin
      .from("adiantamentos_mensais")
      .select("colaborador_id, valor")
      .eq("mes", mesInicio);

    const adiantamentoPorColaborador = new Map(
      (adiantamentosData ?? []).map((a) => [a.colaborador_id, Number(a.valor)])
    );

        // 9. Monta o resultado final por colaborador.
    const resultado = colaboradores
      .map((c) => {
        const auxilio = Math.round(auxilioProporcional(c) * 100) / 100;
        const comissaoDiaSemana = Math.round((comissaoDiaSemanaPorColaborador.get(c.id) ?? 0) * 100) / 100;
        const comissaoFimDeSemana = Math.round((comissaoFimDeSemanaPorColaborador.get(c.id) ?? 0) * 100) / 100;
        const comissaoIndividual = Math.round((comissaoIndividualPorColaborador.get(c.id) ?? 0) * 100) / 100;
        const adiantamento = adiantamentoPorColaborador.get(c.id) ?? 0;
        const salarioTotal =
          Math.round(
            (auxilio + comissaoDiaSemana + comissaoFimDeSemana + comissaoIndividual - adiantamento) * 100
          ) / 100;

        return {
          colaborador_id: c.id,
          nome: c.nome,
          auxilio,
          comissaoDiaSemana,
          comissaoFimDeSemana,
          comissaoIndividual,
          adiantamento,
          salarioTotal,
        };
      })
      .filter(
        (r) => r.auxilio > 0 || r.comissaoDiaSemana > 0 || r.comissaoFimDeSemana > 0 || r.comissaoIndividual > 0
      )
      .sort((a, b) => b.salarioTotal - a.salarioTotal);

    return Response.json({
      mes: mesInicio,
      totalLeadsConvertidos: leadsConvertidos.length,
      resultado,
      avisos: {
        leadsSemColaboradorConhecido: leadsSemDonoConhecido,
        diasDeFimDeSemanaSemPresencaConfirmada,
      },
    });
  }),
};