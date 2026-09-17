-- ============================================================================
-- Escala Operadores — Migration: controle de faltas (dias normais)
--
-- Controle de faltas do dia a dia (fora do esquema de fim de semana já
-- coberto por escalas/periodos_operacao). Como no dia a dia normal todo
-- mundo trabalha todo dia, registrar só as exceções (quem faltou, quando)
-- é bem mais prático do que confirmar presença de todo mundo diariamente.
-- Só o admin gerencia — mesmo padrão de RLS de equipes/turnos/colaboradores.
-- ============================================================================

BEGIN;

CREATE TABLE faltas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES colaboradores (id) ON DELETE CASCADE,
  data           date NOT NULL,
  motivo         text,
  justificada    boolean NOT NULL DEFAULT false,
  registrado_por uuid NOT NULL REFERENCES perfis (id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_falta_colaborador_dia UNIQUE (colaborador_id, data)
);

COMMENT ON TABLE faltas IS
  'Registro de faltas em dias normais (fora do esquema de fim de semana), lançado por exceção pelo admin.';

CREATE INDEX ix_faltas_colaborador ON faltas (colaborador_id);
CREATE INDEX ix_faltas_data ON faltas (data);

CREATE TRIGGER trg_updated_at_faltas
  BEFORE UPDATE ON faltas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE faltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve faltas"
ON faltas FOR SELECT
USING (is_admin());

CREATE POLICY "Admin registra faltas"
ON faltas FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita faltas"
ON faltas FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove faltas"
ON faltas FOR DELETE
USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON faltas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON faltas TO service_role;

COMMIT;
