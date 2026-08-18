-- ============================================================================
-- Escala Operadores — Migration: contador de prazo + "marcar como visto"
--
-- 1. Permite que qualquer colaborador autenticado LEIA a configuração de
--    recorrência (dia/hora de fechamento), para mostrar um contador de
--    prazo na tela de disponibilidade. Não altera as permissões de
--    escrita, que continuam exclusivas do admin.
--
-- 2. Nova tabela escala_visualizacoes: permite que o colaborador confirme
--    "vi minha escala", sem dar a ele nenhuma permissão de alterar a
--    tabela escalas em si (que continua controlada só pelo admin).
-- ============================================================================

BEGIN;

CREATE POLICY "Colaborador ve configuracao de recorrencia"
ON configuracao_recorrencia FOR SELECT
USING (auth.role() = 'authenticated');

CREATE TABLE escala_visualizacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id      uuid NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  visualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (escala_id, colaborador_id)
);

COMMENT ON TABLE escala_visualizacoes IS
  'Registra quando um colaborador confirma "vi minha escala". Tabela separada de escalas para não dar ao colaborador nenhuma permissão de alterar a escala em si.';

ALTER TABLE escala_visualizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ve e marca a propria visualizacao"
ON escala_visualizacoes FOR SELECT
USING (colaborador_id = meu_colaborador_id() OR is_admin());

CREATE POLICY "Colaborador marca a propria visualizacao"
ON escala_visualizacoes FOR INSERT
WITH CHECK (colaborador_id = meu_colaborador_id());

GRANT SELECT, INSERT ON escala_visualizacoes TO authenticated;
GRANT SELECT, INSERT ON escala_visualizacoes TO service_role;

COMMIT;