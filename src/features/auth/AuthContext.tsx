import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';
import { desligarPushDesteAparelho } from '../notificacoes/push';

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
  // Admin dentro da conta de um colaborador ("Entrar na conta" na aba Acesso).
  acessandoComo: boolean;
  entrarComo: (perfilId: string) => Promise<{ erro: string | null }>;
  voltarAoAdmin: () => Promise<void>;
}

// Sessão do admin guardada enquanto ele está na conta de um colaborador.
const CHAVE_SESSAO_ADMIN = 'jornada360-sessao-admin';

interface SessaoAdminGuardada {
  admin_id: string;
  access_token: string;
  refresh_token: string;
}

function lerSessaoAdmin(): SessaoAdminGuardada | null {
  try {
    const texto = localStorage.getItem(CHAVE_SESSAO_ADMIN);
    return texto ? (JSON.parse(texto) as SessaoAdminGuardada) : null;
  } catch {
    return null;
  }
}

function apagarSessaoAdmin() {
  try {
    localStorage.removeItem(CHAVE_SESSAO_ADMIN);
  } catch {
    // nada a fazer
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acessandoComo, setAcessandoComo] = useState(false);

  async function carregarPerfil(userId: string) {
    const { data, error } = await supabase
      .from('perfis')
      .select('id, papel, nome_completo, ativo')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erro ao carregar perfil:', error.message);
      setPerfil(null);
      return;
    }

    // Perfil desativado: encerra a sessão que ainda estiver aberta (o login
    // novo já é bloqueado no Auth pela desativação).
    if (data.ativo === false) {
      setPerfil(null);
      await supabase.auth.signOut();
      return;
    }

    setPerfil({ id: data.id, papel: data.papel, nome_completo: data.nome_completo } as Perfil);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      // Recarregou a página no meio do acesso: segue na conta do colaborador.
      const guardada = lerSessaoAdmin();
      if (guardada && session?.user && session.user.id !== guardada.admin_id) setAcessandoComo(true);
      else if (guardada) apagarSessaoAdmin();
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

  // Espaços e maiúsculas no e-mail (comuns no celular) não impedem a entrada.
  // O erro volta com o motivo para a tela de login explicar o que houve.
  async function entrar(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) {
      return { erro: error.code ?? (error.status === 0 ? 'sem_conexao' : error.message) };
    }
    return { erro: null };
  }

  async function sair() {
    if (lerSessaoAdmin()) {
      await voltarAoAdmin();
      return;
    }
    await desligarPushDesteAparelho();
    await supabase.auth.signOut();
  }

  async function entrarComo(perfilId: string) {
    const { data: atual } = await supabase.auth.getSession();
    if (!atual.session) return { erro: 'Sessão expirada. Entre novamente.' };

    const { data, error } = await supabase.functions.invoke('entrar-como-colaborador', {
      body: { perfil_id: perfilId },
    });
    if (error || data?.erro || !data?.token_hash) {
      return { erro: (data?.erro as string) ?? 'Não foi possível entrar na conta.' };
    }

    const guardada: SessaoAdminGuardada = {
      admin_id: atual.session.user.id,
      access_token: atual.session.access_token,
      refresh_token: atual.session.refresh_token,
    };
    try {
      localStorage.setItem(CHAVE_SESSAO_ADMIN, JSON.stringify(guardada));
    } catch {
      return { erro: 'O navegador não permitiu guardar a sua sessão de admin.' };
    }

    setCarregando(true);
    const { data: entrou, error: erroEntrada } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    });
    if (erroEntrada || !entrou.user) {
      apagarSessaoAdmin();
      setCarregando(false);
      return { erro: 'Não foi possível entrar na conta.' };
    }
    setAcessandoComo(true);
    await carregarPerfil(entrou.user.id);
    setCarregando(false);
    return { erro: null };
  }

  // Encerra só a sessão aberta neste navegador (a pessoa continua logada nos
  // aparelhos dela) e volta para a sessão do admin.
  async function voltarAoAdmin() {
    const guardada = lerSessaoAdmin();
    apagarSessaoAdmin();
    setAcessandoComo(false);
    setCarregando(true);
    await supabase.auth.signOut({ scope: 'local' });
    if (guardada) {
      const { data } = await supabase.auth.setSession({
        access_token: guardada.access_token,
        refresh_token: guardada.refresh_token,
      });
      if (data.user) await carregarPerfil(data.user.id);
    }
    setCarregando(false);
  }

  return (
    <AuthContext.Provider
      value={{ session, perfil, carregando, entrar, sair, acessandoComo, entrarComo, voltarAoAdmin }}
    >
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