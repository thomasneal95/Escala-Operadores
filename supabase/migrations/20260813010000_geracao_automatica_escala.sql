-- ============================================================================
-- Escala Operadores — Migration: geração automática de escala
--
-- Adiciona duas peças necessárias para gerar a escala do fim de semana
-- automaticamente, priorizando quem já trabalha aquele turno durante a
-- semana:
--
--   1. colaboradores.turno_semana_id — qual turno (Manhã/Tarde/Noite) a
--      pessoa trabalha nos dias de semana. Usado como critério de
--      prioridade na geração automática.
--
--   2. vagas_equipe_turno — quantas pessoas cada equipe precisa em cada
--      turno no fim de semana (ex.: Equipe A, Manhã, 2 vagas).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Turno da semana do colaborador
-- ----------------------------------------------------------------------------

ALTER TABLE colaboradores
  ADD COLUMN turno_semana_id uuid REFERENCES turnos(id) ON DELETE SET NULL;

COMMENT ON COLUMN colaboradores.turno_semana_id IS
  'Turno que o colaborador trabalha durante a semana (segunda a sexta). Usado para priorizar a escala automática de fim de semana.';

-- ----------------------------------------------------------------------------
-- 2. Vagas necessárias por equipe e turno, no fim de semana
-- ----------------------------------------------------------------------------

CREATE TABLE vagas_equipe_turno (
  equipe_id  uuid NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  turno_id   uuid NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  vagas      integer NOT NULL DEFAULT 0 CHECK (vagas >= 0),
  PRIMARY KEY (equipe_id, turno_id)
);

COMMENT ON TABLE vagas_equipe_turno IS
  'Quantidade de colaboradores necessários por equipe em cada turno do fim de semana. Usado pela geração automática de escala.';

ALTER TABLE vagas_equipe_turno ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve vagas"
ON vagas_equipe_turno FOR SELECT
USING (is_admin());

CREATE POLICY "Admin insere vagas"
ON vagas_equipe_turno FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita vagas"
ON vagas_equipe_turno FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove vagas"
ON vagas_equipe_turno FOR DELETE
USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON vagas_equipe_turno TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vagas_equipe_turno TO service_role;

COMMIT;