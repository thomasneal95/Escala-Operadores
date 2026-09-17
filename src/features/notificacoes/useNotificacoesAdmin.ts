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

  const carregar = useCallback(async () => {
    const [trocasResultado, multasResultado] = await Promise.all([
      supabase
        .from('solicitacoes_troca')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aceito_pelo_colega'),
      supabase
        .from('solicitacoes_multa')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente'),
    ]);

    setTrocasPendentes(trocasResultado.count ?? 0);
    setMultasPendentes(multasResultado.count ?? 0);
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, [carregar]);

  return { trocasPendentes, multasPendentes };
}
