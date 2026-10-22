// Cálculo do fechamento mensal a partir da base de vendas (FTDs) importada
// do Excel. Espelha a planilha "Comissões" (abas Fechamento, Rateio Equipe,
// FDS - Equipe e Fechamento Geral):
//
//   - Não contam vendas com Etapa "Rejeitado".
//   - Dia Real: vendas antes da hora de virada (ex.: 6h) contam para o dia
//     anterior.
//   - Valor por FTD: a partir de `inicioRegraNova`, `valorRegraNova` em
//     qualquer dia; antes, `valorAntigoDiaUtil` / `valorAntigoFds`.
//   - Comissão de equipe (dias úteis): FTDs da equipe no dia × valor,
//     divididos entre os membros da equipe (vigente no dia) que já tiveram o
//     1º lançamento do mês até aquele dia.
//   - Comissão de fim de semana: FTDs da equipe no dia × valor, divididos
//     entre quem da equipe teve pelo menos 1 FTD naquele dia.
//   - Auxílio: cheio para quem foi admitido até o 1º dia útil do mês; senão
//     proporcional (dias desde a admissão ÷ dias desde o 1º dia útil).
//   - Desligado no mês: auxílio proporcional até o último dia e sai da
//     divisão da equipe a partir do dia seguinte. O acerto já pago a ele é
//     descontado no fechamento ("já pago").
//   - Salário = Auxílio + Com. Equipe + Com. FDS − Adiantamento − Já pago.
//   - Total a pagar = Salário × (1 + taxa).
//   - "Comissão própria" (FTDs da pessoa em dias úteis × valor) é só
//     informativa — não entra no salário.
//   - Infoprodutos: cada venda gera `percentual_infoproduto` do valor,
//     dividido igualmente entre todos da equipe do vendedor na data (o
//     externo pago por FTD, ex.: João, fica com tudo). Soma no salário.
//   - Casos especiais: operador externo com valor fixo por FTD (ex.: João),
//     colaborador de comissionamento individual, salário fixo e auxílio fixo.
//
// Sem dependências: roda no Deno (edge function) e no Node (testes).

export interface Venda {
  operador: string;
  etapa: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM[:SS]
}

export interface ColaboradorFechamento {
  id: string;
  nome: string;
  nome_base: string | null;
  equipe_id: string | null;
  data_admissao: string | null;
  desativado_em: string | null;
  auxilio_mensal: number;
  comissionamento_individual: boolean;
}

export interface VigenciaEquipe {
  colaborador_id: string;
  equipe_id: string | null;
  valido_de: string;
  valido_ate: string | null;
}

export interface OperadorExterno {
  nome_base: string;
  // Com valor: aparece no fechamento ganhando esse valor por FTD (todos os
  // dias). Sem valor: fica fora de tudo.
  valor_por_ftd: number | null;
}

export interface VendaInfoproduto {
  data: string; // YYYY-MM-DD
  operador: string;
  valor: number;
}

export interface PagamentoFixo {
  id: string;
  nome: string;
  tipo: 'salario_fixo' | 'auxilio_fixo';
  valor: number;
  data_inicio: string | null;
  adiantamento: number;
}

export interface ConfiguracaoComissao {
  inicio_regra_nova: string;
  valor_regra_nova: number;
  valor_antigo_dia_util: number;
  valor_antigo_fds: number;
  valor_ftd_individual: number;
  taxa_total_a_pagar: number;
  percentual_infoproduto: number;
  hora_virada_dia: number;
}

export type TipoLinha = 'colaborador' | 'individual' | 'externo' | 'salario_fixo' | 'auxilio_fixo' | 'sem_cadastro';

export interface LinhaFechamento {
  chave: string;
  tipo: TipoLinha;
  colaborador_id: string | null;
  nome: string;
  equipe: string | null;
  data_inicio: string | null;
  auxilio: number;
  comissao_propria: number;
  comissao_equipe: number;
  comissao_fds: number;
  comissao_infoprodutos: number;
  adiantamento: number;
  // Acerto de desligamento já pago neste mês (descontado do salário).
  ja_pago: number;
  desligado_em: string | null;
  salario_total: number;
  ftds: number;
  total_a_pagar: number;
}

