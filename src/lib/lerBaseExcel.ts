import { read, SSF, utils, type WorkSheet } from 'xlsx';

// Lê a base de vendas (FTDs) de um Excel (.xlsx/.xlsm/.xls/.csv). Aceita a
// aba "Base" da planilha de comissões e a exportação de apuração do CRM
// ("Base Tratada", com Status / Declarado em (BRT) / hora na coluna ao
// lado). Procura primeiro as abas "Base" e "Base Tratada"; senão, a primeira
// aba que tenha as colunas necessárias.

export interface LinhaBase {
  cliente: string | null;
  operador: string;
  lead_telefone: string | null;
  etapa: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
}

function normalizar(texto: unknown) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

// Nomes aceitos para cada coluna (já normalizados).
const NOMES_COLUNAS = {
  operador: (n: string) => n === 'operador',
  etapa: (n: string) => n === 'etapa' || n === 'status',
  data: (n: string) => n === 'data' || n.startsWith('declarado em') || n.startsWith('data da conversao'),
  hora: (n: string) => n === 'hora' || n === 'horario',
  cliente: (n: string) => n === 'cliente' || n === 'numero',
  telefone: (n: string) => n === 'lead telefone' || n === 'telefone',
};

const doisDigitos = (n: number) => String(n).padStart(2, '0');

// Datas e horas são lidas como o número do Excel (dias desde 1900, com a
// hora na fração), sem passar por Date — evita desvios de fuso horário.
function paraData(valor: unknown): string | null {
  if (typeof valor === 'number') {
    const d = SSF.parse_date_code(valor);
    if (d && d.y > 1900) return `${d.y}-${doisDigitos(d.m)}-${doisDigitos(d.d)}`;
  }
  if (typeof valor === 'string') {
    const br = valor.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) return `${br[3]}-${doisDigitos(Number(br[2]))}-${doisDigitos(Number(br[1]))}`;
    const iso = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return null;
}

function paraHora(valor: unknown): string | null {
  if (typeof valor === 'number') {
    // Fração do dia (formato de hora do Excel).
    const segundos = Math.round((valor % 1) * 86400) % 86400;
    return `${doisDigitos(Math.floor(segundos / 3600))}:${doisDigitos(Math.floor(segundos / 60) % 60)}:${doisDigitos(segundos % 60)}`;
  }
  if (typeof valor === 'string') {
    const m = valor.trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) return `${doisDigitos(Number(m[1]))}:${m[2]}:${m[3] ?? '00'}`;
  }
  return null;
}

interface Colunas {
  operador: number;
  etapa: number;
  data: number;
  hora: number; // -1: a hora vem da própria coluna de data (data e hora juntas)
  cliente: number;
  telefone: number;
}

// Acha as colunas no cabeçalho (1ª linha). Sem coluna "Hora": usa a coluna
// logo à direita da data quando ela não tem nome próprio (ex.: "Coluna2"),
// ou a hora que vier junto na própria data.
function acharColunas(cabecalho: unknown[], amostra: unknown[][]): Colunas | null {
  const nomes = cabecalho.map(normalizar);
  const indice = (teste: (n: string) => boolean) => nomes.findIndex(teste);
  const operador = indice(NOMES_COLUNAS.operador);
  const etapa = indice(NOMES_COLUNAS.etapa);
  const data = indice(NOMES_COLUNAS.data);
  if (operador < 0 || etapa < 0 || data < 0) return null;

  let hora = indice(NOMES_COLUNAS.hora);
  if (hora < 0) {
    const vizinha = data + 1;
    const semNome = !nomes[vizinha] || /^coluna\d*$|^column\d*$|^__empty/.test(nomes[vizinha]);
    const pareceHora = amostra.some((l) => paraHora(l[vizinha]) !== null);
    hora = semNome && pareceHora ? vizinha : -1;
  }
  return {
    operador,
    etapa,
    data,
    hora,
    cliente: indice(NOMES_COLUNAS.cliente),
    telefone: indice(NOMES_COLUNAS.telefone),
  };
}

function linhasDaAba(aba: WorkSheet) {
  return utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: null, raw: true });
}

export async function lerBaseExcel(arquivo: File): Promise<{ linhas: LinhaBase[]; aba: string; ignoradas: number }> {
  const conteudo = await arquivo.arrayBuffer();
  const pasta = read(conteudo, { type: 'array', dense: true });

  const semEspacos = (n: string) => normalizar(n).replace(/[\s_]+/g, '');
  // Ordem de preferência: "Base", depois "Base Tratada", depois as demais.
  const prioridade = (n: string) => {
    const i = ['base', 'basetratada'].indexOf(semEspacos(n));
    return i < 0 ? 2 : i;
  };
  const candidatas = [...pasta.SheetNames].sort((a, b) => prioridade(a) - prioridade(b));

  for (const nomeAba of candidatas) {
    const todas = linhasDaAba(pasta.Sheets[nomeAba]);
    const [cabecalho, ...corpo] = todas;
    const colunas = acharColunas(cabecalho ?? [], corpo.slice(0, 20));
    if (!colunas) continue;

    const linhas: LinhaBase[] = [];
    let ignoradas = 0;
    for (const l of corpo) {
      if (!l || l.every((v) => v === null || v === '')) continue;
      const operador = String(l[colunas.operador] ?? '').trim();
      const data = paraData(l[colunas.data]);
      const hora = paraHora(colunas.hora >= 0 ? l[colunas.hora] : l[colunas.data]);
      if (!operador || !data || !hora) {
        ignoradas++;
        continue;
      }
      const texto = (i: number) => (i >= 0 && l[i] !== null && l[i] !== '' ? String(l[i]).trim() : null);
      linhas.push({
        cliente: texto(colunas.cliente),
        operador,
        lead_telefone: texto(colunas.telefone),
        etapa: String(l[colunas.etapa] ?? '').trim(),
        data,
        hora,
      });
    }
    return { linhas, aba: nomeAba, ignoradas };
  }

  throw new Error(
    'Não encontrei a base no arquivo. É preciso uma aba com as colunas Operador, Etapa (ou Status), Data (ou "Declarado em") e Hora.'
  );
}

