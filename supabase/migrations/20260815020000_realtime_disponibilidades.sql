-- ============================================================================
-- Escala Operadores — Migration: Realtime para disponibilidades
--
-- Habilita atualização ao vivo (sem precisar recarregar a página) na tabela
-- de disponibilidades, para que o admin veja em tempo real conforme os
-- colaboradores forem enviando suas respostas.
-- ============================================================================

BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE disponibilidades;

COMMIT;