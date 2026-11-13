import { useMemo, useState } from 'react';
import type { OperadorQualidade, RelatorioQualidade } from '../../../features/qualidade/useRelatoriosQualidade';
import {
  chaveOperador,
  equipesDosOperadores,
  filtrarRelatorios,
  indicadores,
  intervaloAnterior,
  intervaloDoPreset,
  mapaDeCalor,
  porOperador,
  rankingCategorias,
  reincidencias,
  rotuloPreset,
  serieDaNota,
  type FiltroPainel,
  type Indicadores,
  type LinhaOperador,
  type PresetPeriodo,
  type Reincidencia,
} from '../../../features/qualidade/analiseQualidade';
import {
  BarraSegmentada,
  BarrasRanking,
  COR,
  COR_GRAVIDADE,
  Cartao,
  Dica,
  GraficoNota,
  Legenda,
  MiniDivergente,
  Sparkline,
  corDoCalor,
  fmt,
  useDica,
} from './graficos';
import { FichaOperador } from './FichaOperador';

const JANELA_REINCIDENCIA = 30;

type Ordem = 'nota' | 'relatorios' | 'melhorias' | 'tendencia' | 'nome';

export function PainelQualidade({
  relatorios,
  operadores,
  onVerRelatorios,
}: {
  relatorios: RelatorioQualidade[];
  operadores: OperadorQualidade[];
  onVerRelatorios: (chaveOperador: string) => void;
}) {
  const [preset, setPreset] = useState<PresetPeriodo>('90d');
  const [equipe, setEquipe] = useState('');
  const [operador, setOperador] = useState('');
  const [focoFalha, setFocoFalha] = useState<string | null>(null);
  const [fichaAberta, setFichaAberta] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>('nota');
  const { dica, mostrar, mostrarEm, esconder } = useDica();

  // Cadastro: nome e equipe por chave (relatório sem vínculo usa o nome do arquivo).
  const porId = useMemo(() => new Map(operadores.map((o) => [o.id, o])), [operadores]);
  const nomeDe = (chave: string, fallback: string) => porId.get(chave)?.nome ?? fallback;
  const equipeDe = (chave: string) => porId.get(chave)?.equipe ?? null;

  const intervalo = intervaloDoPreset(preset);
  const filtro: FiltroPainel = { intervalo, equipe, operador };
  const anterior = intervaloAnterior(intervalo);

  const doPeriodo = useMemo(
    () => filtrarRelatorios(relatorios, filtro, equipeDe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relatorios, preset, equipe, operador, porId]
  );
  const doAnterior = useMemo(
    () => (anterior ? filtrarRelatorios(relatorios, filtro, equipeDe, anterior) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relatorios, preset, equipe, operador, porId]
  );

  const kpi = indicadores(doPeriodo);
  const kpiAnterior = doAnterior && doAnterior.length > 0 ? indicadores(doAnterior) : null;
  const serie = serieDaNota(doPeriodo, intervalo);
  const falhas = rankingCategorias(doPeriodo, 'melhoria');
  const forcas = rankingCategorias(doPeriodo, 'positivo');
  const alertas = reincidencias(doPeriodo, JANELA_REINCIDENCIA);
  const calor = mapaDeCalor(doPeriodo, nomeDe);
  const linhasOperadores = porOperador(doPeriodo, nomeDe, equipeDe);
  const equipes = equipesDosOperadores(operadores);

  const opcoesOperador = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of relatorios) {
      const k = chaveOperador(r);
      if (equipe && equipeDe(k) !== equipe) continue;
      mapa.set(k, nomeDe(k, r.operador_nome));
    }
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relatorios, equipe, porId]);

  // Operadores que têm a falha em foco (para a tabela).
  const comFalhaEmFoco = useMemo(() => {
    if (!focoFalha) return null;
    const alvo = focoFalha;
    return new Set(
      doPeriodo
        .filter((r) => r.topicos.some((t) => t.tipo === 'melhoria' && t.categoria.trim().toLowerCase() === alvo.toLowerCase()))
        .map(chaveOperador)
    );
  }, [doPeriodo, focoFalha]);

  const tabela = linhasOperadores
    .filter((l) => !comFalhaEmFoco || comFalhaEmFoco.has(l.chave))
    .sort((a, b) => {
      switch (ordem) {
        case 'relatorios':
          return b.relatorios - a.relatorios;
        case 'melhorias':
          return b.melhorias - a.melhorias;
        case 'tendencia':
          return (b.tendencia ?? -99) - (a.tendencia ?? -99);
        case 'nome':
          return a.nome.localeCompare(b.nome);
        default:
          return (b.notaMedia ?? -1) - (a.notaMedia ?? -1);
      }
    });
  const maxTopicos = Math.max(1, ...linhasOperadores.flatMap((l) => [l.positivos, l.melhorias]));

  const semDados = relatorios.length === 0;
  const fichaLinha = fichaAberta ? linhasOperadores.find((l) => l.chave === fichaAberta) ?? null : null;

  function limparFiltros() {
    setPreset('90d');
    setEquipe('');
    setOperador('');
    setFocoFalha(null);
  }

  const filtrosAtivos = preset !== '90d' || equipe || operador || focoFalha;

  if (semDados) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <p className="font-display text-lg font-semibold text-tinta">O painel aparece com os primeiros relatórios</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Envie relatórios na aba <strong>Relatórios</strong>. A partir deles o painel mostra a evolução das notas, as falhas que
          se repetem, os pontos fortes e a situação de cada operador.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <Dica dica={dica} />

      {/* Filtros — uma linha, acima de tudo, valem para o painel inteiro */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="Período">
          {(Object.keys(rotuloPreset) as PresetPeriodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                preset === p ? 'bg-tinta text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-tinta'
              }`}
            >
              {rotuloPreset[p]}
            </button>
          ))}
        </div>
        {equipes.length > 0 && (
          <select
            value={equipe}
            onChange={(e) => {
              setEquipe(e.target.value);
              setOperador('');
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-tinta"
            aria-label="Equipe"
          >
            <option value="">Todas as equipes</option>
            {equipes.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        )}
        <select
          value={operador}
          onChange={(e) => setOperador(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-tinta"
          aria-label="Operador"
        >
          <option value="">Todos os operadores</option>
          {opcoesOperador.map(([k, nome]) => (
            <option key={k} value={k}>
              {nome}
            </option>
          ))}
        </select>
        {focoFalha && (
          <button
            onClick={() => setFocoFalha(null)}
            className="flex items-center gap-1.5 rounded-full bg-[#FDEEE4] px-3 py-1.5 text-xs font-medium text-[#8A3712] hover:bg-[#FBE0CF]"
          >
            Foco: {focoFalha}
            <span aria-hidden>✕</span>
          </button>
        )}
        {filtrosAtivos && (
          <button onClick={limparFiltros} className="text-sm font-medium text-slate-500 hover:text-tinta">
            Limpar filtros
          </button>
        )}
      </div>

      {doPeriodo.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Nenhum relatório com esses filtros. Experimente <button onClick={() => setPreset('tudo')} className="font-medium text-ceruleo hover:underline">ver todo o período</button>.
        </div>
      ) : (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl bg-tinta p-5 text-white shadow-sm sm:col-span-2 xl:col-span-1">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5" />
              <p className="text-xs font-medium uppercase tracking-wider text-white/60">Nota média</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="font-display text-5xl font-semibold leading-none">{fmt.nota(kpi.notaMedia)}</p>
                <Sparkline valores={serie.pontos.map((p) => p.media)} largura={110} altura={36} cor="#7FD4AE" traco="rgba(255,255,255,0.35)" />
              </div>
              <Delta
                atual={kpi.notaMedia}
                anterior={kpiAnterior?.notaMedia ?? null}
                melhorSobe
                formato={(v) => fmt.dec(v)}
                escuro
              />
            </div>
            <Tile
              rotulo="Relatórios avaliados"
              valor={fmt.int(kpi.relatorios)}
              rodape={`${fmt.int(kpi.operadores)} operador${kpi.operadores === 1 ? '' : 'es'} avaliado${kpi.operadores === 1 ? '' : 's'}`}
              delta={<Delta atual={kpi.relatorios} anterior={kpiAnterior?.relatorios ?? null} formato={(v) => fmt.int(v)} neutro />}
            />
            <Tile
              rotulo="Pontos de melhoria por relatório"
              valor={fmt.dec(kpi.melhoriasPorRelatorio)}
              rodape={`${fmt.int(kpi.melhorias)} no total · ${fmt.int(kpi.positivos)} positivos`}
              delta={
                <Delta
                  atual={kpi.melhoriasPorRelatorio}
                  anterior={kpiAnterior?.melhoriasPorRelatorio ?? null}
                  formato={(v) => fmt.dec(v)}
                />
              }
            />
            <TileGraves kpi={kpi} anterior={kpiAnterior} />
          </div>

          {/* Evolução + equilíbrio */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Cartao
              className="xl:col-span-2"
              titulo="Evolução da nota"
              subtitulo={`Média ${serie.granularidade === 'mes' ? 'mensal' : 'semanal'} das avaliações · escala de 0 a 10`}
            >
              <GraficoNota
                pontos={serie.pontos}
                granularidade={serie.granularidade}
                mediaPeriodo={kpi.notaMedia}
                onDica={mostrar}
                onSairDica={esconder}
              />
            </Cartao>
            <Cartao titulo="Equilíbrio do feedback" subtitulo="Como se dividem os tópicos dos relatórios">
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Tipo de tópico</p>
                  <BarraSegmentada
                    partes={[
                      { rotulo: 'Pontos positivos', valor: kpi.positivos, cor: COR.positivo },
                      { rotulo: 'Pontos de melhoria', valor: kpi.melhorias, cor: COR.melhoria },
                    ]}
                    onDica={mostrarEm}
                    onSairDica={esconder}
                  />
                  <div className="mt-2">
                    <Legenda
                      itens={[
                        { rotulo: 'Positivos', cor: COR.positivo, valor: fmt.int(kpi.positivos) },
                        { rotulo: 'Melhoria', cor: COR.melhoria, valor: fmt.int(kpi.melhorias) },
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Gravidade dos pontos de melhoria</p>
                  {(() => {
                    const g = falhas.reduce(
                      (acc, f) => ({
                        baixa: acc.baixa + f.gravidade.baixa,
                        media: acc.media + f.gravidade.media,
                        alta: acc.alta + f.gravidade.alta,
                        sem: acc.sem + f.semGravidade,
                      }),
                      { baixa: 0, media: 0, alta: 0, sem: 0 }
                    );
                    return (
                      <>
                        <BarraSegmentada
                          partes={[
                            { rotulo: 'Baixa', valor: g.baixa, cor: COR_GRAVIDADE.baixa, textoClaro: false },
                            { rotulo: 'Média', valor: g.media, cor: COR_GRAVIDADE.media },
                            { rotulo: 'Alta', valor: g.alta, cor: COR_GRAVIDADE.alta },
                            { rotulo: 'Sem gravidade', valor: g.sem, cor: '#C5CCD3', textoClaro: false },
                          ]}
                          onDica={mostrarEm}
                          onSairDica={esconder}
                        />
                        <div className="mt-2">
                          <Legenda
                            itens={[
                              { rotulo: 'Baixa', cor: COR_GRAVIDADE.baixa, valor: fmt.int(g.baixa) },
                              { rotulo: 'Média', cor: COR_GRAVIDADE.media, valor: fmt.int(g.media) },
                              { rotulo: 'Alta', cor: COR_GRAVIDADE.alta, valor: fmt.int(g.alta) },
                              ...(g.sem > 0 ? [{ rotulo: 'Sem gravidade', cor: '#C5CCD3', valor: fmt.int(g.sem) }] : []),
                            ]}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </Cartao>
          </div>

          {/* Falhas e forças */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Cartao
              titulo="Falhas mais recorrentes"
              subtitulo="Clique numa falha para ver quem a comete no mapa e na tabela"
            >
              <BarrasRanking
                cor={COR.melhoria}
                selecionada={focoFalha}
                onSelecionar={(k) => setFocoFalha(focoFalha === k ? null : k)}
                onDica={mostrarEm}
                onSairDica={esconder}
                vazio="Nenhum ponto de melhoria no período."
                linhas={falhas.slice(0, 8).map((f) => ({
                  chave: f.categoria,
                  rotulo: f.categoria,
                  valor: f.total,
                  detalhe: `${f.operadores} operador${f.operadores === 1 ? '' : 'es'}`,
                  dica: {
                    titulo: f.categoria,
                    linhas: [
                      { rotulo: 'Ocorrências', valor: fmt.int(f.total), cor: COR.melhoria },
                      { rotulo: 'Operadores', valor: fmt.int(f.operadores) },
                      { rotulo: 'Gravidade alta', valor: fmt.int(f.gravidade.alta), cor: COR_GRAVIDADE.alta },
                      { rotulo: 'Gravidade média', valor: fmt.int(f.gravidade.media), cor: COR_GRAVIDADE.media },
                      { rotulo: 'Gravidade baixa', valor: fmt.int(f.gravidade.baixa), cor: COR_GRAVIDADE.baixa },
                    ],
                  },
                }))}
              />
              {falhas.length > 8 && (
                <p className="mt-2 px-2 text-xs text-slate-400">
                  + {falhas.length - 8} outras categorias com {fmt.int(falhas.slice(8).reduce((s, f) => s + f.total, 0))} ocorrências
                </p>
              )}
            </Cartao>
            <Cartao titulo="Pontos fortes" subtitulo="O que os operadores mais fazem bem">
              <BarrasRanking
                cor={COR.positivo}
                onDica={mostrarEm}
                onSairDica={esconder}
                vazio="Nenhum ponto positivo no período."
                linhas={forcas.slice(0, 8).map((f) => ({
                  chave: f.categoria,
                  rotulo: f.categoria,
                  valor: f.total,
                  detalhe: `${f.operadores} operador${f.operadores === 1 ? '' : 'es'}`,
                  dica: {
                    titulo: f.categoria,
                    linhas: [
                      { rotulo: 'Ocorrências', valor: fmt.int(f.total), cor: COR.positivo },
                      { rotulo: 'Operadores', valor: fmt.int(f.operadores) },
                    ],
                  },
                }))}
              />
              {forcas.length > 8 && (
                <p className="mt-2 px-2 text-xs text-slate-400">+ {forcas.length - 8} outras categorias</p>
              )}
            </Cartao>
          </div>

          {/* Reincidência */}
          <Cartao
            titulo="Falhas que se repetem"
            subtitulo={`A mesma falha no mesmo operador 2 ou mais vezes em até ${JANELA_REINCIDENCIA} dias`}
            acao={
              alertas.length > 0 ? (
                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                  <IconeAlerta /> {alertas.length} alerta{alertas.length === 1 ? '' : 's'}
                </span>
              ) : undefined
            }
          >
            {alertas.length === 0 ? (
              <p className="flex items-center gap-2 py-3 text-sm text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-esmeralda-light text-esmeralda-dark">✓</span>
                Nenhuma falha repetida no período.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {alertas.slice(0, 9).map((a) => (
                  <CartaoReincidencia
                    key={`${a.chave}|${a.categoria}`}
                    alerta={a}
                    nome={nomeDe(a.chave, doPeriodo.find((r) => chaveOperador(r) === a.chave)?.operador_nome ?? '')}
                    onAbrir={() => setFichaAberta(a.chave)}
                  />
                ))}
              </div>
            )}
            {alertas.length > 9 && <p className="mt-3 text-xs text-slate-400">+ {alertas.length - 9} outros alertas na tabela de operadores.</p>}
          </Cartao>

          {/* Mapa de calor */}
          {calor.linhas.length > 0 && calor.categorias.length > 0 && (
            <Cartao
              titulo="Mapa de falhas por operador"
              subtitulo="Quantas vezes cada falha apareceu para cada operador · as mais frequentes"
              acao={
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  menos
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className="h-3 w-4 rounded-sm" style={{ background: corDoCalor(i, 5).fundo }} />
                    ))}
                  </div>
                  mais
                </div>
              }
            >
              <div className="-mx-1 overflow-x-auto px-1">
                <div
                  className="grid min-w-[560px] gap-0.5"
                  style={{ gridTemplateColumns: `minmax(120px, 1.4fr) repeat(${calor.categorias.length}, minmax(52px, 1fr))` }}
                >
                  <div />
                  {calor.categorias.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFocoFalha(focoFalha === c ? null : c)}
                      className={`flex items-end justify-center px-1 pb-1.5 text-center text-[11px] leading-tight transition ${
                        focoFalha === c ? 'font-semibold text-tinta' : focoFalha ? 'text-slate-300' : 'text-slate-500 hover:text-tinta'
                      }`}
                      title={c}
                    >
                      <span className="line-clamp-2">{c}</span>
                    </button>
                  ))}
                  {calor.linhas.map((l) => (
                    <FragmentoLinhaCalor
                      key={l.chave}
                      nome={l.nome}
                      valores={l.valores}
                      categorias={calor.categorias}
                      maximo={calor.maximo}
                      foco={focoFalha}
                      onAbrir={() => setFichaAberta(l.chave)}
                      onDica={mostrarEm}
                      onSairDica={esconder}
                    />
                  ))}
                </div>
              </div>
            </Cartao>
          )}

          {/* Operadores */}
          <Cartao
            titulo="Operadores"
            subtitulo={
              comFalhaEmFoco
                ? `Só quem teve "${focoFalha}" no período · clique numa linha para ver a ficha`
                : 'Clique numa linha para ver a ficha completa do operador'
            }
            acao={
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-tinta"
                aria-label="Ordenar por"
              >
                <option value="nota">Maior nota</option>
                <option value="tendencia">Melhor evolução</option>
                <option value="melhorias">Mais pontos de melhoria</option>
                <option value="relatorios">Mais relatórios</option>
                <option value="nome">Nome</option>
              </select>
            }
          >
            <TabelaOperadores linhas={tabela} maxTopicos={maxTopicos} alertas={alertas} onAbrir={setFichaAberta} />
          </Cartao>
        </>
      )}

      {fichaLinha && (
        <FichaOperador
          linha={fichaLinha}
          relatorios={doPeriodo.filter((r) => chaveOperador(r) === fichaLinha.chave)}
          alertas={alertas.filter((a) => a.chave === fichaLinha.chave)}
          periodo={rotuloPreset[preset]}
          onFechar={() => setFichaAberta(null)}
          onVerRelatorios={() => onVerRelatorios(fichaLinha.chave)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Tile({ rotulo, valor, rodape, delta }: { rotulo: string; valor: string; rodape: string; delta?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,31,56,0.04)]">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className="mt-1 font-display text-4xl font-semibold leading-tight text-tinta">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{rodape}</p>
      {delta}
    </div>
  );
}

function TileGraves({ kpi, anterior }: { kpi: Indicadores; anterior: Indicadores | null }) {
  const pct = kpi.pctGraves ?? 0;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,31,56,0.04)]">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Falhas de gravidade alta</p>
      <p className="mt-1 font-display text-4xl font-semibold leading-tight text-tinta">{fmt.pct(kpi.pctGraves)}</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-[#FBE6D6]" aria-hidden>
        <div className="h-1.5 rounded-full" style={{ width: `${pct * 100}%`, background: COR_GRAVIDADE.alta }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {fmt.int(kpi.graves)} de {fmt.int(kpi.melhorias)} pontos de melhoria
      </p>
      <Delta atual={kpi.pctGraves} anterior={anterior?.pctGraves ?? null} formato={(v) => `${Math.round(v * 100)} p.p.`} />
    </div>
  );
}

// Variação contra o período anterior de mesmo tamanho. A cor diz se mudou
// para melhor ou pior (com seta e texto, nunca só a cor).
function Delta({
  atual,
  anterior,
  formato,
  melhorSobe = false,
  neutro = false,
  escuro = false,
}: {
  atual: number | null;
  anterior: number | null;
  formato: (v: number) => string;
  melhorSobe?: boolean;
  neutro?: boolean;
  escuro?: boolean;
}) {
  const base = escuro ? 'text-white/60' : 'text-slate-400';
  if (atual === null || anterior === null) {
    return <p className={`mt-2 text-xs ${base}`}>sem período anterior para comparar</p>;
  }
  const diff = atual - anterior;
  if (Math.abs(diff) < 1e-9) return <p className={`mt-2 text-xs ${base}`}>= igual ao período anterior</p>;
  const sobe = diff > 0;
  const bom = neutro ? null : sobe === melhorSobe;
  const cor = bom === null ? (escuro ? 'text-white/80' : 'text-slate-600') : bom ? (escuro ? 'text-[#7FD4AE]' : 'text-[#0F7A3D]') : escuro ? 'text-[#FFB4A8]' : 'text-[#B42318]';
  return (
    <p className={`mt-2 text-xs ${base}`}>
      <span className={`font-semibold ${cor}`}>
        {sobe ? '▲' : '▼'} {formato(Math.abs(diff))}
      </span>{' '}
      vs período anterior
    </p>
  );
}

function IconeAlerta() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
      <path d="M8.6 3.3a1.6 1.6 0 0 1 2.8 0l6.1 10.8a1.6 1.6 0 0 1-1.4 2.4H3.9a1.6 1.6 0 0 1-1.4-2.4L8.6 3.3ZM10 7a.9.9 0 0 0-.9.9v3.4a.9.9 0 0 0 1.8 0V7.9A.9.9 0 0 0 10 7Zm0 6.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}

const rotuloGravidade = { baixa: 'Baixa', media: 'Média', alta: 'Alta' } as const;

function CartaoReincidencia({ alerta: a, nome, onAbrir }: { alerta: Reincidencia; nome: string; onAbrir: () => void }) {
  const primeira = a.ocorrencias[0];
  const span = Math.max(1, (new Date(a.ultima).getTime() - new Date(primeira).getTime()) / 86_400_000);
  const grave = a.gravidadeMaxima === 'alta';
  return (
    <button
      onClick={onAbrir}
      className="group rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-tinta">{nome}</p>
          <p className="mt-0.5 truncate text-sm text-slate-600">{a.categoria}</p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            grave ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
          }`}
        >
          <IconeAlerta />
          {a.ocorrencias.length}×
        </span>
      </div>
      {/* Linha do tempo das ocorrências dentro da janela */}
      <div className="relative mt-4 h-4">
        <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-slate-200" />
        {a.ocorrencias.map((d, i) => {
          const pos = ((new Date(d).getTime() - new Date(primeira).getTime()) / 86_400_000 / span) * 100;
          return (
            <span
              key={`${d}-${i}`}
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{ left: `calc(4px + (100% - 8px) * ${a.ocorrencias.length === 1 ? 0.5 : pos / 100})`, background: COR.melhoria }}
              title={fmt.data(d)}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums text-slate-400">
        <span>{fmt.dataCurta(primeira)}</span>
        <span>{fmt.dataCurta(a.ultima)}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {a.ocorrencias.length} vezes em {Math.round(span) || 1} dia{Math.round(span) === 1 ? '' : 's'}
        {a.gravidadeMaxima && <> · gravidade até {rotuloGravidade[a.gravidadeMaxima].toLowerCase()}</>}
        <span className="ml-1 text-ceruleo opacity-0 transition group-hover:opacity-100">Ver ficha →</span>
      </p>
    </button>
  );
}

function FragmentoLinhaCalor({
  nome,
  valores,
  categorias,
  maximo,
  foco,
  onAbrir,
  onDica,
  onSairDica,
}: {
  nome: string;
  valores: number[];
  categorias: string[];
  maximo: number;
  foco: string | null;
  onAbrir: () => void;
  onDica: ReturnType<typeof useDica>['mostrarEm'];
  onSairDica: () => void;
}) {
  return (
    <>
      <button onClick={onAbrir} className="truncate py-1 pr-2 text-left text-sm text-tinta hover:text-ceruleo" title={nome}>
        {nome}
      </button>
      {valores.map((v, i) => {
        const { fundo, texto } = corDoCalor(v, maximo);
        const apagado = foco && foco !== categorias[i];
        return (
          <div
            key={categorias[i]}
            tabIndex={0}
            onPointerEnter={(e) =>
              onDica(e.currentTarget, {
                titulo: nome,
                linhas: [{ rotulo: categorias[i], valor: `${v}×`, cor: v > 0 ? fundo : undefined }],
              })
            }
            onPointerLeave={onSairDica}
            className={`flex h-9 items-center justify-center rounded-[4px] text-xs font-semibold tabular-nums outline-none transition hover:ring-2 hover:ring-tinta/20 focus-visible:ring-2 focus-visible:ring-tinta/30 ${
              apagado ? 'opacity-30' : ''
            }`}
            style={{ background: fundo, color: texto }}
          >
            {v > 0 ? v : ''}
          </div>
        );
      })}
    </>
  );
}

function TabelaOperadores({
  linhas,
  maxTopicos,
  alertas,
  onAbrir,
}: {
  linhas: LinhaOperador[];
  maxTopicos: number;
  alertas: Reincidencia[];
  onAbrir: (chave: string) => void;
}) {
  const alertasPor = new Map<string, number>();
  for (const a of alertas) alertasPor.set(a.chave, (alertasPor.get(a.chave) ?? 0) + 1);

  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-slate-400">Nenhum operador.</p>;
  return (
    <div className="-mx-4 overflow-x-auto sm:-mx-5">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
            <th className="px-4 py-2 font-medium sm:px-5">Operador</th>
            <th className="px-2 py-2 text-right font-medium">Nota</th>
            <th className="px-2 py-2 font-medium">Evolução</th>
            <th className="px-2 py-2 font-medium">
              <span style={{ color: COR.melhoria }}>●</span> Melhoria · Positivo <span style={{ color: COR.positivo }}>●</span>
            </th>
            <th className="px-2 py-2 font-medium">Principal falha</th>
            <th className="px-4 py-2 text-right font-medium sm:px-5">Última</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((l) => (
            <tr key={l.chave} onClick={() => onAbrir(l.chave)} className="cursor-pointer transition hover:bg-slate-50">
              <td className="px-4 py-2.5 sm:px-5">
                <p className="font-medium text-tinta">{l.nome}</p>
                <p className="text-xs text-slate-400">
                  {l.equipe ?? 'Sem equipe'} · {l.relatorios} relatório{l.relatorios === 1 ? '' : 's'}
                  {alertasPor.get(l.chave) && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-red-700">
                      <IconeAlerta /> {alertasPor.get(l.chave)} repetida{(alertasPor.get(l.chave) ?? 0) > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
              </td>
              <td className="px-2 py-2.5 text-right">
                <span className="font-display text-base font-semibold tabular-nums text-tinta">{fmt.nota(l.notaMedia)}</span>
                {l.tendencia !== null && Math.abs(l.tendencia) >= 0.05 && (
                  <span className={`ml-1.5 text-xs font-medium ${l.tendencia > 0 ? 'text-[#0F7A3D]' : 'text-[#B42318]'}`}>
                    {l.tendencia > 0 ? '▲' : '▼'}
                    {fmt.dec(Math.abs(l.tendencia))}
                  </span>
                )}
              </td>
              <td className="px-2 py-2.5">
                <Sparkline valores={l.notas.map((n) => n.nota)} largura={84} altura={24} />
              </td>
              <td className="px-2 py-2.5">
                <MiniDivergente positivos={l.positivos} melhorias={l.melhorias} maximo={maxTopicos} />
              </td>
              <td className="px-2 py-2.5">
                {l.principalFalha ? (
                  <span className="inline-block max-w-44 truncate rounded-full bg-[#FDEEE4] px-2 py-0.5 text-xs text-[#8A3712]">
                    {l.principalFalha}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-500 sm:px-5">{fmt.data(l.ultima)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
