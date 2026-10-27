import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';

export function useAlterarEmailColaborador() {
  const [processando, setProcessando] = useState(false);

  async function alterarEmail(perfilId: string, novoEmail: string) {
    setProcessando(true);

    const { data, error } = await supabase.functions.invoke('alterar-email-colaborador', {
      body: { perfil_id: perfilId, novo_email: novoEmail },
    });

    setProcessando(false);

    // Erros de regra (e-mail inválido ou já usado) vêm no corpo da resposta.
    const corpo = data ?? (await error?.context?.json?.().catch(() => null));
    if (corpo?.erro) {
      return { erro: corpo.erro as string };
    }

    if (error) {
      return { erro: 'Não foi possível alterar o e-mail.' };
    }

    return { erro: null };
  }

  return { alterarEmail, processando };
}
