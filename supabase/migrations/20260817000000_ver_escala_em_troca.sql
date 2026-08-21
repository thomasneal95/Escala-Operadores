-- ============================================================================
-- Escala Operadores — Migration: visibilidade de escalas em trocas
--
-- Um colaborador só pode ver, normalmente, os próprios turnos na tabela de
-- escalas. Isso bloqueava (silenciosamente, sem erro) a visualização do
-- turno da OUTRA pessoa envolvida numa solicitação de troca da qual ele
-- também participa (como solicitante ou como colega).
--
-- Esta policy libera exatamente isso: ver o turno de outra pessoa, só
-- quando esse turno está referenciado numa solicitação de troca em que o
-- colaborador logado também é parte (solicitante ou colega).
-- ============================================================================

BEGIN;

CREATE POLICY "Ver escala envolvida em solicitacao de troca propria"
ON escalas FOR SELECT
USING (
  id IN (
    SELECT escala_solicitante_id FROM solicitacoes_troca
    WHERE solicitante_id = meu_colaborador_id() OR colega_id = meu_colaborador_id()
  )
  OR id IN (
    SELECT escala_colega_id FROM solicitacoes_troca
    WHERE (solicitante_id = meu_colaborador_id() OR colega_id = meu_colaborador_id())
      AND escala_colega_id IS NOT NULL
  )
);

COMMIT;