// ---------------------------------------------------------------------------
// Aba "Historico" da planilha de comissões: meses já fechados (uma linha por
// pessoa e mês), para trazer o histórico antigo para o site.

export interface LinhaHistoricoExcel {
  mes: string; // YYYY-MM-01
  nome: string;
  equipe: string | null;
  data_inicio: string | null;
  auxilio: number;
  comissao_propria: number;
  comissao_equipe: number;
  comissao_fds: number;
  adiantamento: number;
  salario_total: number;
}

export async function lerHistoricoExcel(arquivo: File): Promise<LinhaHistoricoExcel[]> {
  const pasta = read(await arquivo.arrayBuffer(), { type: 'array', dense: true });
  const nomeAba = pasta.SheetNames.find((n) => normalizar(n) === 'historico');
  if (!nomeAba) throw new Error('O arquivo não tem a aba "Historico".');

  const registros = utils.sheet_to_json<Record<string, unknown>>(pasta.Sheets[nomeAba], {
    defval: null,
    raw: true,
  });
  const numero = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

  const linhas: LinhaHistoricoExcel[] = [];
  for (const registro of registros) {
    const campo = (nome: string) => {
      const chave = Object.keys(registro).find((k) => normalizar(k) === nome);
      return chave ? registro[chave] : null;
    };
    const data = paraData(campo('mes'));
    const nome = String(campo('nome') ?? '').trim();
    if (!data || !nome) continue;
    const equipe = String(campo('equipe') ?? '').trim();
    linhas.push({
      mes: `${data.slice(0, 7)}-01`,
      nome,
      equipe: equipe && equipe !== '-' ? equipe : null,
      data_inicio: paraData(campo('data inicio')),
      auxilio: numero(campo('auxilio')),
      comissao_propria: numero(campo('com. individual')),
      comissao_equipe: numero(campo('com. equipe')),
      comissao_fds: numero(campo('com. fds')),
      adiantamento: numero(campo('adiantamento')),
      salario_total: numero(campo('salario total')),
    });
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Aba "Vendas Infoprodutos" da planilha de comissões (lançamentos manuais):
// Data, Tipo do Produto, E-mail do Lead, Operador, Valor (US$).

export interface LinhaInfoprodutoExcel {
  data: string;
  produto: string;
  email_lead: string | null;
  operador: string;
  valor: number;
}

export async function lerInfoprodutosExcel(arquivo: File): Promise<LinhaInfoprodutoExcel[]> {
  const pasta = read(await arquivo.arrayBuffer(), { type: 'array', dense: true });
  const nomeAba = pasta.SheetNames.find((n) => normalizar(n) === 'vendas infoprodutos');
  if (!nomeAba) throw new Error('O arquivo não tem a aba "Vendas Infoprodutos".');

  const linhas = utils.sheet_to_json<unknown[]>(pasta.Sheets[nomeAba], { header: 1, defval: null, raw: true });
  const indiceCabecalho = linhas.findIndex((l) => {
    const nomes = (l ?? []).map(normalizar);
    return nomes.includes('data') && nomes.includes('operador') && nomes.some((n) => n.startsWith('valor'));
  });
  if (indiceCabecalho < 0) throw new Error('Não encontrei o cabeçalho (Data, Operador, Valor) na aba "Vendas Infoprodutos".');

  const cabecalho = linhas[indiceCabecalho].map(normalizar);
  // Só as primeiras colunas de cada nome (a aba tem um resumo ao lado).
  const coluna = (teste: (n: string) => boolean) => cabecalho.findIndex(teste);
  const cData = coluna((n) => n === 'data');
  const cProduto = coluna((n) => n.includes('produto'));
  const cEmail = coluna((n) => n.includes('e-mail') || n.includes('email'));
  const cOperador = coluna((n) => n === 'operador');
  const cValor = coluna((n) => n.startsWith('valor'));

  const resultado: LinhaInfoprodutoExcel[] = [];
  for (const l of linhas.slice(indiceCabecalho + 1)) {
    const data = paraData(l[cData]);
    const operador = String(l[cOperador] ?? '').trim();
    const valor = typeof l[cValor] === 'number' ? (l[cValor] as number) : Number(l[cValor]);
    if (!data || !operador || !Number.isFinite(valor)) continue;
    const email = cEmail >= 0 ? String(l[cEmail] ?? '').trim() : '';
    resultado.push({
      data,
      produto: String(l[cProduto] ?? '').trim() || 'Sem produto',
      email_lead: email || null,
      operador,
      valor,
    });
  }
  return resultado;
}
