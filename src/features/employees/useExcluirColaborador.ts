import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase/client';

export function useExcluirColaborador() {
  const [processando, setProcessando] = useState(false);

  async function excluir(perfilId: string) {
    setProcessando(true);

    const { data, error } = await supabase.functions.invoke('excluir-colaborador', {
      body: { perfil_id: perfilId },
    });

    setProcessando(false);

    if (error) {
      // A função responde com { erro } e status 4xx/5xx (ex.: 409 quando o
      // colaborador tem histórico) — repassa a mensagem dela.
      if (error instanceof FunctionsHttpError) {
        const corpo = await error.context.json().catch(() => null);
        if (corpo?.erro) return { erro: corpo.erro as string };
      }
      return { erro: 'Não foi possível excluir o colaborador.' };
    }

    if (data?.erro) {
      return { erro: data.erro as string };
    }

    return { erro: null };
  }

  return { excluir, processando };
}
