import { useEffect } from 'react';
import type { RelatorioQualidade } from '../../../features/qualidade/useRelatoriosQualidade';
import { rankingCategorias, type LinhaOperador, type Reincidencia } from '../../../features/qualidade/analiseQualidade';
import { COR, COR_GRAVIDADE, fmt } from './graficos';

// Painel lateral com o resumo de um operador no período filtrado.
export function FichaOperador({
  linha,
  relatorios,
  alertas,
  periodo,
  onFechar,
  onVerRelatorios,
}: {
  linha: LinhaOperador;
  relatorios: RelatorioQualidade[];
  alertas: Reincidencia[];
  periodo: string;
  onFechar: () => void;
  onVerRelatorios: () => void;
}) {
  useEffect(() => {
    const fechar = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [onFechar]);

  const falhas = rankingCategorias(relatorios, 'melhoria').slice(0, 5);
  const forcas = rankingCategorias(relatorios, 'positivo').slice(0, 5);
  const historico = [...relatorios].sort((a, b) => b.data_avaliacao.localeCompare(a.data_avaliacao));
  const maxCat = Math.max(1, ...falhas.map((f) => f.total), ...forcas.map((f) => f.total));

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Ficha de ${linha.nome}`}>
      <button className="absolute inset-0 bg-tinta/30 backdrop-blur-[1px]" onClick={onFechar} aria-label="Fechar" />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-nuvem shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-ceruleo">Ficha do operador</p>
              <h2 className="mt-0.5 font-display text-xl font-semibold text-tinta">{linha.nome}</h2>
              <p className="text-xs text-slate-500">
                {linha.equipe ?? 'Sem equipe'} · {periodo.toLowerCase()}
              </p>
            </div>
            <button onClick={onFechar} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-tinta" aria-label="Fechar">
              ✕
            </button>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            <Numero rotulo="Nota média" valor={fmt.nota(linha.notaMedia)} destaque />
            <Numero rotulo="Relatórios" valor={fmt.int(linha.relatorios)} />
            <Numero rotulo="Falhas graves" valor={fmt.int(linha.graves)} />
          </div>

          <Bloco titulo="Notas no período">
            <LinhaDeNotas notas={linha.notas} />
          </Bloco>

          {alertas.length > 0 && (
            <Bloco titulo="Falhas que se repetem">
              <ul className="space-y-1.5">
                {alertas.map((a) => (
                  <li key={a.categoria} className="flex items-center justify-between gap-3 rounded-md bg-red-50/60 px-3 py-2 text-sm">
                    <span className="text-tinta">{a.categoria}</span>
                    <span className="shrink-0 text-xs font-semibold text-red-700">
                      ⚠ {a.ocorrencias.length}× · {a.ocorrencias.map(fmt.dataCurta).join(', ')}
                    </span>
                  </li>
                ))}
              </ul>
            </Bloco>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Bloco titulo={`Pontos de melhoria (${linha.melhorias})`}>
              <ListaCategorias itens={falhas} cor={COR.melhoria} maximo={maxCat} vazio="Nenhum." />
            </Bloco>
            <Bloco titulo={`Pontos positivos (${linha.positivos})`}>
              <ListaCategorias itens={forcas} cor={COR.positivo} maximo={maxCat} vazio="Nenhum." />
            </Bloco>
          </div>

          <Bloco titulo="Relatórios">
            <ul className="divide-y divide-slate-100">
              {historico.map((r) => {
                const pos = r.topicos.filter((t) => t.tipo === 'positivo').length;
                const mel = r.topicos.filter((t) => t.tipo === 'melhoria');
                const graves = mel.filter((t) => t.gravidade === 'alta').length;
                return (
                  <li key={r.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-tinta">
                        {fmt.data(r.data_avaliacao)}
                        {r.avaliador && <span className="font-normal text-slate-400"> · {r.avaliador}</span>}
                      </p>
                      <span className="font-display text-base font-semibold tabular-nums text-tinta">{fmt.nota(r.nota)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="text-[#0F7A3D]">{pos} positivo{pos === 1 ? '' : 's'}</span> ·{' '}
                      <span className="text-[#8A3712]">{mel.length} de melhoria</span>
                      {graves > 0 && <span className="font-medium text-red-700"> · {graves} grave{graves === 1 ? '' : 's'}</span>}
                    </p>
                    {r.resumo && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{r.resumo}</p>}
                  </li>
                );
              })}
            </ul>
            <button onClick={onVerRelatorios} className="mt-3 text-sm font-medium text-ceruleo hover:underline">
              Abrir os relatórios deste operador →
            </button>
          </Bloco>
        </div>
      </aside>
    </div>
  );
}

function Numero({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${destaque ? 'bg-tinta text-white' : 'border border-slate-200 bg-white'}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wider ${destaque ? 'text-white/60' : 'text-slate-500'}`}>{rotulo}</p>
      <p className={`mt-0.5 font-display text-2xl font-semibold ${destaque ? 'text-white' : 'text-tinta'}`}>{valor}</p>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{titulo}</h3>
      {children}
    </section>
  );
}

