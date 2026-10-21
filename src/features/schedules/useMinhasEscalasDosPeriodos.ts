import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface EscalaPropria {
  id: string;
  periodo_id: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
}

// Turnos do colaborador logado nos fins de semana informados (ex.: todos os
// já confirmados que ainda não passaram), em ordem de data e horário.
export function useMinhasEscalasDosPeriodos(periodoIds: string[]) {
  const chavePeriodos = periodoIds.join(',');
  const { session } = useAuth();
  const [escalas, setEscalas] = useState<EscalaPropria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const ids = chavePeriodos ? chavePeriodos.split(',') : [];
    if (ids.length === 0 || !session?.user) {
      setEscalas([]);
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro(null);

    const { data: colaborador, error: erroColaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', session.user.id)
      .single();

    if (erroColaborador || !colaborador) {
      setErro('Não foi possível encontrar seu cadastro de colaborador.');
      setCarregando(false);
      return;
    }

    const { data, error } = await supabase
      .from('escalas')
      .select(
        'id, periodo_id, data, turno_nome_snapshot, turno_hora_inicio_snapshot, turno_hora_fim_snapshot'
      )
      .eq('colaborador_id', colaborador.id)
      .in('periodo_id', ids)
      .order('data')
      .order('turno_hora_inicio_snapshot');

    if (error) {
      setErro('Não foi possível carregar seus turnos.');
      setCarregando(false);
      return;
    }

    setEscalas(data ?? []);
    setCarregando(false);
  }, [chavePeriodos, session]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { escalas, carregando, erro, recarregar: carregar };
}