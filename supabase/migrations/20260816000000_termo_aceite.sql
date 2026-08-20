-- ============================================================================
-- Escala Operadores — Migration: termo de aceite do turno
--
-- Quando a escala de um período é confirmada, o colaborador precisa clicar
-- em "Confirmo que estou ciente do meu turno" antes de acessar o resto do
-- sistema. Isso fica registrado com data/hora, como um compromisso formal.
-- ============================================================================

BEGIN;

CREATE TABLE termos_aceite (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id     uuid NOT NULL REFERENCES periodos_operacao(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  aceito_em      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (periodo_id, colaborador_id)
);

COMMENT ON TABLE termos_aceite IS
  'Registra quando um colaborador confirma "estou ciente do meu turno" para um período confirmado. Compromisso formal com data/hora.';

ALTER TABLE termos_aceite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ve e admin ve todos os aceites"
ON termos_aceite FOR SELECT
USING (colaborador_id = meu_colaborador_id() OR is_admin());

CREATE POLICY "Colaborador registra o proprio aceite"
ON termos_aceite FOR INSERT
WITH CHECK (colaborador_id = meu_colaborador_id());

GRANT SELECT, INSERT ON termos_aceite TO authenticated;
GRANT SELECT, INSERT ON termos_aceite TO service_role;

COMMIT;