function ListaCategorias({
  itens,
  cor,
  maximo,
  vazio,
}: {
  itens: { categoria: string; total: number; gravidade: Record<'baixa' | 'media' | 'alta', number> }[];
  cor: string;
  maximo: number;
  vazio: string;
}) {
  if (itens.length === 0) return <p className="text-sm text-slate-400">{vazio}</p>;
  return (
    <ul className="space-y-2.5">
      {itens.map((i) => (
        <li key={i.categoria}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-tinta">{i.categoria}</span>
            <span className="text-xs font-semibold tabular-nums text-tinta">{i.total}×</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full" style={{ width: `${(i.total / maximo) * 100}%`, background: cor }} />
          </div>
          {i.gravidade.alta > 0 && (
            <p className="mt-0.5 text-[11px]" style={{ color: COR_GRAVIDADE.alta }}>
              {i.gravidade.alta} de gravidade alta
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

// Uma bolinha por relatório, na ordem das datas, com a nota em cima.
function LinhaDeNotas({ notas }: { notas: { data: string; nota: number }[] }) {
  if (notas.length === 0) return <p className="text-sm text-slate-400">Sem notas no período.</p>;
  const largura = 440;
  const altura = 120;
  const m = { l: 14, r: 14, t: 22, b: 22 };
  const w = largura - m.l - m.r;
  const h = altura - m.t - m.b;
  const x = (i: number) => m.l + (notas.length === 1 ? w / 2 : (i / (notas.length - 1)) * w);
  const y = (v: number) => m.t + (1 - v / 10) * h;
  const caminho = notas.map((n, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(n.nota)}`).join(' ');
  const mostrarRotulo = (i: number) => notas.length <= 8 || i === 0 || i === notas.length - 1;
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} className="w-full" role="img" aria-label="Notas dos relatórios no período">
      {[0, 5, 10].map((v) => (
        <line key={v} x1={m.l} x2={m.l + w} y1={y(v)} y2={y(v)} stroke={v === 0 ? COR.eixo : COR.grade} />
      ))}
      {notas.length > 1 && <path d={caminho} fill="none" stroke={COR.linha} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {notas.map((n, i) => (
        <g key={`${n.data}-${i}`}>
          <circle cx={x(i)} cy={y(n.nota)} r={4} fill={COR.linha} stroke="#fff" strokeWidth={2}>
            <title>{`${fmt.data(n.data)}: ${fmt.nota(n.nota)}`}</title>
          </circle>
          {mostrarRotulo(i) && (
            <>
              <text x={x(i)} y={y(n.nota) - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill="#101F38">
                {fmt.nota(n.nota)}
              </text>
              <text x={x(i)} y={altura - 6} textAnchor="middle" fontSize={10} fill={COR.textoMudo}>
                {fmt.dataCurta(n.data)}
              </text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