// Dados para os painéis (Dashboard, Insights e Projeção da planilha).
export interface PaineisFechamento {
  // FTDs válidos por dia (calendário e projeção). Ficam de fora só os
  // externos sem valor por FTD (logins fora da operação); os pagos por FTD
  // (ex.: João) contam.
  ftdsPorDia: { dia: string; ftds: number }[];
  // Bolo de comissão por equipe e dia (dias úteis: rateio da equipe; FDS:
  // valor dividido entre quem teve FTD).
  comissaoPorEquipeEDia: { dia: string; equipe: string; valor: number }[];
  porEquipe: {
    equipe: string;
    ativos: number;
    ftds: number;
    rejeitados: number;
  }[];
  rejeitadosPorOperador: { operador: string; equipe: string | null; qtd: number }[];
  rejeitadosNoMes: number;
  ativos: number;
  // Detalhe dia a dia de quem foi desligado no mês (demonstrativo do acerto).
  detalheDesligados: {
    colaborador_id: string;
    dias: { dia: string; ftds: number; comissao_equipe: number; comissao_fds: number; comissao_infoprodutos: number }[];
  }[];
  // Resumo dos operadores externos pagos por FTD (aba "Resumo João"):
  // registros por dia e etapa (sem os rejeitados).
  resumoExternos: {
    nome: string;
    valor_por_ftd: number;
    registros: { dia: string; etapa: string; qtd: number }[];
  }[];
}

export interface ResultadoFechamento {
  mes: string;
  ultimaData: string | null;
  totalFtds: number;
  linhas: LinhaFechamento[];
  paineis: PaineisFechamento;
  avisos: {
    operadoresSemCadastro: { operador: string; ftds: number }[];
    infoprodutosSemOperador: { operador: string; valor: number }[];
    colaboradoresSemNomeNaBase: string[];
    vendasForaDoMes: number;
  };
}

// ---------------------------------------------------------------------------

