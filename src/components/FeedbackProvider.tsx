import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useModalAcessivel } from '../hooks/useModalAcessivel';

// ============================================================================
// Toast — notificações discretas no canto da tela, substituindo window.alert
// ============================================================================

interface ToastItem {
  id: number;
  mensagem: string;
  tipo: 'sucesso' | 'erro' | 'info';
}

interface ToastContextValue {
  mostrarToast: (mensagem: string, tipo?: ToastItem['tipo']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <FeedbackProvider>');
  return ctx.mostrarToast;
}

// ============================================================================
// Confirm — modal de confirmação, substituindo window.confirm
// ============================================================================

interface ConfirmOptions {
  titulo?: string;
  mensagem: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  perigoso?: boolean;
}

interface ConfirmContextValue {
  confirmar: (opcoes: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <FeedbackProvider>');
  return ctx.confirmar;
}

// ============================================================================
// Provider único — envolve o app inteiro
// ============================================================================

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const proximoId = useRef(0);

  const mostrarToast = useCallback((mensagem: string, tipo: ToastItem['tipo'] = 'sucesso') => {
    const id = proximoId.current++;
    setToasts((atual) => [...atual, { id, mensagem, tipo }]);
    setTimeout(() => {
      setToasts((atual) => atual.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const [dialogo, setDialogo] = useState<{
    opcoes: ConfirmOptions;
    resolver: (valor: boolean) => void;
  } | null>(null);

  const confirmar = useCallback((opcoesOuMensagem: ConfirmOptions | string) => {
    const opcoes: ConfirmOptions =
      typeof opcoesOuMensagem === 'string' ? { mensagem: opcoesOuMensagem } : opcoesOuMensagem;

    return new Promise<boolean>((resolver) => {
      setDialogo({ opcoes, resolver });
    });
  }, []);

  function responder(valor: boolean) {
    dialogo?.resolver(valor);
    setDialogo(null);
  }

  const refDialogo = useModalAcessivel(!!dialogo, () => responder(false));

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      <ConfirmContext.Provider value={{ confirmar }}>
        {children}

        {/* Toasts — no topo no celular (embaixo fica a barra de abas), no
            canto inferior direito no desktop */}
        <div
          className="pointer-events-none fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top))] z-[70] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="animate-escala-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-tinta/[0.06] bg-white/95 px-4 py-3 text-sm font-medium text-tinta shadow-xl backdrop-blur-xl"
            >
              <span
                className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                  t.tipo === 'sucesso' ? 'bg-esmeralda' : t.tipo === 'erro' ? 'bg-red-500' : 'bg-ceruleo'
                }`}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
                  {t.tipo === 'sucesso' ? (
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  ) : t.tipo === 'erro' ? (
                    <path d="M7 7l10 10M17 7 7 17" strokeLinecap="round" />
                  ) : (
                    <path d="M12 11v6M12 7h.01" strokeLinecap="round" />
                  )}
                </svg>
              </span>
              <span className="min-w-0 flex-1">{t.mensagem}</span>
            </div>
          ))}
        </div>

        {/* Modal de confirmação */}
        {dialogo && (
          <div
            className="animate-fade-in fixed inset-0 z-[65] flex items-center justify-center bg-tinta/40 p-4 backdrop-blur-[3px]"
            onClick={() => responder(false)}
          >
            <div
              ref={refDialogo}
              role="alertdialog"
              aria-modal="true"
              aria-describedby="mensagem-confirmacao"
              className="animate-escala-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${
                  dialogo.opcoes.perigoso ? 'bg-red-50 text-red-600' : 'bg-esmeralda-light text-esmeralda-dark'
                }`}
                aria-hidden
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  {dialogo.opcoes.perigoso ? (
                    <path d="M12 8v5M12 16.5h.01M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.2h17.8a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </span>
              {dialogo.opcoes.titulo && (
                <h3 className="font-display text-lg font-semibold text-tinta">
                  {dialogo.opcoes.titulo}
                </h3>
              )}
              <p id="mensagem-confirmacao" className="mt-2 whitespace-pre-line text-sm text-slate-600">
                {dialogo.opcoes.mensagem}
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => responder(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {dialogo.opcoes.textoCancelar ?? 'Cancelar'}
                </button>
                <button
                  onClick={() => responder(true)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium text-white transition ${
                    dialogo.opcoes.perigoso
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-esmeralda hover:bg-esmeralda-dark'
                  }`}
                >
                  {dialogo.opcoes.textoConfirmar ?? 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}