import { useState, type FormEvent } from 'react';
import { useAuth } from '../features/auth/AuthContext';

export function LoginPage() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    const { erro: erroLogin } = await entrar(email, senha);

    setEnviando(false);

    if (erroLogin) {
      setErro('E-mail ou senha incorretos.');
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-tinta p-6">
      {/* Gradiente de horizonte — assinatura visual, sem formas geométricas */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[900px] w-[1500px] -translate-x-1/2 -translate-y-1/2 opacity-45 blur-[120px]"
          style={{
            background:
              'radial-gradient(ellipse at center, var(--color-ceruleo) 0%, var(--color-esmeralda) 38%, var(--color-profundo) 68%, transparent 85%)',
          }}
        />
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/[0.06]" />
      </div>

      {/* Cartão de acesso */}
      <div className="animate-fade-in-up relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-nuvem/95 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="flex h-1.5">
          <div className="flex-1 bg-ceruleo" />
          <div className="flex-1 bg-esmeralda" />
          <div className="flex-1 bg-profundo" />
        </div>

        <div className="px-9 py-11">
          <div className="flex flex-col items-center text-center">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <div className="absolute h-11 w-11 rounded-full border-2 border-esmeralda/30" />
              <div className="h-3 w-3 rounded-full bg-esmeralda" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-tinta">Entrar</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Acesse sua conta para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-9 space-y-6">
            <div>
              <label
                htmlFor="email"
                className="font-mono text-[10px] uppercase tracking-widest text-slate-500"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-1.5 text-tinta placeholder:text-slate-400 transition-colors focus:border-esmeralda focus:outline-none focus:ring-0"
                placeholder="voce@empresa.com"
              />
            </div>

            <div>
              <label
                htmlFor="senha"
                className="font-mono text-[10px] uppercase tracking-widest text-slate-500"
              >
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="mt-2 w-full border-0 border-b-2 border-slate-300 bg-transparent px-0 py-1.5 pr-8 text-tinta placeholder:text-slate-400 transition-colors focus:border-esmeralda focus:outline-none focus:ring-0"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((atual) => !atual)}
                  className="absolute right-0 top-3.5 text-slate-400 transition hover:text-slate-600"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-4.5 w-4.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.88 4.24A9.77 9.77 0 0112 4c5 0 9 4 10 8-.31 1.06-.82 2.07-1.5 3M6.1 6.1C3.9 7.5 2.3 9.6 2 12c1 4 5 8 10 8 1.13 0 2.22-.18 3.24-.52"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="h-4.5 w-4.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2 12c1-4 5-8 10-8s9 4 10 8c-1 4-5 8-10 8s-9-4-10-8z"
                      />
                      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {erro && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-md bg-esmeralda py-3 font-medium text-white tracking-wide shadow-sm transition hover:bg-esmeralda-dark hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Esqueceu sua senha? Fale com o administrador da sua equipe.
          </p>
        </div>
      </div>
    </div>
  );
}