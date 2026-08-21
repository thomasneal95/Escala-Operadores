-- ============================================================================
-- Escala Operadores — Migration: data de admissão
--
-- Usada para calcular corretamente a assiduidade: um colaborador não pode
-- ser penalizado por finais de semana que aconteceram antes dele ser
-- contratado. Campo opcional (nulo = considera todo o histórico, útil
-- para cadastros antigos até serem preenchidos).
-- ============================================================================

BEGIN;

ALTER TABLE colaboradores
  ADD COLUMN data_admissao date;

COMMENT ON COLUMN colaboradores.data_admissao IS
  'Data em que o colaborador foi contratado. Usada para não contar, no cálculo de assiduidade, finais de semana anteriores à contratação. Nulo = considera todo o histórico.';

COMMIT;