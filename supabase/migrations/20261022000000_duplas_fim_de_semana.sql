-- ============================================================================
-- Escala Operadores — Migration: duplas fixas do fim de semana
--
-- Cada equipe é dividida em 3 duplas fixas, montadas pelo admin. As duplas
-- giram a cada fim de semana no ciclo Sábado → Domingo (home office) →
-- Folga. Dentro da dupla, uma pessoa faz Manhã + Tarde e a outra Tarde +
-- Noite. A geração mensal da escala usa esta tabela.
-- ============================================================================

BEGIN;

CREATE TABLE duplas_fim_de_semana (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id       uuid NOT NULL REFERENCES equipes (id) ON DELETE CASCADE,
  numero          smallint NOT NULL CHECK (numero BETWEEN 1 AND 3),
  manha_tarde_id  uuid REFERENCES colaboradores (id) ON DELETE SET NULL,
  tarde_noite_id  uuid REFERENCES colaboradores (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dupla_equipe_numero UNIQUE (equipe_id, numero),
  CONSTRAINT chk_dupla_pessoas_diferentes CHECK (manha_tarde_id IS DISTINCT FROM tarde_noite_id)
);

COMMENT ON TABLE duplas_fim_de_semana IS
  'As 3 duplas fixas de cada equipe no fim de semana. Giram no ciclo Sábado → Domingo → Folga; a fase vem do número da dupla.';
COMMENT ON COLUMN duplas_fim_de_semana.manha_tarde_id IS
  'Quem da dupla faz Manhã + Tarde.';
COMMENT ON COLUMN duplas_fim_de_semana.tarde_noite_id IS
  'Quem da dupla faz Tarde + Noite.';

-- Uma pessoa não pode estar em duas posições de dupla.
CREATE UNIQUE INDEX uq_dupla_manha_tarde
  ON duplas_fim_de_semana (manha_tarde_id)
  WHERE manha_tarde_id IS NOT NULL;
CREATE UNIQUE INDEX uq_dupla_tarde_noite
  ON duplas_fim_de_semana (tarde_noite_id)
  WHERE tarde_noite_id IS NOT NULL;

CREATE TRIGGER trg_updated_at_duplas_fim_de_semana
  BEFORE UPDATE ON duplas_fim_de_semana
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE duplas_fim_de_semana ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve duplas"
ON duplas_fim_de_semana FOR SELECT
USING (is_admin());

CREATE POLICY "Admin insere duplas"
ON duplas_fim_de_semana FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita duplas"
ON duplas_fim_de_semana FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove duplas"
ON duplas_fim_de_semana FOR DELETE
USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON duplas_fim_de_semana TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON duplas_fim_de_semana TO service_role;

COMMIT;
