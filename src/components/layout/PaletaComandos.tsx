import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

// Busca rápida (⌘K / Ctrl+K): digita o nome de uma tela ou ação e vai direto
// para ela. Navegável só pelo teclado (setas + Enter, Esc fecha).

export interface ComandoPaleta {
  id: string;
  rotulo: string;
  grupo: string;
  icone?: ReactNode;
  descricao?: string;
  /** Palavras extras que também encontram o item na busca. */
  sinonimos?: string;
  contagem?: number;
  executar: () => void;
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Pontua a correspondência: começo do rótulo > começo de palavra > contém >
// letras na ordem (ex.: "cms" acha "Comissionamento").
function pontuar(item: ComandoPaleta, busca: string) {
  if (!busca) return 1;
  const rotulo = normalizar(item.rotulo);
  const extra = normalizar(`${item.grupo} ${item.sinonimos ?? ''} ${item.descricao ?? ''}`);
  if (rotulo.startsWith(busca)) return 100;
  if (rotulo.split(/\s+/).some((p) => p.startsWith(busca))) return 80;
  if (rotulo.includes(busca)) return 60;
  if (extra.includes(busca)) return 40;
  let i = 0;
  for (const letra of rotulo) if (letra === busca[i]) i++;
  return i === busca.length ? 20 : 0;
}

export function useAtalhoPaleta(abrir: () => void) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrir();
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [abrir]);
}

export const teclaAtalho =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

interface PaletaComandosProps {
  aberta: boolean;
  aoFechar: () => void;
  comandos: ComandoPaleta[];
}

export function PaletaComandos({ aberta, aoFechar, comandos }: PaletaComandosProps) {
  if (!aberta) return null;
  return <PaletaAberta aoFechar={aoFechar} comandos={comandos} />;
}

function PaletaAberta({ aoFechar, comandos }: Omit<PaletaComandosProps, 'aberta'>) {
  const [busca, setBusca] = useState('');
  const [indice, setIndice] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    return comandos
      .map((c, ordem) => ({ c, ordem, pontos: pontuar(c, termo) }))
      .filter((r) => r.pontos > 0)
      .sort((a, b) => (termo ? b.pontos - a.pontos || a.ordem - b.ordem : a.ordem - b.ordem))
      .map((r) => r.c);
  }, [busca, comandos]);

  // Sem busca, mostra agrupado; com busca, uma lista única por relevância.
  const secoes = useMemo(() => {
    if (busca.trim()) return [{ grupo: 'Resultados', itens: resultados }];
    const mapa = new Map<string, ComandoPaleta[]>();
    for (const c of resultados) mapa.set(c.grupo, [...(mapa.get(c.grupo) ?? []), c]);
    return [...mapa.entries()].map(([grupo, itens]) => ({ grupo, itens }));
  }, [busca, resultados]);

  const indiceSeguro = Math.min(indice, Math.max(0, resultados.length - 1));

  useEffect(() => {
    inputRef.current?.focus();
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  useEffect(() => {
    listaRef.current?.querySelector(`[data-indice="${indiceSeguro}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [indiceSeguro]);

  function executar(item: ComandoPaleta | undefined) {
    if (!item) return;
    aoFechar();
    item.executar();
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      aoFechar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndice((i) => (resultados.length ? (Math.min(i, resultados.length - 1) + 1) % resultados.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndice((i) =>
        resultados.length ? (Math.min(i, resultados.length - 1) - 1 + resultados.length) % resultados.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executar(resultados[indiceSeguro]);
    }
  }

  let contador = -1;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-start justify-center bg-tinta/40 px-4 pt-[12vh] backdrop-blur-[3px]"
      onMouseDown={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca rápida"
        className="animate-escala-in w-full max-w-lg overflow-hidden rounded-2xl border border-white/60 bg-white/95 shadow-2xl ring-1 ring-tinta/5 backdrop-blur-xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={aoTeclar}
      >
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 shrink-0 text-slate-400">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setIndice(0);
            }}
            placeholder="Ir para uma tela ou ação..."
            className="h-14 w-full border-0 bg-transparent text-[15px] text-tinta placeholder:text-slate-400 focus:shadow-none focus:ring-0"
            style={{ boxShadow: 'none' }}
            role="combobox"
            aria-expanded="true"
            aria-controls="paleta-lista"
            aria-activedescendant={resultados.length ? `paleta-item-${indiceSeguro}` : undefined}
          />
          <kbd className="hidden shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listaRef} id="paleta-lista" role="listbox" className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
          {resultados.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-slate-500">Nada encontrado para “{busca}”.</p>
          )}
          {secoes.map((secao) => (
            <div key={secao.grupo} className="mb-1 last:mb-0">
              <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-widest text-slate-400">
                {secao.grupo}
              </p>
              {secao.itens.map((item) => {
                contador++;
                const meu = contador;
                const ativo = meu === indiceSeguro;
                return (
                  <button
                    key={item.id}
                    id={`paleta-item-${meu}`}
                    data-indice={meu}
                    role="option"
                    aria-selected={ativo}
                    onMouseMove={() => setIndice(meu)}
                    onClick={() => executar(item)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      ativo ? 'bg-tinta text-white' : 'text-slate-700'
                    }`}
                  >
                    {item.icone && (
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          ativo ? 'bg-white/10 text-esmeralda' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span className="h-[18px] w-[18px]">{item.icone}</span>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.rotulo}</span>
                      {item.descricao && (
                        <span className={`block truncate text-xs ${ativo ? 'text-white/60' : 'text-slate-400'}`}>
                          {item.descricao}
                        </span>
                      )}
                    </span>
                    {!!item.contagem && (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {item.contagem > 9 ? '9+' : item.contagem}
                      </span>
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      className={`h-4 w-4 shrink-0 transition ${ativo ? 'translate-x-0 opacity-70' : '-translate-x-1 opacity-0'}`}
                    >
                      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-200/80 bg-slate-50/80 px-4 py-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↓</kbd>
            navegar
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↵</kbd>
            abrir
          </span>
          <span className="ml-auto font-mono uppercase tracking-widest text-slate-400">Jornada 360</span>
        </div>
      </div>
    </div>
  );
}
