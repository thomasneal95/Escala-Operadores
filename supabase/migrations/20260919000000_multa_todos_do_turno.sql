-- ============================================================================
-- Escala Operadores — Migration: permite multar "todos do turno" de uma vez
--
-- Quando o admin aprova uma solicitação de multa escolhendo "Todos" em
-- "quem vai levar a multa", o sistema cria uma linha de multa aprovada
-- para CADA colaborador ativo que tem aquele turno como turno_semana_id
-- (o mesmo campo usado na escala automática) — não apenas para o
-- reportante original. Isso exige que o ADMIN possa inserir linhas em
-- nome de outro colaborador (reportante_id != o próprio admin), o que a
-- policy de INSERT existente não permite (ela só deixa cada um criar em
-- seu próprio nome). Adicionamos uma policy extra, sem remover a
-- original — RLS combina policies permissivas com OR.
-- ============================================================================

BEGIN;

CREATE POLICY "Admin cria solicitacoes de multa em lote"
ON solicitacoes_multa FOR INSERT
WITH CHECK (is_admin());

COMMIT;
