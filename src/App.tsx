import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { FeedbackProvider } from './components/FeedbackProvider';
import { LoginPage } from './pages/LoginPage';
import { OperatorApp } from './pages/operator/OperatorApp';
import { AdminApp } from './pages/admin/AdminApp';

function ConteudoAutenticado() {
  const { perfil } = useAuth();

  if (perfil?.papel === 'administrador') {
    return <AdminApp />;
  }

  return <OperatorApp />;
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