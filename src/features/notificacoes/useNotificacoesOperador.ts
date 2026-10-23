import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/AuthContext';
import { marcarComoVisualizado, obterUltimaVisualizacao } from '../../lib/notificacoesVistas';
import type { ItemMural } from '../multas/useMuralMultas';

const INTERVALO_MS = 30_000;

export interface NotificacoesOperador {
  escalasNovas: number;
  trocasPendentes: number;
  trocasDecididas: number;
  multasNovas: number;
  mesesFechados: number;
  vendasConferidas: number;
}

const zeradas: NotificacoesOperador = {
  escalasNovas: 0,
  trocasPendentes: 0,
  trocasDecididas: 0,
  multasNovas: 0,
  mesesFechados: 0,
  vendasConferidas: 0,
};

// Mesma lógica de "sem realtime" do useNotificacoesAdmin — só busca
// periódica, pra nunca colidir com o canal de nenhuma tela específica.
export function useNotificacoesOperador() {
  const { session } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacoesOperador>(zeradas);

  const carregar = useCallback(async () => {
    if (!session?.user) return;
    const userId = session.user.id;

    const { data: colaborador } = await supabase
      .from('colaboradores')
      .select('id')
      .eq('perfil_id', userId)
      .single();

    if (!colaborador) return;

    // Escopos novos começam "vistos agora", pra não acender com tudo que
    // já existia antes (as multas mantêm o comportamento de antes).
    const desde = (escopo: string) => {
      const visto = obterUltimaVisualizacao(escopo, userId);
      if (visto) return visto;
      marcarComoVisualizado(escopo, userId);
      return new Date().toISOString();
    };
    const hoje = new Date().toISOString().slice(0, 10);

    const [trocasResultado, muralResultado, escalas, trocasDecididas, meses, vendas] = await Promise.all([
      supabase
        .from('solicitacoes_troca')
        .select('id', { count: 'exact', head: true })
        .eq('colega_id', colaborador.id)
        .eq('status', 'pendente'),
      supabase.rpc('mural_multas'),
      supabase
        .from('periodos_operacao')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'confirmado')
        .gte('data_fim', hoje)
        .gt('confirmed_at', desde('escala')),
      supabase
        .from('solicitacoes_troca')
        .select('id', { count: 'exact', head: true })
        .or(`solicitante_id.eq.${colaborador.id},colega_id.eq.${colaborador.id}`)
        .in('status', ['aprovado', 'rejeitado_pelo_admin'])
        .gt('respondido_admin_em', desde('trocas')),
      supabase
        .from('meses_arquivados')
        .select('mes', { count: 'exact', head: true })
        .gt('arquivado_em', desde('ganhos')),
      supabase
        .from('vendas_infoprodutos')
        .select('id', { count: 'exact', head: true })
        .eq('colaborador_id', colaborador.id)
        .gt('conferido_em', desde('infoprodutos')),
    ]);

    const itens = (muralResultado.data ?? []) as ItemMural[];
    const ultimaVisualizacao = obterUltimaVisualizacao('multas', userId);
    const limiar = ultimaVisualizacao ? new Date(ultimaVisualizacao).getTime() : 0;

    const novas = itens.filter(
      (item) =>
        item.sou_eu_multado &&
        item.status !== 'pendente' &&
        item.decidido_em &&
        new Date(item.decidido_em).getTime() > limiar
    );

    setNotificacoes({
      escalasNovas: escalas.count ?? 0,
      trocasPendentes: trocasResultado.count ?? 0,
      trocasDecididas: trocasDecididas.count ?? 0,
      multasNovas: novas.length,
      mesesFechados: meses.count ?? 0,
      vendasConferidas: vendas.count ?? 0,
    });
  }, [session]);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // Chamado ao abrir uma aba: zera o aviso dela.
  const marcarVisto = useCallback(
    (escopo: string) => {
      if (!session?.user) return;
      marcarComoVisualizado(escopo, session.user.id);
      carregar();
    },
    [session, carregar]
  );

  return { ...notificacoes, marcarVisto };
}
