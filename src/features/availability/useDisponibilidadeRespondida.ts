import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

// null = ainda não sabemos (carregando ou não aplicável no momento).
export function useDisponibilidadeRespondida(
  colaboradorId: string | null,
  periodoId: string | null
) {
  const [respondida, setRespondida] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      if (!colaboradorId || !periodoId) {
        setRespondida(null);
        setCarregando(false);
        return;
      }

      setCarregando(true);

      const { data } = await supabase
        .from('disponibilidades')
        .select('id')
        .eq('colaborador_id', colaboradorId)
        .eq('periodo_id', periodoId)
        .limit(1);

      if (!cancelado) {
        setRespondida((data ?? []).length > 0);
        setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [colaboradorId, periodoId]);

  return { respondida, carregando };
}
