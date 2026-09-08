import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

interface EscalaDoColaborador {
  id: string;
  data: string;
  turno_nome_snapshot: string;
  turno_hora_inicio_snapshot: string;
  turno_hora_fim_snapshot: string;
}

export function useMinhaEscala(colaboradorId: string | null, periodoId: string | null) {
  // Identifica esta instância do hook de forma única — dois componentes
  // podem chamar useMinhaEscala com o mesmo colaborador/período ao mesmo
  // tempo (ex.: resumo + tela de escala), e o cliente do Supabase reaproveita
  // o canal quando o nome (topic) é igual, o que faz o segundo `.on()` lançar
  // erro ("cannot add callbacks... after subscribe()") por já estar inscrito.
  const idInstancia = useId();
  const [escalas, setEscalas] = useState<EscalaDoColaborador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
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
  }, [colaboradorId, periodoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Escuta mudanças em tempo real na própria escala deste período.
  useEffect(() => {
    if (!colaboradorId || !periodoId) return;

    const canal = supabase
      .channel(`minha-escala-${colaboradorId}-${periodoId}-${idInstancia}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'escalas',
          filter: `periodo_id=eq.${periodoId}`,
        },
        () => {
          carregar();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [colaboradorId, periodoId, carregar, idInstancia]);

  return { escalas, carregando, erro };
}