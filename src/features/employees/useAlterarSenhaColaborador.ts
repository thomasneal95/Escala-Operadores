import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export function useAlterarSenhaColaborador() {
  const [processando, setProcessando] = useState(false);

  async function alterarSenha(perfilId: string, novaSenha: string) {
    setProcessando(true);

    const { data, error } = await supabase.functions.invoke('alterar-senha-colaborador', {
      body: { perfil_id: perfilId, nova_senha: novaSenha },
    });

    setProcessando(false);

    if (error) {
      return { erro: 'Não foi possível alterar a senha.' };
    }

    if (data?.erro) {
      return { erro: data.erro as string };
    }

    return { erro: null };
  }

  return { alterarSenha, processando };
}