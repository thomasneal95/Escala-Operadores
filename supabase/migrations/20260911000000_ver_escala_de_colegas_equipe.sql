-- ============================================================================
-- Escala Operadores — Migration: colaborador ve a escala dos colegas de
-- equipe (nao so a propria)
--
-- Ate agora, um colaborador so podia ler suas proprias linhas em "escalas"
-- (ou uma escala envolvida numa troca propria). Isso bloqueava a tela nova
-- de "ver escala da equipe" no fim de semana confirmado. Segue o mesmo
-- padrao ja usado para disponibilidades (ver migration
-- 20260814020000_contagem_disponibilidade_equipe.sql): so libera leitura
-- para colegas da MESMA equipe, e so quando o periodo ja esta
-- confirmado/encerrado -- nunca durante a montagem (em_organizacao).
-- ============================================================================

BEGIN;

CREATE POLICY "Colaborador ve escala de colegas de equipe"
ON escalas FOR SELECT
USING (
  colaborador_id IN (
    SELECT id FROM colaboradores
    WHERE equipe_id IS NOT NULL AND equipe_id = minha_equipe_id()
  )
  AND periodo_id IN (
    SELECT id FROM periodos_operacao WHERE status IN ('confirmado', 'encerrado')
  )
);

COMMIT;
