import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';

const INTERVALO_MS = 30_000;

// Contagens simples, sem realtime — só busca ao montar e a cada 30s. Evita
// de propósito abrir canal do Supabase aqui: como este hook fica sempre
// montado (na casca do app, não numa aba específica), um canal aqui
// colidiria com o de qualquer tela que também escute a mesma tabela ao
// mesmo tempo (foi exatamente isso que já causou um incidente antes).
export function useNotificacoesAdmin() {
  const [trocasPendentes, setTrocasPendentes] = useState(0);
  const [multasPendentes, setMultasPendentes] = useState(0);
  const [escalaParaMontar, setEscalaParaMontar] = useState(0);
  const [presencasPendentes, setPresencasPendentes] = useState(0);

  const carregar = useCallback(async () => {
    const [trocasResultado, multasResultado, periodoAtualResultado] = await Promise.all([
      supabase
        .from('solicitacoes_troca')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aceito_pelo_colega'),
      supabase
        .from('solicitacoes_multa')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente'),
      supabase
        .from('periodos_operacao')
        .select('id, status')
        .order('data_inicio', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setTrocasPendentes(trocasResultado.count ?? 0);
    setMultasPendentes(multasResultado.count ?? 0);
    // "Escala" pisca quando o recebimento fechou e a escala ainda não foi
    // montada/confirmada — é literalmente pra onde os botões do Painel
    // mandam o admin nesse momento.
    setEscalaParaMontar(periodoAtualResultado.data?.status === 'em_organizacao' ? 1 : 0);

    const { data: periodoPresenca } = await supabase
      .from('periodos_operacao')
      .select('id')
      .in('status', ['confirmado', 'encerrado'])
      .order('data_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (periodoPresenca) {
      const { count } = await supabase
        .from('escalas')
        .select('id', { count: 'exact', head: true })
        .eq('periodo_id', periodoPresenca.id)
        .is('compareceu', null);
      // "Histórico" é onde o admin de fato marca quem compareceu (botão
      // "Confirmar presença" do Painel manda pra lá).
      setPresencasPendentes(count ?? 0);
    } else {
      setPresencasPendentes(0);
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  return { trocasPendentes, multasPendentes, escalaParaMontar, presencasPendentes };
}
