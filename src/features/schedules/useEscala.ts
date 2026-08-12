import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

interface EscalaLinha {
  id: string;
  colaborador_id: string;
  data: string;
  turno_id: string;
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

    setCarregando(true);
    setErro(null);

    const { data, error } = await supabase
      .from('escalas')
      .select('id, colaborador_id, data, turno_id')
      .eq('periodo_id', periodoId);

    if (error) {
      setErro('Não foi possível carregar a escala.');
      setCarregando(false);
      return;
    }

    setEscalas(data ?? []);
    setCarregando(false);
  }, [periodoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

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

  return {
    escalas,
    carregando,
    erro,
    processando,
    escaladosEm,
    colaboradorJaEscalado,
    adicionar,
    remover,
  };
}