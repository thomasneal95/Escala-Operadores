-- ============================================================================
-- Escala Operadores — Migration: corrige RLS de resposta a troca
--
-- As políticas de UPDATE para "colega responde" e "solicitante cancela"
-- usavam USING (... AND status = 'pendente') sem um WITH CHECK separado.
-- Em Postgres, quando não há WITH CHECK explícito, o USING também é
-- aplicado à linha NOVA — ou seja, como aceitar/recusar/cancelar sempre
-- muda o status para algo diferente de 'pendente', a própria alteração
-- violava a regra e era silenciosamente bloqueada (sem erro visível).
--
-- Aqui recriamos essas políticas com um WITH CHECK que verifica apenas a
-- posse (quem é o dono da solicitação), permitindo o status mudar livremente.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Colega responde solicitacao" ON solicitacoes_troca;
CREATE POLICY "Colega responde solicitacao"
ON solicitacoes_troca FOR UPDATE
USING (colega_id = meu_colaborador_id() AND status = 'pendente')
WITH CHECK (colega_id = meu_colaborador_id());

DROP POLICY IF EXISTS "Solicitante cancela solicitacao" ON solicitacoes_troca;
CREATE POLICY "Solicitante cancela solicitacao"
ON solicitacoes_troca FOR UPDATE
USING (solicitante_id = meu_colaborador_id() AND status = 'pendente')
WITH CHECK (solicitante_id = meu_colaborador_id());

COMMIT;