import { createContext, useCallback, useContext, useRef, useState } from 'react';

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

  return (
    <ToastContext.Provider value={{ mostrarToast }}>
      <ConfirmContext.Provider value={{ confirmar }}>
        {children}

        {/* Toasts */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 sm:bottom-6 sm:right-6">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`animate-[slideIn_0.2s_ease-out] rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
                t.tipo === 'sucesso'
                  ? 'bg-esmeralda-dark'
                  : t.tipo === 'erro'
                    ? 'bg-red-600'
                    : 'bg-tinta'
              }`}
            >
              {t.mensagem}
            </div>
          ))}
        </div>

        {/* Modal de confirmação */}
        {dialogo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => responder(false)}
          >
            <div
              className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {dialogo.opcoes.titulo && (
                <h3 className="font-display text-lg font-semibold text-tinta">
                  {dialogo.opcoes.titulo}
                </h3>
              )}
              <p className="mt-2 text-sm text-slate-600">{dialogo.opcoes.mensagem}</p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => responder(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  {dialogo.opcoes.textoCancelar ?? 'Cancelar'}
                </button>
                <button
                  onClick={() => responder(true)}
                  className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
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