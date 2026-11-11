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
        <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg bg-amber-400 px-4 py-2 text-center text-sm text-tinta shadow-lg sm:left-64">
          <span>
            Você está na conta de <strong>{perfil?.nome_completo ?? '...'}</strong>. O que fizer aqui fica
            registrado como dele(a).
          </span>
          <button
            onClick={voltarAoAdmin}
            className="rounded-md bg-tinta px-3 py-1 text-xs font-semibold text-white hover:bg-tinta/90"
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
      <div className="flex min-h-screen items-center justify-center bg-nuvem text-slate-500">
        Carregando...
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