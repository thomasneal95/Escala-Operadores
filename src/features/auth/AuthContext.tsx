import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

type Papel = 'administrador' | 'colaborador';

interface Perfil {
  id: string;
  papel: Papel;
  nome_completo: string;
}

interface AuthContextValue {
  session: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<{ erro: string | null }>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarPerfil(userId: string) {
    const { data, error } = await supabase
      .from('perfis')
      .select('id, papel, nome_completo')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao carregar perfil:', error.message);
      setPerfil(null);
      return;
    }

    setPerfil(data as Perfil);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await carregarPerfil(session.user.id);
      }
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await carregarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      return { erro: error.message };
    }
    return { erro: null };
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ session, perfil, carregando, entrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  }
  return context;
}