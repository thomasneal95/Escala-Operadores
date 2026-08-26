-- ============================================================================
-- Escala Operadores — Migration: total de leads no fechamento salvo
--
-- Permite exibir o total de leads convertidos do mês mesmo quando a tela
-- está mostrando dados JÁ SALVOS (sem precisar recalcular na hora).
-- ============================================================================

BEGIN;

ALTER TABLE fechamentos_mensais
  ADD COLUMN total_leads_convertidos integer;

COMMIT;