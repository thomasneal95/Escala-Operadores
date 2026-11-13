import { read, SSF, utils } from 'xlsx';

// Lê o modelo de relatório de qualidade (public/modelos/
// modelo-relatorio-qualidade.xlsx): o cabeçalho (Operador, Data da avaliação,
// Período avaliado, Avaliador, Nota geral, Resumo — título na coluna A e
// valor na C) e a tabela de tópicos, achada pela linha com "Tipo",
// "Categoria" e "Descrição". Usa a aba "Relatório"; se não houver, a
// primeira aba que tenha a tabela (nunca a aba "Exemplo").

export type TipoTopico = 'positivo' | 'melhoria';
export type Gravidade = 'baixa' | 'media' | 'alta';

export interface TopicoLido {
  tipo: TipoTopico;
  categoria: string;
  descricao: string;
  gravidade: Gravidade | null;
  exemplo: string | null;
}

export interface RelatorioLido {
  operador: string;
  dataAvaliacao: string | null; // YYYY-MM-DD
  periodo: string | null;
  avaliador: string | null;
  nota: number | null;
  resumo: string | null;
  topicos: TopicoLido[];
  // Linhas de tópico com algo preenchido mas sem Tipo/Categoria/Descrição.
  avisos: string[];
}

function normalizar(texto: unknown) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

function texto(valor: unknown) {
  const t = String(valor ?? '').trim();
  return t === '' ? null : t;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

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

function paraNota(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(String(valor ?? '').replace(',', '.'));
  return valor !== null && valor !== '' && Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

function paraTipo(valor: unknown): TipoTopico | null {
  const n = normalizar(valor);
  if (n.startsWith('ponto positivo') || n === 'positivo') return 'positivo';
  if (n.startsWith('ponto de melhoria') || n === 'melhoria' || n === 'falha') return 'melhoria';
  return null;
}

function paraGravidade(valor: unknown): Gravidade | null {
  const n = normalizar(valor);
  if (n === 'baixa') return 'baixa';
  if (n === 'media') return 'media';
  if (n === 'alta') return 'alta';
  return null;
}

type Linha = unknown[];

function acharCabecalhoTopicos(linhas: Linha[]) {
  return linhas.findIndex((l) => {
    const nomes = (l ?? []).map(normalizar);
    return nomes.includes('tipo') && nomes.includes('categoria') && nomes.includes('descricao');
  });
}

export async function lerRelatorioQualidade(arquivo: File): Promise<RelatorioLido> {
  const pasta = read(await arquivo.arrayBuffer(), { type: 'array', dense: true });

  const abas = pasta.SheetNames.filter((n) => normalizar(n) !== 'exemplo');
  const preferida = abas.find((n) => normalizar(n) === 'relatorio');
  const candidatas = preferida ? [preferida, ...abas.filter((n) => n !== preferida)] : abas;

  for (const nomeAba of candidatas) {
    const linhas = utils.sheet_to_json<Linha>(pasta.Sheets[nomeAba], { header: 1, defval: null, raw: true });
    const iCabecalho = acharCabecalhoTopicos(linhas);
    if (iCabecalho < 0) continue;

    // Valor do campo do cabeçalho: colunas B a D (no modelo, a C). A coluna E
    // em diante tem só a dica de preenchimento.
    const campo = (nome: string) => {
      const linha = linhas.slice(0, iCabecalho).find((l) => normalizar(l?.[0]) === nome);
      return linha?.slice(1, 4).find((v) => v !== null && v !== '') ?? null;
    };

    const cabecalho = linhas[iCabecalho].map(normalizar);
    const col = (nome: string) => cabecalho.indexOf(nome);
    const cTipo = col('tipo');
    const cCategoria = col('categoria');
    const cDescricao = col('descricao');
    const cGravidade = col('gravidade');
    const cExemplo = cabecalho.findIndex((n) => n.startsWith('exemplo'));

    const topicos: TopicoLido[] = [];
    const avisos: string[] = [];
    linhas.slice(iCabecalho + 1).forEach((l, i) => {
      if (!l) return;
      const tipo = paraTipo(l[cTipo]);
      const categoria = texto(l[cCategoria]);
      const descricao = texto(l[cDescricao]);
      const exemplo = cExemplo >= 0 ? texto(l[cExemplo]) : null;
      const gravidade = cGravidade >= 0 ? paraGravidade(l[cGravidade]) : null;
      if (!tipo && !categoria && !descricao && !exemplo) return;
      if (!categoria || !descricao) {
        const falta = [!categoria && 'Categoria', !descricao && 'Descrição'].filter(Boolean).join(' e ');
        avisos.push(`Tópico ${i + 1}: falta ${falta}. Complete abaixo ou remova o tópico para poder salvar.`);
      }
      if (!tipo) {
        avisos.push(`Tópico ${i + 1}: falta o Tipo — entrou como Ponto de melhoria. Confira abaixo.`);
      }
      topicos.push({
        tipo: tipo ?? 'melhoria',
        categoria: categoria ?? '',
        descricao: descricao ?? '',
        gravidade: (tipo ?? 'melhoria') === 'melhoria' ? gravidade : null,
        exemplo,
      });
    });

    return {
      operador: texto(campo('operador')) ?? '',
      dataAvaliacao: paraData(campo('data da avaliacao')),
      periodo: texto(campo('periodo avaliado')),
      avaliador: texto(campo('avaliador')),
      nota: paraNota(campo('nota geral')),
      resumo: texto(campo('resumo')),
      topicos,
      avisos,
    };
  }

  throw new Error(
    'Não reconheci o relatório. Use o modelo da aba Qualidade, sem mudar os títulos (a tabela precisa das colunas Tipo, Categoria e Descrição).'
  );
}
