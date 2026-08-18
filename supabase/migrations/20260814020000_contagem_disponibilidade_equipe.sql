-- ============================================================================
-- Escala Operadores — Migration: contagem de disponibilidade por equipe
--
-- Permite que um colaborador veja as disponibilidades de colegas da mesma
-- equipe (não só a própria), para que o frontend possa mostrar quantas
-- pessoas já marcaram determinado turno, ajudando na escolha. O frontend
-- exibe apenas números agregados, nunca nomes individuais dos colegas
-- nessa tela.
-- ============================================================================

BEGIN;

CREATE POLICY "Colaborador ve disponibilidade de colegas de equipe"
ON disponibilidades FOR SELECT
USING (
  colaborador_id IN (
    SELECT id FROM colaboradores
    WHERE equipe_id IS NOT NULL AND equipe_id = minha_equipe_id()
  )
);

COMMIT;