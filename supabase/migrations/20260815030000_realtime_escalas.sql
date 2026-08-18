-- ============================================================================
-- Escala Operadores — Migration: Realtime para escalas
--
-- Habilita atualização ao vivo na tabela de escalas, para que tanto o
-- admin quanto os colaboradores vejam mudanças na montagem da escala sem
-- precisar recarregar a página.
-- ============================================================================

BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE escalas;

COMMIT;