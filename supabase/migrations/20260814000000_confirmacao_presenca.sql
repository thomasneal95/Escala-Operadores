-- ============================================================================
-- Escala Operadores — Migration: confirmação de presença
--
-- Adiciona um campo para o administrador confirmar, após o fim de semana,
-- se cada colaborador escalado realmente compareceu ao turno. Necessário
-- para o cálculo de comissionamento (que divide o valor apenas entre quem
-- de fato trabalhou, não apenas quem estava escalado).
--
-- null  = ainda não confirmado
-- true  = confirmado que compareceu
-- false = confirmado que faltou
-- ============================================================================

BEGIN;

ALTER TABLE escalas
  ADD COLUMN compareceu boolean,
  ADD COLUMN presenca_confirmada_em timestamptz,
  ADD COLUMN presenca_confirmada_por uuid REFERENCES perfis(id) ON DELETE SET NULL;

COMMENT ON COLUMN escalas.compareceu IS
  'null = ainda não confirmado; true = compareceu; false = faltou. Usado no cálculo de comissionamento.';

COMMIT;