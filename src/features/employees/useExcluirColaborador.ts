import { useState } from 'react';
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
      return { erro: 'Não foi possível excluir o colaborador.', modo: null };
    }

    if (data?.erro) {
      return { erro: data.erro as string, modo: null };
    }

    return { erro: null, modo: data?.modo as 'excluido' | 'desativado' };
  }

  return { excluir, processando };
}