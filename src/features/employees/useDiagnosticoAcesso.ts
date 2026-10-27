import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export interface DiagnosticoAcesso {
  existeLogin: boolean;
  perfilAtivo: boolean;
  emailPerfil: string | null;
  emailLogin?: string | null;
  emailConfirmado?: boolean;
  bloqueado?: boolean;
  ultimoLogin?: string | null;
  criadoEm?: string;
}

// O que o login (Auth) tem de uma pessoa, para o admin descobrir por que ela
// não consegue entrar — e corrigir bloqueio indevido ou e-mail não confirmado.
export function useDiagnosticoAcesso() {
  const [processando, setProcessando] = useState<string | null>(null);

  async function executar(perfilId: string, acao: 'diagnosticar' | 'liberar' | 'confirmar_email') {
    setProcessando(perfilId);
    const { data, error } = await supabase.functions.invoke('diagnostico-acesso', {
      body: { perfil_id: perfilId, acao },
    });
    setProcessando(null);

    if (data?.erro) return { erro: data.erro as string, diagnostico: null };
    if (error) return { erro: 'Não foi possível verificar o acesso.', diagnostico: null };
    return { erro: null, diagnostico: data as DiagnosticoAcesso };
  }

  return {
    processando,
    diagnosticar: (perfilId: string) => executar(perfilId, 'diagnosticar'),
    liberar: (perfilId: string) => executar(perfilId, 'liberar'),
    confirmarEmail: (perfilId: string) => executar(perfilId, 'confirmar_email'),
  };
}
