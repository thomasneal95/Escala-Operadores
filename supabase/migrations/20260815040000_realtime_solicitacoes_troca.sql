-- ============================================================================
-- Escala Operadores — Migration: Realtime para solicitações de troca
--
-- Habilita atualização ao vivo na tabela de solicitações de troca, para
-- que colega e admin vejam aceites/aprovações assim que acontecem, sem
-- precisar recarregar a página.
-- ============================================================================

BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE solicitacoes_troca;

COMMIT;