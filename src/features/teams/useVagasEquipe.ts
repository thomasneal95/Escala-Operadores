import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface VagaEquipeTurno {
  equipe_id: string;
  turno_id: string;
  vagas: number;
}

export function useVagasEquipe() {
  const [vagas, setVagas] = useState<VagaEquipeTurno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('vagas_equipe_turno')
      .select('equipe_id, turno_id, vagas');

    if (error) {
      setErro('Não foi possível carregar as vagas configuradas.');
      setCarregando(false);
      return;
    }

    setVagas(data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function vagasDe(equipeId: string, turnoId: string) {
    return vagas.find((v) => v.equipe_id === equipeId && v.turno_id === turnoId)?.vagas ?? 0;
  }

  async function definirVagas(equipeId: string, turnoId: string, quantidade: number) {
    setSalvando(true);

    const { error } = await supabase
      .from('vagas_equipe_turno')
      .upsert(
        { equipe_id: equipeId, turno_id: turnoId, vagas: quantidade },
        { onConflict: 'equipe_id,turno_id' }
      );

    setSalvando(false);

    if (error) {
      return { erro: 'Não foi possível salvar a quantidade de vagas.' };
    }

    await carregar();
    return { erro: null };
  }

  return { vagas, carregando, erro, salvando, vagasDe, definirVagas };
}