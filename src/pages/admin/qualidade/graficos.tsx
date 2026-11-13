import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Gráficos do painel de Qualidade, em SVG/HTML puro (sem biblioteca).
// Cores validadas para daltonismo (scripts do guia de dataviz): verde/laranja
// para positivo/melhoria — sempre com rótulo junto (ΔE CVD 6,8 exige uma
// segunda codificação) — e uma rampa ordinal de laranja para a gravidade.

export const COR = {
  positivo: '#1AA36B',
  melhoria: '#E8743B',
  linha: '#24406B',
  linhaFundo: 'rgba(36, 64, 107, 0.08)',
  grade: '#E6E8EB',
  eixo: '#CBD2D9',
  textoMudo: '#8A94A0',
  vazio: '#EEF1F3',
  bom: '#0F7A3D',
  ruim: '#B42318',
  critico: '#D03B3B',
  aviso: '#FAB219',
};

export const COR_GRAVIDADE = { baixa: '#EE9A60', media: '#D9692B', alta: '#A8431A' } as const;

// Rampa sequencial (uma cor, claro → escuro) do mapa de calor.
const RAMPA_CALOR = ['#FBE6D6', '#F5C19C', '#EE9A60', '#D9692B', '#A8431A'];

export function corDoCalor(valor: number, maximo: number) {
  if (valor <= 0 || maximo <= 0) return { fundo: COR.vazio, texto: COR.textoMudo };
  const i = maximo === 1 ? 2 : Math.min(RAMPA_CALOR.length - 1, Math.floor((valor / maximo) * (RAMPA_CALOR.length - 0.001)));
  return { fundo: RAMPA_CALOR[i], texto: i >= 3 ? '#FFFFFF' : '#3B2416' };
}

export const fmt = {
  nota: (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
  dec: (n: number | null, casas = 1) =>
    n === null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }),
  pct: (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`),
  int: (n: number) => n.toLocaleString('pt-BR'),
  data: (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`,
  dataCurta: (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
};

// ---------------------------------------------------------------------------
// Dica (tooltip) — uma por painel, posicionada junto ao ponteiro

export interface ConteudoDica {
  titulo: string;
  linhas: { rotulo: string; valor: string; cor?: string }[];
  nota?: string;
}

export interface EstadoDica extends ConteudoDica {
  x: number;
  y: number;
}

export function useDica() {
  const [dica, setDica] = useState<EstadoDica | null>(null);
  return {
    dica,
    mostrar: (e: { clientX: number; clientY: number }, conteudo: ConteudoDica) =>
      setDica({ ...conteudo, x: e.clientX, y: e.clientY }),
    mostrarEm: (el: Element, conteudo: ConteudoDica) => {
      const r = el.getBoundingClientRect();
      setDica({ ...conteudo, x: r.left + r.width / 2, y: r.top });
    },
    esconder: () => setDica(null),
  };
}

export function Dica({ dica }: { dica: EstadoDica | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!dica || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const margem = 12;
    let left = dica.x + 14;
    if (left + width > window.innerWidth - margem) left = dica.x - width - 14;
    let top = dica.y - height - 12;
    if (top < margem) top = dica.y + 18;
    setPos({ left: Math.max(margem, left), top });
  }, [dica]);

  if (!dica) return null;
  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ left: pos.left, top: pos.top }}
      className="pointer-events-none fixed z-50 min-w-40 max-w-72 rounded-lg border border-slate-200 bg-white/95 px-3 py-2.5 text-xs shadow-lg shadow-slate-900/10 backdrop-blur"
    >
      <p className="font-medium text-slate-500">{dica.titulo}</p>
      <div className="mt-1.5 space-y-1">
        {dica.linhas.map((l) => (
          <div key={l.rotulo} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500">
              {l.cor && <span className="h-0.5 w-3 rounded-full" style={{ background: l.cor }} />}
              {l.rotulo}
            </span>
            <span className="font-semibold tabular-nums text-tinta">{l.valor}</span>
          </div>
        ))}
      </div>
      {dica.nota && <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-slate-400">{dica.nota}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return { ref, largura };
}

// ---------------------------------------------------------------------------
// Minigráfico (sparkline)

