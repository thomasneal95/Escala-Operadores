import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import type { EscalaDoBloco } from '../../lib/blocosDeTrabalho';

// Turnos de um colega de equipe nos fins de semana informados — para quem
// pede a troca escolher qual dia do colega quer pegar. A leitura é liberada
// pela policy de colegas de equipe (só fins de semana confirmados).
export function useEscalasDoColega(colegaId: string | null, periodoIds: string[]) {
  const chavePeriodos = periodoIds.join(',');
  const [escalas, setEscalas] = useState<(EscalaDoBloco & { periodo_id: string })[]>([]);

  useEffect(() => {
    const ids = chavePeriodos ? chavePeriodos.split(',') : [];
    if (!colegaId || ids.length === 0) {
      setEscalas([]);
      return;
    }

    let cancelado = false;
    supabase
      .from('escalas')
      .select(
        'id, colaborador_id, periodo_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot'
      )
      .eq('colaborador_id', colegaId)
      .in('periodo_id', ids)
      .then(({ data }) => {
        if (!cancelado) setEscalas(data ?? []);
      });

    return () => {
      cancelado = true;
    };
  }, [colegaId, chavePeriodos]);

  return { escalas };
}
