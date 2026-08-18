import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';

export function useVisualizacaoEscala(escalaIds: string[]) {
  const { session } = useAuth();
  const [visualizadas, setVisualizadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);

  const chaveIds = escalaIds.join(',');

  const carregar = useCallback(async () => {
    if (!session?.user || escalaIds.length === 0) {
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

    const { data } = await supabase
      .from('escala_visualizacoes')
      .select('escala_id')
      .eq('colaborador_id', colaborador.id)
      .in('escala_id', escalaIds);

    setVisualizadas(new Set((data ?? []).map((v) => v.escala_id)));
    setCarregando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, chaveIds]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function marcarComoVisto(escalaId: string) {
    if (!session?.user) return { erro: 'Sessão inválida.' };

    setProcessando(escalaId);

    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', session.user.id)
      .single();

    if (!colaborador) {
      setProcessando(null);
      return { erro: 'Não foi possível identificar seus dados.' };
    }

    const { error } = await supabase.from('escala_visualizacoes').insert({
      escala_id: escalaId,
      colaborador_id: colaborador.id,
    });

    setProcessando(null);

    if (error && error.code !== '23505') {
      // 23505 = já existia (ex.: clique duplo) — não é um erro real para o usuário.
      return { erro: 'Não foi possível confirmar a visualização.' };
    }

    setVisualizadas((atual) => new Set(atual).add(escalaId));
    return { erro: null };
  }

  function foiVisualizada(escalaId: string) {
    return visualizadas.has(escalaId);
  }

  return { carregando, processando, marcarComoVisto, foiVisualizada };
}