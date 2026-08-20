import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

export function useTermoAceite(periodoId: string | null) {
  const { session } = useAuth();
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [jaAceitou, setJaAceitou] = useState(true); // true por padrão: não bloqueia enquanto carrega
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    if (!session?.user || !periodoId) {
      setCarregando(false);
      return;
    }

    setCarregando(true);

    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', session.user.id)
      .single();

    if (!colaborador) {
      setCarregando(false);
      return;
    }

    setColaboradorId(colaborador.id);

    const { data: aceite } = await supabase
      .from('termos_aceite')
      .select('id')
      .eq('periodo_id', periodoId)
      .eq('colaborador_id', colaborador.id)
      .maybeSingle();

    setJaAceitou(!!aceite);
    setCarregando(false);
  }, [session, periodoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aceitar() {
    if (!colaboradorId || !periodoId) return { erro: 'Não foi possível identificar seus dados.' };

    setProcessando(true);
    const { error } = await supabase.from('termos_aceite').insert({
      periodo_id: periodoId,
      colaborador_id: colaboradorId,
    });
    setProcessando(false);

    if (error) {
      return { erro: 'Não foi possível registrar sua confirmação. Tente novamente.' };
    }

    setJaAceitou(true);
    return { erro: null };
  }

  return { jaAceitou, carregando, processando, aceitar };
}