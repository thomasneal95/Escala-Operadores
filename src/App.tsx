import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { FeedbackProvider } from './components/FeedbackProvider';
import { LoginPage } from './pages/LoginPage';
import { OperatorApp } from './pages/operator/OperatorApp';
import { AdminApp } from './pages/admin/AdminApp';

function ConteudoAutenticado() {
  const { perfil, acessandoComo, voltarAoAdmin } = useAuth();

  if (perfil?.papel === 'administrador') {
    return <AdminApp />;
  }

  return (
    <>
      {acessandoComo && (
        <div className="animate-fade-in-up fixed inset-x-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl bg-amber-400/95 px-4 py-2.5 text-center text-sm text-tinta shadow-[0_18px_40px_-12px_rgba(180,110,0,0.6)] ring-1 ring-amber-600/20 backdrop-blur sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:left-64">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-tinta/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-tinta" />
            </span>
            <span>
              Você está na conta de <strong>{perfil?.nome_completo ?? '...'}</strong>. O que fizer aqui fica
              registrado como dele(a).
            </span>
          </span>
          <button
            onClick={voltarAoAdmin}
            className="rounded-lg bg-tinta px-3 py-1.5 text-xs font-semibold text-white hover:bg-tinta-light"
          >
            Voltar ao admin
          </button>
        </div>
      )}
      <OperatorApp />
    </>
  );
}

function ConteudoPrincipal() {
  const { session, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="fundo-navegacao flex min-h-screen flex-col items-center justify-center gap-5">
        <span className="relative flex h-16 w-16 items-center justify-center">
          <span className="animate-orbita absolute inset-0 rounded-full border-2 border-white/10 border-t-esmeralda" />
          <img src="/favicon.svg" alt="" className="h-8 w-8" />
        </span>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-slate-400">Jornada 360</p>
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  return session ? <ConteudoAutenticado /> : <LoginPage />;
}

function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <ConteudoPrincipal />
      </FeedbackProvider>
    </AuthProvider>
  );
}

export default App;