import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Lista de navegação das barras laterais (admin e operador). O destaque da
// tela atual é uma "pílula" que desliza até o item escolhido.

export interface ItemNavegacao<T extends string> {
  id: T;
  rotulo: string;
  icone: ReactNode;
  contagem?: number;
}

export interface GrupoNavegacao<T extends string> {
  titulo?: string;
  itens: ItemNavegacao<T>[];
}

interface ListaNavegacaoProps<T extends string> {
  grupos: GrupoNavegacao<T>[];
  ativo: T;
  aoSelecionar: (id: T) => void;
  /** Só ícones (barra recolhida do admin). */
  recolhida?: boolean;
  /** Para tirar os botões da ordem de tabulação quando a gaveta está fechada. */
  focavel?: boolean;
}

export function ListaNavegacao<T extends string>({
  grupos,
  ativo,
  aoSelecionar,
  recolhida = false,
  focavel = true,
}: ListaNavegacaoProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const botoes = useRef(new Map<T, HTMLButtonElement>());
  const [pilula, setPilula] = useState<{ y: number; h: number; visivel: boolean }>({ y: 0, h: 0, visivel: false });
  // Na primeira medição a pílula já nasce no lugar; depois disso ela desliza.
  const [animar, setAnimar] = useState(false);

  const medir = useCallback(() => {
    const botao = botoes.current.get(ativo);
    if (!botao) {
      setPilula((p) => ({ ...p, visivel: false }));
      return;
    }
    setPilula({ y: botao.offsetTop, h: botao.offsetHeight, visivel: true });
  }, [ativo]);

  useLayoutEffect(() => {
    medir();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(container);
    return () => observador.disconnect();
  }, [medir, grupos.length]);

  useLayoutEffect(() => {
    if (!pilula.visivel || animar) return;
    const t = window.setTimeout(() => setAnimar(true), 60);
    return () => window.clearTimeout(t);
  }, [pilula.visivel, animar]);

  return (
    <div ref={containerRef} className="relative">
      {/* Pílula deslizante */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 rounded-xl bg-gradient-to-r from-esmeralda to-esmeralda-dark shadow-[0_10px_24px_-10px_rgba(26,163,107,0.9),inset_0_1px_0_rgba(255,255,255,0.18)] ${
          !animar ? '' : 'transition-[transform,height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]'
        } ${pilula.visivel ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: `translateY(${pilula.y}px)`, height: pilula.h, top: 0 }}
      />

      {grupos.map((grupo, i) => (
        <div key={grupo.titulo ?? i} className={i > 0 ? 'mt-4' : ''}>
          {grupo.titulo && (
            <div className="relative h-6 px-4">
              <p
                className={`absolute inset-x-4 top-1 whitespace-nowrap font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 transition-opacity duration-200 ${
                  recolhida ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {grupo.titulo}
              </p>
              <span
                className={`absolute left-1/2 top-3 h-px w-5 -translate-x-1/2 bg-white/10 transition-opacity duration-200 ${
                  recolhida ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>
          )}
          <div className="space-y-0.5">
            {grupo.itens.map((item) => {
              const selecionado = item.id === ativo;
              const contagem = selecionado ? 0 : (item.contagem ?? 0);
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    if (el) botoes.current.set(item.id, el);
                    else botoes.current.delete(item.id);
                  }}
                  onClick={() => aoSelecionar(item.id)}
                  tabIndex={focavel ? 0 : -1}
                  title={recolhida ? item.rotulo : undefined}
                  aria-current={selecionado ? 'page' : undefined}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors duration-200 ${
                    selecionado ? 'text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span
                    className={`relative h-5 w-5 shrink-0 transition-transform duration-300 ${
                      selecionado ? '' : 'group-hover:scale-110'
                    }`}
                  >
                    {item.icone}
                    {recolhida && contagem > 0 && (
                      <span className="pulso-notificacao absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-tinta" />
                    )}
                  </span>
                  <span
                    className={`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap transition-opacity duration-200 ${
                      recolhida ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <span className="truncate">{item.rotulo}</span>
                    {contagem > 0 && (
                      <span
                        className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white"
                        aria-label={`${contagem} pendente${contagem > 1 ? 's' : ''}`}
                      >
                        {contagem > 9 ? '9+' : contagem}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function iniciais(nome?: string | null) {
  if (!nome) return '·';
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export function Avatar({ nome, tamanho = 'md' }: { nome?: string | null; tamanho?: 'sm' | 'md' }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-esmeralda to-ceruleo font-display font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-2 ring-white/10 ${
        tamanho === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
      }`}
      aria-hidden
    >
      {iniciais(nome)}
    </span>
  );
}

/** Marca do Jornada 360: o ícone com um anel orbitando. */
export function MarcaJornada({ subtitulo, compacta = false }: { subtitulo?: string; compacta?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-xl bg-white/[0.06] ring-1 ring-white/10" />
        <img src="/favicon.svg" alt="" className="relative h-6 w-6" />
      </span>
      <div
        className={`min-w-0 whitespace-nowrap transition-opacity duration-200 ${compacta ? 'opacity-0' : 'opacity-100'}`}
      >
        <p className="font-display text-[15px] font-semibold leading-tight tracking-tight text-white">Jornada 360</p>
        {subtitulo && (
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-esmeralda">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}
