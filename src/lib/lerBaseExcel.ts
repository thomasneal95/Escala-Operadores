import { read, SSF, utils, type WorkSheet } from 'xlsx';

// Lê a base de vendas (FTDs) de um Excel (.xlsx/.xlsm/.xls/.csv). Procura a
// aba "Base" (planilha de comissões); se não houver, a "BaseTratada"; senão,
// a primeira aba que tenha as colunas Operador, Etapa, Data e Hora.

export interface LinhaBase {
  cliente: string | null;
  operador: string;
  lead_telefone: string | null;
  etapa: string;
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
}

const COLUNAS_OBRIGATORIAS = ['operador', 'etapa', 'data', 'hora'];

function normalizar(texto: unknown) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

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

function temColunas(aba: WorkSheet) {
  const [cabecalho] = utils.sheet_to_json<unknown[]>(aba, { header: 1, range: 0 });
  const nomes = (cabecalho ?? []).map(normalizar);
  return COLUNAS_OBRIGATORIAS.every((c) => nomes.includes(c));
}

export async function lerBaseExcel(arquivo: File): Promise<{ linhas: LinhaBase[]; aba: string; ignoradas: number }> {
  const conteudo = await arquivo.arrayBuffer();
  const pasta = read(conteudo, { type: 'array', dense: true });

  const preferidas = ['base', 'basetratada'];
  const nomeAba =
    preferidas
      .map((p) => pasta.SheetNames.find((n) => normalizar(n) === p))
      .find((n) => n && temColunas(pasta.Sheets[n])) ??
    pasta.SheetNames.find((n) => temColunas(pasta.Sheets[n]));

  if (!nomeAba) {
    throw new Error(
      'Não encontrei a base no arquivo. É preciso uma aba com as colunas Operador, Etapa, Data e Hora (como a aba "Base" da planilha de comissões).'
    );
  }

  const registros = utils.sheet_to_json<Record<string, unknown>>(pasta.Sheets[nomeAba], {
    defval: null,
    raw: true,
  });

  const linhas: LinhaBase[] = [];
  let ignoradas = 0;
  for (const registro of registros) {
    const campo = (nome: string) => {
      const chave = Object.keys(registro).find((k) => normalizar(k) === nome);
      return chave ? registro[chave] : null;
    };
    const operador = String(campo('operador') ?? '').trim();
    const data = paraData(campo('data'));
    const hora = paraHora(campo('hora'));
    if (!operador || !data || !hora) {
      ignoradas++;
      continue;
    }
    const cliente = campo('cliente');
    const telefone = campo('lead telefone');
    linhas.push({
      cliente: cliente === null ? null : String(cliente).trim(),
      operador,
      lead_telefone: telefone === null ? null : String(telefone).trim(),
      etapa: String(campo('etapa') ?? '').trim(),
      data,
      hora,
    });
  }

  return { linhas, aba: nomeAba, ignoradas };
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