function normalizarNome(nome: string) {
  return nome.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function somarDias(data: string, dias: number) {
  const [a, m, d] = data.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

function diaDaSemana(data: string) {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

function ehFimDeSemana(data: string) {
  const dia = diaDaSemana(data);
  return dia === 0 || dia === 6;
}

function diferencaDias(de: string, ate: string) {
  const [a1, m1, d1] = de.split('-').map(Number);
  const [a2, m2, d2] = ate.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

function ultimoDiaDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

function primeiroDiaUtil(mes: string) {
  let d = mes;
  while (ehFimDeSemana(d)) d = somarDias(d, 1);
  return d;
}

export function diaReal(venda: Pick<Venda, 'data' | 'hora'>, horaVirada: number) {
  const hora = Number(venda.hora.split(':')[0]);
  return hora < horaVirada ? somarDias(venda.data, -1) : venda.data;
}

// Valor proporcional (auxílio / salário fixo) pela regra da planilha.
function proporcional(valor: number, admissao: string | null, desativacao: string | null, mes: string) {
  const ini = primeiroDiaUtil(mes);
  const fim = ultimoDiaDoMes(mes);
  const dias = diferencaDias(ini, fim) + 1;
  const inicioAtivo = admissao && admissao > ini ? admissao : ini;
  const fimAtivo = desativacao && desativacao < fim ? desativacao : fim;
  if (inicioAtivo > fim || fimAtivo < inicioAtivo) return 0;
  if (inicioAtivo === ini && fimAtivo === fim) return valor;
  return (valor * (diferencaDias(inicioAtivo, fimAtivo) + 1)) / dias;
}

const arredondar = (v: number) => Math.round(v * 100) / 100 || 0;

export function calcularFechamento(entrada: {
  mes: string; // YYYY-MM-01
  vendas: Venda[];
  colaboradores: ColaboradorFechamento[];
  vigencias: VigenciaEquipe[];
  equipes: Map<string, string>; // equipe_id -> nome
  adiantamentos: Map<string, number>; // colaborador_id -> valor
  externos: OperadorExterno[];
  fixos: PagamentoFixo[];
  infoprodutos?: VendaInfoproduto[];
  // Acertos de desligamento já pagos no mês: colaborador_id -> valor pago.
  acertosPagos?: Map<string, number>;
  config: ConfiguracaoComissao;
}): ResultadoFechamento {
  const { mes, colaboradores, vigencias, equipes, adiantamentos, externos, fixos, config } = entrada;
  const fimDoMes = ultimoDiaDoMes(mes);

  const valorDoDia = (data: string) => {
    if (data >= config.inicio_regra_nova) return config.valor_regra_nova;
    return ehFimDeSemana(data) ? config.valor_antigo_fds : config.valor_antigo_dia_util;
  };

  // Vendas do mês, já com o Dia Real.
  const todasDoMes: (Venda & { dia: string; rejeitada: boolean })[] = [];
  let vendasForaDoMes = 0;
  for (const v of entrada.vendas) {
    const dia = diaReal(v, config.hora_virada_dia);
    if (dia < mes || dia > fimDoMes) {
      vendasForaDoMes++;
      continue;
    }
    todasDoMes.push({ ...v, dia, rejeitada: normalizarNome(v.etapa) === 'rejeitado' });
  }
  const validas = todasDoMes.filter((v) => !v.rejeitada);
  const ultimaData = todasDoMes.reduce<string | null>((max, v) => (!max || v.dia > max ? v.dia : max), null);

  // Quem é quem na base.
  const colaboradorPorNome = new Map<string, ColaboradorFechamento>();
  for (const c of colaboradores) {
    if (c.nome_base) colaboradorPorNome.set(normalizarNome(c.nome_base), c);
  }
  const externoPorNome = new Map(externos.map((e) => [normalizarNome(e.nome_base), e]));

  const vigenciasPorColaborador = new Map<string, VigenciaEquipe[]>();
  for (const v of vigencias) {
    vigenciasPorColaborador.set(v.colaborador_id, [...(vigenciasPorColaborador.get(v.colaborador_id) ?? []), v]);
  }
  function equipeNoDia(c: ColaboradorFechamento, dia: string) {
    for (const v of vigenciasPorColaborador.get(c.id) ?? []) {
      if (v.valido_de <= dia && (v.valido_ate === null || v.valido_ate >= dia)) return v.equipe_id;
    }
    return c.equipe_id;
  }

  // Colaboradores que entram no rateio de equipe (não individuais).
  const deEquipe = colaboradores.filter((c) => !c.comissionamento_individual);

  // 1º lançamento do mês por colaborador (qualquer etapa, como na planilha)
  // e FTDs válidos por colaborador / dia.
  const primeiroLancamento = new Map<string, string>();
  const ftdsPorColaboradorEDia = new Map<string, number>(); // `${id}|${dia}`
  const ftdsPorOperadorDesconhecido = new Map<string, { operador: string; ftds: number }>();
  const ftdsPorExterno = new Map<string, { total: number; diasUteis: number }>();

  for (const v of todasDoMes) {
    const c = colaboradorPorNome.get(normalizarNome(v.operador));
    if (!c) continue;
    const atual = primeiroLancamento.get(c.id);
    if (!atual || v.dia < atual) primeiroLancamento.set(c.id, v.dia);
  }

  for (const v of validas) {
    const nome = normalizarNome(v.operador);
    const c = colaboradorPorNome.get(nome);
    if (c) {
      const chave = `${c.id}|${v.dia}`;
      ftdsPorColaboradorEDia.set(chave, (ftdsPorColaboradorEDia.get(chave) ?? 0) + 1);
      continue;
    }
    if (externoPorNome.has(nome)) {
      const e = ftdsPorExterno.get(nome) ?? { total: 0, diasUteis: 0 };
      e.total++;
      if (!ehFimDeSemana(v.dia)) e.diasUteis++;
      ftdsPorExterno.set(nome, e);
      continue;
    }
    const d = ftdsPorOperadorDesconhecido.get(nome) ?? { operador: v.operador.trim(), ftds: 0 };
    d.ftds++;
    ftdsPorOperadorDesconhecido.set(nome, d);
  }

  // Bolo por equipe e dia (FTDs dos colaboradores de equipe, na equipe
  // vigente no dia).
  const ftdsPorEquipeEDia = new Map<string, number>(); // `${equipe}|${dia}`
  const quemTeveFtdPorEquipeEDia = new Map<string, Set<string>>();
  for (const [chave, qtd] of ftdsPorColaboradorEDia) {
    const [id, dia] = chave.split('|');
    const c = deEquipe.find((x) => x.id === id);
    if (!c) continue;
    const equipe = equipeNoDia(c, dia);
    if (!equipe) continue;
    const k = `${equipe}|${dia}`;
    ftdsPorEquipeEDia.set(k, (ftdsPorEquipeEDia.get(k) ?? 0) + qtd);
    const quem = quemTeveFtdPorEquipeEDia.get(k) ?? new Set<string>();
    quem.add(id);
    quemTeveFtdPorEquipeEDia.set(k, quem);
  }

  const comissaoEquipe = new Map<string, number>();
  const comissaoFds = new Map<string, number>();
  // Também guarda o valor por pessoa e dia (detalhe dos desligados).
  const porDia = new Map<string, { equipe: number; fds: number; info: number }>();
  const somarNoDia = (id: string, dia: string, campo: 'equipe' | 'fds' | 'info', valor: number) => {
    const chave = `${id}|${dia}`;
    const atual = porDia.get(chave) ?? { equipe: 0, fds: 0, info: 0 };
    atual[campo] += valor;
    porDia.set(chave, atual);
  };
  const somar = (mapa: Map<string, number>, id: string, valor: number, dia?: string) => {
    mapa.set(id, (mapa.get(id) ?? 0) + valor);
    if (dia) somarNoDia(id, dia, mapa === comissaoFds ? 'fds' : 'equipe', valor);
  };

  for (const [k, qtd] of ftdsPorEquipeEDia) {
    const [equipe, dia] = k.split('|');
    const bolo = qtd * valorDoDia(dia);
    if (ehFimDeSemana(dia)) {
      const quem = [...(quemTeveFtdPorEquipeEDia.get(k) ?? [])];
      for (const id of quem) somar(comissaoFds, id, bolo / quem.length, dia);
    } else {
      const ativos = deEquipe.filter((c) => {
        const inicio = primeiroLancamento.get(c.id);
        const aindaAtivo = !c.desativado_em || dia <= c.desativado_em;
        return inicio !== undefined && inicio <= dia && aindaAtivo && equipeNoDia(c, dia) === equipe;
      });
      for (const c of ativos) somar(comissaoEquipe, c.id, bolo / ativos.length, dia);
    }
  }

  // Comissão de infoprodutos (só vendas com data dentro do mês).
  const infoPorChave = new Map<string, number>();
  const infoprodutosSemOperador: { operador: string; valor: number }[] = [];
  for (const venda of entrada.infoprodutos ?? []) {
    if (venda.data < mes || venda.data > fimDoMes) continue;
    const comissao = venda.valor * config.percentual_infoproduto;
    const nome = normalizarNome(venda.operador);
    const c = colaboradorPorNome.get(nome);
    const externo = externoPorNome.get(nome);
    if (c) {
      const equipe = equipeNoDia(c, venda.data);
      const ativosNaData = (x: ColaboradorFechamento) =>
        (!x.data_admissao || x.data_admissao <= venda.data) &&
        (!x.desativado_em || x.desativado_em >= venda.data);
      const membros = equipe
        ? colaboradores.filter((x) => ativosNaData(x) && equipeNoDia(x, venda.data) === equipe)
        : [c];
      const quem = membros.length > 0 ? membros : [c];
      for (const m of quem) {
        infoPorChave.set(m.id, (infoPorChave.get(m.id) ?? 0) + comissao / quem.length);
        somarNoDia(m.id, venda.data, 'info', comissao / quem.length);
      }
    } else if (externo && externo.valor_por_ftd !== null) {
      const chave = `externo:${nome}`;
      infoPorChave.set(chave, (infoPorChave.get(chave) ?? 0) + comissao);
    } else {
      infoprodutosSemOperador.push({ operador: venda.operador, valor: venda.valor });
    }
  }

  // Monta as linhas.
  const linhas: LinhaFechamento[] = [];
  const taxa = 1 + config.taxa_total_a_pagar;

  const desligadoEm = new Map(colaboradores.map((c) => [c.id, c.desativado_em]));

  function linha(
    semInfo: Omit<LinhaFechamento, 'total_a_pagar' | 'comissao_infoprodutos' | 'ja_pago' | 'desligado_em'>
  ): LinhaFechamento {
    const comissaoInfo = infoPorChave.get(semInfo.chave) ?? 0;
    const jaPago = semInfo.colaborador_id ? entrada.acertosPagos?.get(semInfo.colaborador_id) ?? 0 : 0;
    const base = {
      ...semInfo,
      comissao_infoprodutos: comissaoInfo,
      ja_pago: jaPago,
      desligado_em: semInfo.colaborador_id ? desligadoEm.get(semInfo.colaborador_id) ?? null : null,
      salario_total: semInfo.salario_total + comissaoInfo - jaPago,
    };
    const arred = {
      ...base,
      ja_pago: arredondar(base.ja_pago),
      comissao_infoprodutos: arredondar(base.comissao_infoprodutos),
      auxilio: arredondar(base.auxilio),
      comissao_propria: arredondar(base.comissao_propria),
      comissao_equipe: arredondar(base.comissao_equipe),
      comissao_fds: arredondar(base.comissao_fds),
      adiantamento: arredondar(base.adiantamento),
      salario_total: arredondar(base.salario_total),
    };
    return { ...arred, total_a_pagar: arredondar(base.salario_total * taxa) };
  }

  const ultimoDia = ultimaData ?? fimDoMes;

  for (const c of colaboradores) {
    let ftds = 0;
    let ftdsDiasUteis = 0;
    let comissaoPropria = 0;
    for (const [chave, qtd] of ftdsPorColaboradorEDia) {
      const [id, dia] = chave.split('|');
      if (id !== c.id) continue;
      ftds += qtd;
      if (!ehFimDeSemana(dia)) {
        ftdsDiasUteis += qtd;
        comissaoPropria += qtd * valorDoDia(dia);
      }
    }
    const auxilio = proporcional(c.auxilio_mensal, c.data_admissao, c.desativado_em, mes);
    const adiantamento = adiantamentos.get(c.id) ?? 0;
    // Quem saiu no mês aparece com a equipe em que estava no último dia.
    const diaDaEquipe = c.desativado_em && c.desativado_em < ultimoDia ? c.desativado_em : ultimoDia;
    const equipeId = equipeNoDia(c, diaDaEquipe);
    const equipe = equipeId ? equipes.get(equipeId) ?? null : null;

    if (c.comissionamento_individual) {
      const valor = config.valor_ftd_individual;
      linhas.push(
        linha({
          chave: c.id,
          tipo: 'individual',
          colaborador_id: c.id,
          nome: c.nome,
          equipe,
          data_inicio: c.data_admissao,
          auxilio,
          comissao_propria: ftdsDiasUteis * valor,
          comissao_equipe: 0,
          comissao_fds: (ftds - ftdsDiasUteis) * valor,
          adiantamento,
          salario_total: auxilio + ftds * valor - adiantamento,
          ftds,
        })
      );
      continue;
    }

    const equipeC = comissaoEquipe.get(c.id) ?? 0;
    const fds = comissaoFds.get(c.id) ?? 0;
    linhas.push(
      linha({
        chave: c.id,
        tipo: 'colaborador',
        colaborador_id: c.id,
        nome: c.nome,
        equipe,
        data_inicio: c.data_admissao,
        auxilio,
        comissao_propria: comissaoPropria,
        comissao_equipe: equipeC,
        comissao_fds: fds,
        adiantamento,
        salario_total: auxilio + equipeC + fds - adiantamento,
        ftds,
      })
    );
  }

  for (const e of externos) {
    if (e.valor_por_ftd === null) continue;
    const contagem = ftdsPorExterno.get(normalizarNome(e.nome_base)) ?? { total: 0, diasUteis: 0 };
    linhas.push(
      linha({
        chave: `externo:${normalizarNome(e.nome_base)}`,
        tipo: 'externo',
        colaborador_id: null,
        nome: e.nome_base,
        equipe: null,
        data_inicio: null,
        auxilio: 0,
        comissao_propria: contagem.diasUteis * e.valor_por_ftd,
        comissao_equipe: 0,
        comissao_fds: (contagem.total - contagem.diasUteis) * e.valor_por_ftd,
        adiantamento: 0,
        salario_total: contagem.total * e.valor_por_ftd,
        ftds: contagem.total,
      })
    );
  }

  for (const f of fixos) {
    const valor =
      f.tipo === 'salario_fixo' ? proporcional(f.valor, f.data_inicio, null, mes) : f.valor;
    linhas.push(
      linha({
        chave: `fixo:${f.id}`,
        tipo: f.tipo,
        colaborador_id: null,
        nome: f.nome,
        equipe: null,
        data_inicio: f.data_inicio,
        auxilio: valor,
        comissao_propria: 0,
        comissao_equipe: 0,
        comissao_fds: 0,
        adiantamento: f.adiantamento,
        salario_total: valor - f.adiantamento,
        ftds: 0,
      })
    );
  }

  linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  // ---- Painéis ----
  const nomeEquipe = (id: string | null) => (id ? equipes.get(id) ?? null : null);

  const ftdsPorDiaMapa = new Map<string, number>();
  for (const v of validas) {
    if (externoPorNome.get(normalizarNome(v.operador))?.valor_por_ftd === null) continue;
    ftdsPorDiaMapa.set(v.dia, (ftdsPorDiaMapa.get(v.dia) ?? 0) + 1);
  }

  const comissaoPorEquipeEDia = [...ftdsPorEquipeEDia].flatMap(([k, qtd]) => {
    const [equipeId, dia] = k.split('|');
    const equipe = nomeEquipe(equipeId);
    return equipe ? [{ dia, equipe, valor: arredondar(qtd * valorDoDia(dia)) }] : [];
  });

  const porEquipeMapa = new Map<string, { equipe: string; ativos: number; ftds: number; rejeitados: number }>();
  const daEquipe = (nome: string) => {
    const atual = porEquipeMapa.get(nome) ?? { equipe: nome, ativos: 0, ftds: 0, rejeitados: 0 };
    porEquipeMapa.set(nome, atual);
    return atual;
  };
  for (const [k, qtd] of ftdsPorEquipeEDia) {
    const equipe = nomeEquipe(k.split('|')[0]);
    if (equipe) daEquipe(equipe).ftds += qtd;
  }
  let ativos = 0;
  for (const c of deEquipe) {
    if (!primeiroLancamento.has(c.id)) continue;
    ativos++;
    const equipe = nomeEquipe(equipeNoDia(c, ultimoDia));
    if (equipe) daEquipe(equipe).ativos++;
  }

  const rejeitadosPorOperadorMapa = new Map<string, { operador: string; equipe: string | null; qtd: number }>();
  let rejeitadosNoMes = 0;
  for (const v of todasDoMes) {
    if (!v.rejeitada) continue;
    const nome = normalizarNome(v.operador);
    if (externoPorNome.has(nome)) continue;
    rejeitadosNoMes++;
    const c = colaboradorPorNome.get(nome);
    const equipe = c ? nomeEquipe(equipeNoDia(c, v.dia)) : null;
    if (equipe) daEquipe(equipe).rejeitados++;
    const r = rejeitadosPorOperadorMapa.get(nome) ?? { operador: c?.nome ?? v.operador.trim(), equipe, qtd: 0 };
    r.qtd++;
    rejeitadosPorOperadorMapa.set(nome, r);
  }

  const desligadosNoMes = colaboradores.filter(
    (c) => c.desativado_em && c.desativado_em >= mes && c.desativado_em <= fimDoMes
  );
  const detalheDesligados = desligadosNoMes.map((c) => {
    const dias = new Map<string, { dia: string; ftds: number; comissao_equipe: number; comissao_fds: number; comissao_infoprodutos: number }>();
    const doDia = (dia: string) => {
      const atual = dias.get(dia) ?? { dia, ftds: 0, comissao_equipe: 0, comissao_fds: 0, comissao_infoprodutos: 0 };
      dias.set(dia, atual);
      return atual;
    };
    for (const [chave, qtd] of ftdsPorColaboradorEDia) {
      const [id, dia] = chave.split('|');
      if (id === c.id) doDia(dia).ftds += qtd;
    }
    for (const [chave, v] of porDia) {
      const [id, dia] = chave.split('|');
      if (id !== c.id) continue;
      const d = doDia(dia);
      d.comissao_equipe += v.equipe;
      d.comissao_fds += v.fds;
      d.comissao_infoprodutos += v.info;
    }
    return {
      colaborador_id: c.id,
      dias: [...dias.values()]
        .map((d) => ({
          ...d,
          comissao_equipe: arredondar(d.comissao_equipe),
          comissao_fds: arredondar(d.comissao_fds),
          comissao_infoprodutos: arredondar(d.comissao_infoprodutos),
        }))
        .sort((a, b) => a.dia.localeCompare(b.dia)),
    };
  });

  const paineis: PaineisFechamento = {
    ftdsPorDia: [...ftdsPorDiaMapa]
      .map(([dia, ftds]) => ({ dia, ftds }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    comissaoPorEquipeEDia: comissaoPorEquipeEDia.sort(
      (a, b) => a.dia.localeCompare(b.dia) || a.equipe.localeCompare(b.equipe)
    ),
    porEquipe: [...porEquipeMapa.values()].sort((a, b) => a.equipe.localeCompare(b.equipe)),
    rejeitadosPorOperador: [...rejeitadosPorOperadorMapa.values()].sort((a, b) => b.qtd - a.qtd),
    rejeitadosNoMes,
    ativos,
    detalheDesligados,
    resumoExternos: externos
      .filter((e) => e.valor_por_ftd !== null)
      .map((e) => {
        const contagem = new Map<string, { dia: string; etapa: string; qtd: number }>();
        for (const v of validas) {
          if (normalizarNome(v.operador) !== normalizarNome(e.nome_base)) continue;
          const chave = `${v.dia}|${v.etapa}`;
          const atual = contagem.get(chave) ?? { dia: v.dia, etapa: v.etapa, qtd: 0 };
          atual.qtd++;
          contagem.set(chave, atual);
        }
        return {
          nome: e.nome_base,
          valor_por_ftd: e.valor_por_ftd as number,
          registros: [...contagem.values()].sort((a, b) => a.dia.localeCompare(b.dia)),
        };
      }),
  };

  return {
    mes,
    ultimaData,
    totalFtds: validas.length,
    linhas,
    paineis,
    avisos: {
      operadoresSemCadastro: [...ftdsPorOperadorDesconhecido.values()].sort((a, b) => b.ftds - a.ftds),
      infoprodutosSemOperador,
      colaboradoresSemNomeNaBase: colaboradores.filter((c) => !c.nome_base).map((c) => c.nome),
      vendasForaDoMes,
    },
  };
}