export function Sparkline({
  valores,
  largura = 96,
  altura = 28,
  cor = COR.linha,
  traco = '#B7C1CC',
}: {
  valores: (number | null)[];
  largura?: number;
  altura?: number;
  cor?: string;
  traco?: string;
}) {
  const pontos = valores.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pontos.length === 0) return <span className="text-xs text-slate-300">—</span>;
  // Escala na faixa das próprias notas (com folga de 1 ponto), dentro de 0–10.
  const min = Math.max(0, Math.min(...pontos.map((p) => p.v)) - 1);
  const max = Math.min(10, Math.max(...pontos.map((p) => p.v)) + 1);
  const pad = 3;
  const x = (i: number) => (valores.length === 1 ? largura / 2 : pad + (i / (valores.length - 1)) * (largura - pad * 2));
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (altura - pad * 2);
  const caminho = pontos.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} aria-hidden className="overflow-visible">
      {pontos.length > 1 && (
        <path d={caminho} fill="none" stroke={traco} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <circle cx={x(ultimo.i)} cy={y(ultimo.v)} r={3} fill={cor} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Evolução da nota: linha com área, média do período e mira (crosshair)

export function GraficoNota({
  pontos,
  granularidade,
  mediaPeriodo,
  onDica,
  onSairDica,
}: {
  granularidade: 'semana' | 'mes';
  pontos: { chave: string; rotulo: string; media: number | null; relatorios: number; minima: number | null; maxima: number | null }[];
  mediaPeriodo: number | null;
  onDica: (e: { clientX: number; clientY: number }, c: ConteudoDica) => void;
  onSairDica: () => void;
}) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const altura = 240;
  const m = { top: 16, right: 16, bottom: 28, left: 30 };
  const w = Math.max(0, largura - m.left - m.right);
  const h = altura - m.top - m.bottom;
  const n = pontos.length;
  const x = (i: number) => m.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => m.top + (1 - v / 10) * h;

  // Trechos contínuos (semanas sem relatório quebram a linha).
  const trechos: { i: number; v: number }[][] = [];
  let atual: { i: number; v: number }[] = [];
  pontos.forEach((p, i) => {
    if (p.media === null) {
      if (atual.length) trechos.push(atual);
      atual = [];
    } else atual.push({ i, v: p.media });
  });
  if (atual.length) trechos.push(atual);

  const passoRotulo = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(w / 56))));

  function mover(e: React.PointerEvent<SVGRectElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - caixa.left;
    const i = n <= 1 ? 0 : Math.round((rel / caixa.width) * (n - 1));
    const p = pontos[Math.max(0, Math.min(n - 1, i))];
    setFoco(i);
    onDica(e, {
      titulo: granularidade === 'mes' ? p.rotulo : `Semana de ${p.rotulo}`,
      linhas: [
        { rotulo: 'Nota média', valor: fmt.nota(p.media), cor: COR.linha },
        { rotulo: 'Relatórios', valor: fmt.int(p.relatorios) },
        ...(p.minima !== null && p.maxima !== null && p.relatorios > 1
          ? [{ rotulo: 'Faixa', valor: `${fmt.nota(p.minima)} – ${fmt.nota(p.maxima)}` }]
          : []),
      ],
    });
  }

  return (
    <div ref={ref} className="relative w-full">
      {largura > 0 && (
        <svg width={largura} height={altura} role="img" aria-label="Evolução da nota média no período">
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <g key={v}>
              <line x1={m.left} x2={m.left + w} y1={y(v)} y2={y(v)} stroke={v === 0 ? COR.eixo : COR.grade} strokeWidth={1} />
              <text x={m.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill={COR.textoMudo} className="tabular-nums">
                {v}
              </text>
            </g>
          ))}

          {mediaPeriodo !== null && (
            <g>
              <line x1={m.left} x2={m.left + w} y1={y(mediaPeriodo)} y2={y(mediaPeriodo)} stroke={COR.linha} strokeOpacity={0.35} strokeWidth={1} />
              <text
                x={m.left + 6}
                y={y(mediaPeriodo) + (mediaPeriodo > 8.5 ? 14 : -6)}
                fontSize={11}
                fill="#52606D"
                stroke="#fff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                média do período {fmt.nota(mediaPeriodo)}
              </text>
            </g>
          )}

          {trechos.map((t, k) => {
            const linha = t.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ');
            const area = t.length > 1 ? `${linha} L${x(t[t.length - 1].i)},${y(0)} L${x(t[0].i)},${y(0)} Z` : '';
            return (
              <g key={k}>
                {area && <path d={area} fill={COR.linhaFundo} />}
                {t.length > 1 && <path d={linha} fill="none" stroke={COR.linha} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
              </g>
            );
          })}

          {pontos.map((p, i) =>
            p.media === null ? null : (
              <circle key={p.chave} cx={x(i)} cy={y(p.media)} r={foco === i ? 5 : 4} fill={COR.linha} stroke="#fff" strokeWidth={2} />
            )
          )}

          {foco !== null && (
            <line x1={x(foco)} x2={x(foco)} y1={m.top} y2={m.top + h} stroke="#52606D" strokeOpacity={0.4} strokeWidth={1} />
          )}

          {pontos.map((p, i) =>
            i % passoRotulo === 0 || i === n - 1 ? (
              <text key={p.chave} x={x(i)} y={altura - 8} textAnchor="middle" fontSize={11} fill={COR.textoMudo}>
                {p.rotulo}
              </text>
            ) : null
          )}

          <rect
            x={m.left - 8}
            y={m.top}
            width={w + 16}
            height={h}
            fill="transparent"
            onPointerMove={mover}
            onPointerLeave={() => {
              setFoco(null);
              onSairDica();
            }}
          />
        </svg>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranking em barras horizontais (uma cor), com clique para focar

export function BarrasRanking({
  linhas,
  cor,
  selecionada,
  onSelecionar,
  onDica,
  onSairDica,
  vazio,
}: {
  linhas: { chave: string; rotulo: string; valor: number; detalhe: string; dica: ConteudoDica }[];
  cor: string;
  selecionada?: string | null;
  onSelecionar?: (chave: string) => void;
  onDica: (el: Element, c: ConteudoDica) => void;
  onSairDica: () => void;
  vazio: string;
}) {
  const maximo = Math.max(1, ...linhas.map((l) => l.valor));
  if (linhas.length === 0) return <p className="py-6 text-center text-sm text-slate-400">{vazio}</p>;
  return (
    <ul className="space-y-1">
      {linhas.map((l) => {
        const ativo = selecionada === l.chave;
        const apagado = selecionada && !ativo;
        return (
          <li key={l.chave}>
            <button
              type="button"
              onClick={() => onSelecionar?.(l.chave)}
              onPointerEnter={(e) => onDica(e.currentTarget, l.dica)}
              onPointerLeave={onSairDica}
              onFocus={(e) => onDica(e.currentTarget, l.dica)}
              onBlur={onSairDica}
              className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-1.5 text-left transition ${
                ativo ? 'bg-slate-100' : 'hover:bg-slate-50'
              } ${apagado ? 'opacity-40' : ''} ${onSelecionar ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="truncate text-sm text-tinta">{l.rotulo}</span>
              <span className="text-right text-xs text-slate-500">
                <span className="font-semibold tabular-nums text-tinta">{fmt.int(l.valor)}</span> · {l.detalhe}
              </span>
              <span className="col-span-2 mt-1 block h-2 w-full rounded-full bg-transparent">
                <span
                  className="block h-2 rounded-r-[4px] transition-[width] duration-500 group-hover:brightness-105"
                  style={{ width: `${(l.valor / maximo) * 100}%`, background: cor, minWidth: 6 }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Barra segmentada alta (um todo dividido em partes)

export function BarraSegmentada({
  partes,
  onDica,
  onSairDica,
}: {
  partes: { rotulo: string; valor: number; cor: string; textoClaro?: boolean }[];
  onDica: (el: Element, c: ConteudoDica) => void;
  onSairDica: () => void;
}) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  if (total === 0) return <div className="h-7 rounded bg-slate-100" />;
  return (
    <div className="flex h-7 w-full gap-0.5" role="img" aria-label={partes.map((p) => `${p.rotulo}: ${p.valor}`).join(', ')}>
      {partes
        .filter((p) => p.valor > 0)
        .map((p) => {
          const share = p.valor / total;
          return (
            <div
              key={p.rotulo}
              tabIndex={0}
              onPointerEnter={(e) => onDica(e.currentTarget, { titulo: p.rotulo, linhas: [{ rotulo: 'Quantidade', valor: fmt.int(p.valor), cor: p.cor }, { rotulo: 'Participação', valor: fmt.pct(share) }] })}
              onPointerLeave={onSairDica}
              onFocus={(e) => onDica(e.currentTarget, { titulo: p.rotulo, linhas: [{ rotulo: 'Quantidade', valor: fmt.int(p.valor), cor: p.cor }, { rotulo: 'Participação', valor: fmt.pct(share) }] })}
              onBlur={onSairDica}
              className="flex h-full min-w-1 items-center overflow-hidden rounded px-2 text-xs font-semibold outline-none transition hover:brightness-105 focus-visible:ring-2 focus-visible:ring-tinta/30"
              style={{ width: `${share * 100}%`, background: p.cor, color: p.textoClaro === false ? '#2B1A0F' : '#FFFFFF' }}
            >
              {share >= 0.12 && <span className="tabular-nums">{fmt.pct(share)}</span>}
            </div>
          );
        })}
    </div>
  );
}

export function Legenda({ itens }: { itens: { rotulo: string; cor: string; valor?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} />
          {i.rotulo}
          {i.valor && <span className="font-medium tabular-nums text-tinta">{i.valor}</span>}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Positivos × melhorias de uma pessoa: barra divergente pequena

export function MiniDivergente({ positivos, melhorias, maximo }: { positivos: number; melhorias: number; maximo: number }) {
  const escala = (v: number) => `${(v / Math.max(1, maximo)) * 100}%`;
  return (
    <div className="flex w-36 items-center gap-1.5 text-[11px] tabular-nums text-slate-500" aria-label={`${positivos} positivos, ${melhorias} de melhoria`}>
      <span className="w-4 text-right">{melhorias}</span>
      <div className="flex h-2 flex-1 items-center">
        <div className="flex h-full flex-1 justify-end">
          <div className="h-full rounded-l-[3px]" style={{ width: escala(melhorias), background: COR.melhoria }} />
        </div>
        <div className="mx-px h-3 w-px bg-slate-300" />
        <div className="flex h-full flex-1">
          <div className="h-full rounded-r-[3px]" style={{ width: escala(positivos), background: COR.positivo }} />
        </div>
      </div>
      <span className="w-4">{positivos}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Cartao({
  titulo,
  subtitulo,
  acao,
  children,
  className = '',
}: {
  titulo: string;
  subtitulo?: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,31,56,0.04)] sm:p-5 ${className}`}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-[15px] font-semibold text-tinta">{titulo}</h3>
          {subtitulo && <p className="mt-0.5 text-xs text-slate-500">{subtitulo}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}
