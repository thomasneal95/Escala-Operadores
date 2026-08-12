import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface EscalaDoColaborador {
  id: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
}

export function useMinhaEscala(colaboradorId: string | null, periodoId: string | null) {
  const [escalas, setEscalas] = useState<EscalaDoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!colaboradorId || !periodoId) {
        setEscalas([]);
        setCarregando(false);
        return;
      }

      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('escalas')
        .select('id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot')
        .eq('colaborador_id', colaboradorId)
        .eq('periodo_id', periodoId)
        .order('data');

      if (error) {
        setErro('Não foi possível carregar sua escala.');
        setCarregando(false);
        return;
      }

      setEscalas(data ?? []);
      setCarregando(false);
    }

    carregar();
  }, [colaboradorId, periodoId]);

  return { escalas, carregando, erro };
}