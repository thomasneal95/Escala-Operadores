import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface EscalaLinha {
  id: string;
  colaborador_id: string;
  data: string;
  turno_id: string;
  compareceu: boolean | null;
}

export function useEscala(periodoId: string | null) {
  const { session } = useAuth();
  const [escalas, setEscalas] = useState<EscalaLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!periodoId) {
      setEscalas([]);
      setCarregando(false);
      return;
    }

    setErro(null);

    const { data, error } = await supabase
      .from('escalas')
      .select('id, colaborador_id, data, turno_id, compareceu')
      .eq('periodo_id', periodoId);

    if (error) {
      setErro('Não foi possível carregar a escala.');
      setCarregando(false);
      return;
    }

    setEscalas(data ?? []);
    setCarregando(false);
  }, [periodoId]);

  // "Carregando" só na primeira carga ou ao trocar de fim de semana. Depois de
  // cada alteração a escala é atualizada sem esconder a tela, para a página
  // não perder a rolagem e voltar para o topo.
  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  // Escuta mudanças em tempo real na escala deste período.
  useEffect(() => {
    if (!periodoId) return;

    const canal = supabase
      .channel(`escalas-periodo-${periodoId}`)
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
  }, [periodoId, carregar]);

  function escaladosEm(data: string, turnoId: string) {
    return escalas.filter((e) => e.data === data && e.turno_id === turnoId);
  }

  function colaboradorJaEscalado(colaboradorId: string, data: string, turnoId: string) {
    return escalas.some(
      (e) => e.colaborador_id === colaboradorId && e.data === data && e.turno_id === turnoId
    );
  }

  async function adicionar(colaboradorId: string, data: string, turnoId: string) {
    if (!periodoId || !session?.user) return { erro: null };

    const identificador = `${colaboradorId}|${data}|${turnoId}`;
    setProcessando(identificador);
    setErro(null);

    const { error } = await supabase.from('escalas').insert({
      colaborador_id: colaboradorId,
      periodo_id: periodoId,
      data,
      turno_id: turnoId,
      created_by: session.user.id,
    });

    setProcessando(null);

    if (error) {
      let mensagem = 'Não foi possível escalar este colaborador.';
      if (error.code === '23P01') {
        mensagem = 'Este colaborador já está escalado em um horário conflitante.';
      } else if (error.code === '23505') {
        mensagem = 'Este colaborador já está escalado neste turno.';
      }
      setErro(mensagem);
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  async function remover(escalaId: string) {
    setProcessando(escalaId);
    setErro(null);

    const { error } = await supabase.from('escalas').delete().eq('id', escalaId);

    setProcessando(null);

    if (error) {
      setErro('Não foi possível remover esta alocação.');
      return;
    }

    await carregar();
  }

  // Passa todos os turnos de uma pessoa num dia (o bloco, ex.: Manhã +
  // Tarde) para outra pessoa, num único comando. As linhas continuam as
  // mesmas — só muda o dono —, então nada mais da escala é apagado.
  async function substituirNoDia(deColaboradorId: string, paraColaboradorId: string, data: string) {
    if (!periodoId) return { erro: 'Nenhum período carregado.' };

    setProcessando(`${deColaboradorId}|${data}`);
    setErro(null);

    const { error } = await supabase
      .from('escalas')
      .update({ colaborador_id: paraColaboradorId })
      .eq('periodo_id', periodoId)
      .eq('data', data)
      .eq('colaborador_id', deColaboradorId);

    setProcessando(null);

    if (error) {
      let mensagem = 'Não foi possível substituir esta pessoa.';
      if (error.code === '23P01' || error.code === '23505') {
        mensagem = 'A pessoa escolhida já trabalha nesse dia em um horário que conflita.';
      }
      setErro(mensagem);
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  async function marcarPresenca(escalaId: string, compareceu: boolean) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    setProcessando(escalaId);
    setErro(null);

    const { error } = await supabase
      .from('escalas')
      .update({
        compareceu,
        presenca_confirmada_em: new Date().toISOString(),
        presenca_confirmada_por: session.user.id,
      })
      .eq('id', escalaId);

    setProcessando(null);

    if (error) {
      const mensagem = 'Não foi possível confirmar a presença.';
      setErro(mensagem);
      return { erro: mensagem };
    }

    await carregar();
    return { erro: null };
  }

  return {
    escalas,
    carregando,
    erro,
    processando,
    escaladosEm,
    colaboradorJaEscalado,
    adicionar,
    remover,
    substituirNoDia,
    marcarPresenca,
    recarregar: carregar,
  };
}