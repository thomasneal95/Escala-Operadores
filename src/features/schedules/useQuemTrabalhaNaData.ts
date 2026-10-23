import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// Quem já tem turno numa data de um fim de semana confirmado — para a tela
// de trocas destacar os colegas que estão de folga nesse dia (e por isso
// podem cobrir). A leitura segue a policy de colegas de equipe.
export function useQuemTrabalhaNaData(data: string | null, periodoId: string | null) {
  const [ocupados, setOcupados] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!data || !periodoId) {
      setOcupados(null);
      return;
    }

    let cancelado = false;
    supabase
      .from('escalas')
      .select('colaborador_id')
      .eq('periodo_id', periodoId)
      .eq('data', data)
      .then(({ data: linhas, error }) => {
        if (cancelado) return;
        setOcupados(error ? null : new Set((linhas ?? []).map((l) => l.colaborador_id as string)));
      });

    return () => {
      cancelado = true;
    };
  }, [data, periodoId]);

  return { ocupados };
}
