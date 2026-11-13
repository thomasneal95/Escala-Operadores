import type { OperadorQualidade, RelatorioQualidade } from './useRelatoriosQualidade';
import type { Gravidade, TipoTopico } from '../../lib/lerRelatorioQualidade';

// Cálculos do painel da aba Qualidade. Tudo sai dos relatórios já carregados
// (relatórios + tópicos), sem consultas extras.

export function normalizarNome(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function chaveOperador(r: RelatorioQualidade) {
  return r.colaborador_id ?? `n:${normalizarNome(r.operador_nome)}`;
}

// ---------------------------------------------------------------------------
// Datas (strings YYYY-MM-DD, sem fuso)

export function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function paraUtc(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUtc(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function somarDias(iso: string, dias: number) {
  return deUtc(paraUtc(iso) + dias * 86_400_000);
}

export function diasEntre(a: string, b: string) {
  return Math.round((paraUtc(b) - paraUtc(a)) / 86_400_000);
}

// Segunda-feira da semana da data.
function inicioDaSemana(iso: string) {
  const dia = new Date(paraUtc(iso)).getUTCDay(); // 0 = domingo
  return somarDias(iso, -((dia + 6) % 7));
}

// ---------------------------------------------------------------------------
// Filtros

export type PresetPeriodo = '30d' | '90d' | 'mes' | 'mes_anterior' | 'tudo';

export const rotuloPreset: Record<PresetPeriodo, string> = {
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  mes: 'Este mês',
  mes_anterior: 'Mês passado',
  tudo: 'Todo o período',
};

export interface Intervalo {
  inicio: string | null;
  fim: string | null;
}

export function intervaloDoPreset(preset: PresetPeriodo, hoje = hojeIso()): Intervalo {
  const [a, m] = hoje.split('-').map(Number);
  const inicioMes = `${a}-${String(m).padStart(2, '0')}-01`;
  switch (preset) {
    case '30d':
      return { inicio: somarDias(hoje, -29), fim: hoje };
    case '90d':
      return { inicio: somarDias(hoje, -89), fim: hoje };
    case 'mes':
      return { inicio: inicioMes, fim: hoje };
    case 'mes_anterior': {
      const fim = somarDias(inicioMes, -1);
      return { inicio: `${fim.slice(0, 7)}-01`, fim };
    }
    default:
      return { inicio: null, fim: null };
  }
}

// O período imediatamente anterior, do mesmo tamanho (para os deltas).
export function intervaloAnterior(i: Intervalo): Intervalo | null {
  if (!i.inicio || !i.fim) return null;
  const tamanho = diasEntre(i.inicio, i.fim) + 1;
  return { inicio: somarDias(i.inicio, -tamanho), fim: somarDias(i.inicio, -1) };
}

export interface FiltroPainel {
  intervalo: Intervalo;
  equipe: string; // '' = todas
  operador: string; // chave ou ''
}

export function filtrarRelatorios(
  relatorios: RelatorioQualidade[],
  filtro: FiltroPainel,
  equipeDe: (chave: string) => string | null,
  intervalo: Intervalo = filtro.intervalo
) {
  return relatorios.filter((r) => {
    if (intervalo.inicio && r.data_avaliacao < intervalo.inicio) return false;
    if (intervalo.fim && r.data_avaliacao > intervalo.fim) return false;
    const chave = chaveOperador(r);
    if (filtro.operador && chave !== filtro.operador) return false;
    if (filtro.equipe && equipeDe(chave) !== filtro.equipe) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Indicadores

export interface Indicadores {
  relatorios: number;
  operadores: number;
  notaMedia: number | null;
  positivos: number;
  melhorias: number;
  melhoriasPorRelatorio: number | null;
  graves: number; // pontos de melhoria de gravidade alta
  pctGraves: number | null;
}

function media(valores: number[]) {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null;
}

export function indicadores(relatorios: RelatorioQualidade[]): Indicadores {
  const topicos = relatorios.flatMap((r) => r.topicos);
  const melhorias = topicos.filter((t) => t.tipo === 'melhoria');
  const graves = melhorias.filter((t) => t.gravidade === 'alta').length;
  return {
    relatorios: relatorios.length,
    operadores: new Set(relatorios.map(chaveOperador)).size,
    notaMedia: media(relatorios.flatMap((r) => (r.nota === null ? [] : [r.nota]))),
    positivos: topicos.length - melhorias.length,
    melhorias: melhorias.length,
    melhoriasPorRelatorio: relatorios.length ? melhorias.length / relatorios.length : null,
    graves,
    pctGraves: melhorias.length ? graves / melhorias.length : null,
  };
}

// ---------------------------------------------------------------------------
// Evolução da nota

export interface PontoSerie {
  chave: string; // início do balde (YYYY-MM-DD)
  rotulo: string;
  media: number | null;
  relatorios: number;
  minima: number | null;
  maxima: number | null;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function serieDaNota(relatorios: RelatorioQualidade[], intervalo: Intervalo): {
  pontos: PontoSerie[];
  granularidade: 'semana' | 'mes';
} {
  const datas = relatorios.map((r) => r.data_avaliacao).sort();
  const inicio = intervalo.inicio ?? datas[0];
  const fim = intervalo.fim ?? datas[datas.length - 1];
  if (!inicio || !fim) return { pontos: [], granularidade: 'semana' };

  const granularidade = diasEntre(inicio, fim) > 120 ? 'mes' : 'semana';
  const balde = (iso: string) => (granularidade === 'mes' ? `${iso.slice(0, 7)}-01` : inicioDaSemana(iso));

  // Todos os baldes do intervalo, mesmo os vazios (o eixo do tempo não pula).
  const chaves: string[] = [];
  let atual = balde(inicio);
  while (atual <= fim) {
    chaves.push(atual);
    if (granularidade === 'mes') {
      const [a, m] = atual.split('-').map(Number);
      atual = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
    } else {
      atual = somarDias(atual, 7);
    }
  }

  const porBalde = new Map<string, number[]>();
  const contagem = new Map<string, number>();
  for (const r of relatorios) {
    const k = balde(r.data_avaliacao);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
    if (r.nota !== null) porBalde.set(k, [...(porBalde.get(k) ?? []), r.nota]);
  }

  return {
    granularidade,
    pontos: chaves.map((k) => {
      const notas = porBalde.get(k) ?? [];
      const [, m, d] = k.split('-').map(Number);
      return {
        chave: k,
        rotulo: granularidade === 'mes' ? `${MESES[m - 1]}/${k.slice(2, 4)}` : `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        media: media(notas),
        relatorios: contagem.get(k) ?? 0,
        minima: notas.length ? Math.min(...notas) : null,
        maxima: notas.length ? Math.max(...notas) : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Categorias

export interface LinhaCategoria {
  categoria: string;
  total: number;
  operadores: number;
  gravidade: Record<Gravidade, number>;
  semGravidade: number;
}

export function rankingCategorias(relatorios: RelatorioQualidade[], tipo: TipoTopico): LinhaCategoria[] {
  const mapa = new Map<string, LinhaCategoria & { pessoas: Set<string> }>();
  for (const r of relatorios) {
    for (const t of r.topicos) {
      if (t.tipo !== tipo) continue;
      const nome = t.categoria.trim();
      const k = normalizarNome(nome);
      const linha =
        mapa.get(k) ??
        { categoria: nome, total: 0, operadores: 0, gravidade: { baixa: 0, media: 0, alta: 0 }, semGravidade: 0, pessoas: new Set<string>() };
      linha.total++;
      linha.pessoas.add(chaveOperador(r));
      if (t.gravidade) linha.gravidade[t.gravidade]++;
      else linha.semGravidade++;
      mapa.set(k, linha);
    }
  }
  return [...mapa.values()]
    .map(({ pessoas, ...l }) => ({ ...l, operadores: pessoas.size }))
    .sort((a, b) => b.total - a.total || a.categoria.localeCompare(b.categoria));
}

// ---------------------------------------------------------------------------
// Reincidência: a mesma falha no mesmo operador 2+ vezes numa janela de dias.

export interface Reincidencia {
  chave: string;
  categoria: string;
  ocorrencias: string[]; // datas, em ordem
  gravidadeMaxima: Gravidade | null;
  ultima: string;
}

const pesoGravidade: Record<Gravidade, number> = { baixa: 1, media: 2, alta: 3 };

export function reincidencias(relatorios: RelatorioQualidade[], janelaDias = 30, minimo = 2): Reincidencia[] {
  // Uma ocorrência por relatório: a mesma falha citada duas vezes no mesmo
  // relatório não é reincidência (fica a gravidade mais alta).
  const grupos = new Map<string, { chave: string; categoria: string; itens: { data: string; gravidade: Gravidade | null }[] }>();
  for (const r of relatorios) {
    const doRelatorio = new Map<string, { categoria: string; gravidade: Gravidade | null }>();
    for (const t of r.topicos) {
      if (t.tipo !== 'melhoria') continue;
      const k = normalizarNome(t.categoria);
      const atual = doRelatorio.get(k);
      if (!atual || (t.gravidade && (!atual.gravidade || pesoGravidade[t.gravidade] > pesoGravidade[atual.gravidade]))) {
        doRelatorio.set(k, { categoria: t.categoria.trim(), gravidade: t.gravidade ?? atual?.gravidade ?? null });
      }
    }
    for (const [cat, item] of doRelatorio) {
      const k = `${chaveOperador(r)}|${cat}`;
      const g = grupos.get(k) ?? { chave: chaveOperador(r), categoria: item.categoria, itens: [] };
      g.itens.push({ data: r.data_avaliacao, gravidade: item.gravidade });
      grupos.set(k, g);
    }
  }

  const lista: Reincidencia[] = [];
  for (const g of grupos.values()) {
    const itens = g.itens.sort((a, b) => a.data.localeCompare(b.data));
    // Maior sequência dentro da janela (duas pontas a no máximo janelaDias).
    let melhor: typeof itens = [];
    let i = 0;
    for (let j = 0; j < itens.length; j++) {
      while (diasEntre(itens[i].data, itens[j].data) > janelaDias) i++;
      if (j - i + 1 >= melhor.length) melhor = itens.slice(i, j + 1);
    }
    if (melhor.length < minimo) continue;
    const gravidadeMaxima = melhor.reduce<Gravidade | null>(
      (max, it) => (it.gravidade && (!max || pesoGravidade[it.gravidade] > pesoGravidade[max]) ? it.gravidade : max),
      null
    );
    lista.push({
      chave: g.chave,
      categoria: g.categoria,
      ocorrencias: melhor.map((it) => it.data),
      gravidadeMaxima,
      ultima: melhor[melhor.length - 1].data,
    });
  }
  return lista.sort(
    (a, b) =>
      b.ocorrencias.length - a.ocorrencias.length ||
      (pesoGravidade[b.gravidadeMaxima ?? 'baixa'] - pesoGravidade[a.gravidadeMaxima ?? 'baixa']) ||
      b.ultima.localeCompare(a.ultima)
  );
}

// ---------------------------------------------------------------------------
// Por operador

export interface LinhaOperador {
  chave: string;
  nome: string;
  equipe: string | null;
  relatorios: number;
  notaMedia: number | null;
  notas: { data: string; nota: number }[];
  positivos: number;
  melhorias: number;
  graves: number;
  principalFalha: string | null;
  principalForca: string | null;
  ultima: string;
  tendencia: number | null; // última nota − primeira nota do período
}

export function porOperador(
  relatorios: RelatorioQualidade[],
  nomeDe: (chave: string, fallback: string) => string,
  equipeDe: (chave: string) => string | null
): LinhaOperador[] {
  const grupos = new Map<string, RelatorioQualidade[]>();
  for (const r of relatorios) grupos.set(chaveOperador(r), [...(grupos.get(chaveOperador(r)) ?? []), r]);

  return [...grupos].map(([chave, lista]) => {
    const ordenados = [...lista].sort((a, b) => a.data_avaliacao.localeCompare(b.data_avaliacao));
    const notas = ordenados.flatMap((r) => (r.nota === null ? [] : [{ data: r.data_avaliacao, nota: r.nota }]));
    const topicos = ordenados.flatMap((r) => r.topicos);
    const maisFrequente = (tipo: TipoTopico) => rankingCategorias(ordenados, tipo)[0]?.categoria ?? null;
    return {
      chave,
      nome: nomeDe(chave, ordenados[0].operador_nome),
      equipe: equipeDe(chave),
      relatorios: ordenados.length,
      notaMedia: media(notas.map((n) => n.nota)),
      notas,
      positivos: topicos.filter((t) => t.tipo === 'positivo').length,
      melhorias: topicos.filter((t) => t.tipo === 'melhoria').length,
      graves: topicos.filter((t) => t.tipo === 'melhoria' && t.gravidade === 'alta').length,
      principalFalha: maisFrequente('melhoria'),
      principalForca: maisFrequente('positivo'),
      ultima: ordenados[ordenados.length - 1].data_avaliacao,
      tendencia: notas.length >= 2 ? notas[notas.length - 1].nota - notas[0].nota : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Mapa de calor: operadores × categorias de melhoria

export interface MapaDeCalor {
  categorias: string[];
  linhas: { chave: string; nome: string; valores: number[]; total: number }[];
  maximo: number;
}

export function mapaDeCalor(
  relatorios: RelatorioQualidade[],
  nomeDe: (chave: string, fallback: string) => string,
  maxCategorias = 8,
  maxOperadores = 12
): MapaDeCalor {
  const categorias = rankingCategorias(relatorios, 'melhoria').slice(0, maxCategorias).map((c) => c.categoria);
  const indice = new Map(categorias.map((c, i) => [normalizarNome(c), i]));
  const linhas = new Map<string, { chave: string; nome: string; valores: number[]; total: number }>();
  for (const r of relatorios) {
    for (const t of r.topicos) {
      if (t.tipo !== 'melhoria') continue;
      const i = indice.get(normalizarNome(t.categoria));
      if (i === undefined) continue;
      const k = chaveOperador(r);
      const linha = linhas.get(k) ?? { chave: k, nome: nomeDe(k, r.operador_nome), valores: categorias.map(() => 0), total: 0 };
      linha.valores[i]++;
      linha.total++;
      linhas.set(k, linha);
    }
  }
  const ordenadas = [...linhas.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)).slice(0, maxOperadores);
  return { categorias, linhas: ordenadas, maximo: Math.max(0, ...ordenadas.flatMap((l) => l.valores)) };
}

export function equipesDosOperadores(operadores: OperadorQualidade[]) {
  return [...new Set(operadores.flatMap((o) => (o.equipe ? [o.equipe] : [])))].sort((a, b) => a.localeCompare(b));
}
