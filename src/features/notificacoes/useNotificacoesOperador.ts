import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import { obterUltimaVisualizacao } from '../../lib/notificacoesVistas';
import type { ItemMural } from '../multas/useMuralMultas';

const INTERVALO_MS = 30_000;

// Mesma lógica de "sem realtime" do useNotificacoesAdmin — só busca
// periódica, pra nunca colidir com o canal de nenhuma tela específica.
export function useNotificacoesOperador() {
  const { session } = useAuth();
  const [trocasPendentes, setTrocasPendentes] = useState(0);
  const [multasNovas, setMultasNovas] = useState(0);

  const carregar = useCallback(async () => {
    if (!session?.user) return;

    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', session.user.id)
      .single();

    if (!colaborador) return;

    const [trocasResultado, muralResultado] = await Promise.all([
      supabase
        .from('solicitacoes_troca')
        .select('id', { count: 'exact', head: true })
        .eq('colega_id', colaborador.id)
        .eq('status', 'pendente'),
      supabase.rpc('mural_multas'),
    ]);

    setTrocasPendentes(trocasResultado.count ?? 0);

    const itens = (muralResultado.data ?? []) as ItemMural[];
    const ultimaVisualizacao = obterUltimaVisualizacao('multas', session.user.id);
    const limiar = ultimaVisualizacao ? new Date(ultimaVisualizacao).getTime() : 0;

    const novas = itens.filter(
      (item) =>
        item.sou_eu_multado &&
        item.status !== 'pendente' &&
        item.decidido_em &&
        new Date(item.decidido_em).getTime() > limiar
    );
    setMultasNovas(novas.length);
  }, [session]);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  return { trocasPendentes, multasNovas };
}
