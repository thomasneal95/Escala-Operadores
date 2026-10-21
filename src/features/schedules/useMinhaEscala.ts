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

  // "Carregando" só na primeira carga (ou ao trocar de período); as
  // atualizações depois disso trocam os dados sem piscar a tela.
  useEffect(() => {
    setCarregando(true);
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

  // Quando o admin aprova uma troca, o turno muda de dono e o aviso de
  // mudança em `escalas` não chega a quem perdeu ou ganhou o turno. Por isso
  // também recarrega quando uma troca em que a pessoa participa muda de
  // situação, e quando ela volta para o site (reabrir o app, trocar de aba).
  useEffect(() => {
    if (!colaboradorId || !periodoId) return;

    const canal = supabase
      .channel(`minha-escala-trocas-${colaboradorId}-${periodoId}-${idInstancia}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_troca',
          filter: `solicitante_id=eq.${colaboradorId}`,
        },
        () => carregar()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitacoes_troca',
          filter: `colega_id=eq.${colaboradorId}`,
        },
        () => carregar()
      )
      .subscribe();

    function aoVoltarParaOSite() {
      if (document.visibilityState === 'visible') carregar();
    }
    document.addEventListener('visibilitychange', aoVoltarParaOSite);

    return () => {
      supabase.removeChannel(canal);
      document.removeEventListener('visibilitychange', aoVoltarParaOSite);
    };
  }, [colaboradorId, periodoId, carregar, idInstancia]);

  return { escalas, carregando, erro };
}