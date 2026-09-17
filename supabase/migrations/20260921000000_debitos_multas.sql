-- ============================================================================
-- Escala Operadores — Migration: contabilizacao automatica de debitos de multa
--
-- Ao aprovar uma multa, grava o valor devido (snapshot do valor configurado
-- no momento) e a data de vencimento (a segunda-feira seguinte à decisão,
-- conforme o aviso do dashboard de regras: "cobradas toda segunda-feira").
-- O valor atual (com juros de 50% compostos por semana em atraso) é
-- calculado no frontend a partir de valor_base + data_vencimento + hoje —
-- não precisa de job nenhum rodando, é só matemática na hora de exibir.
-- ============================================================================

BEGIN;

ALTER TABLE configuracao_multas
  ADD COLUMN valor_multa numeric(10,2) NOT NULL DEFAULT 20.00;

COMMENT ON COLUMN configuracao_multas.valor_multa IS
  'Valor base (R$) cobrado por multa aprovada. Snapshot copiado para solicitacoes_multa.valor_base no momento da aprovação, então mudar aqui não afeta multas já aprovadas.';

ALTER TABLE solicitacoes_multa
  ADD COLUMN valor_base numeric(10,2),
  ADD COLUMN data_vencimento date,
  ADD COLUMN paga boolean NOT NULL DEFAULT false,
  ADD COLUMN pago_em timestamptz;

COMMENT ON COLUMN solicitacoes_multa.valor_base IS
  'Valor (R$) da multa no momento da aprovação, antes de juros. NULL enquanto pendente/recusada.';
COMMENT ON COLUMN solicitacoes_multa.data_vencimento IS
  'Segunda-feira seguinte à aprovação — prazo de pagamento antes de começar a render juros.';
COMMENT ON COLUMN solicitacoes_multa.paga IS
  'Marcado manualmente pelo admin quando o colaborador quita o débito.';

COMMIT;
