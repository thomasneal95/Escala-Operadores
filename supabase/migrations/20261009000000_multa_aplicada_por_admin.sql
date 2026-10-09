-- ============================================================================
-- Escala Operadores — Migration: admin aplica multa direto
--
-- Além de aprovar apontamentos dos colaboradores, o admin pode enviar uma
-- multa que já nasce aprovada (sem passar por análise) e já entra nos
-- débitos. Nesse caso não há "reportante" colaborador — o admin pode nem
-- ter cadastro em colaboradores —, então reportante_id passa a ser opcional
-- e quem aplicou fica em decidido_por (perfil do admin).
--
-- A inserção já é permitida ao admin pela policy "Admin cria solicitacoes
-- de multa em lote" (20260919000000_multa_todos_do_turno.sql).
-- ============================================================================

BEGIN;

ALTER TABLE solicitacoes_multa
  ADD COLUMN aplicada_por_admin boolean NOT NULL DEFAULT false,
  ALTER COLUMN reportante_id DROP NOT NULL;

ALTER TABLE solicitacoes_multa
  ADD CONSTRAINT chk_reportante_ou_admin
    CHECK (reportante_id IS NOT NULL OR aplicada_por_admin),
  ADD CONSTRAINT chk_aplicada_por_admin_tem_responsavel
    CHECK (NOT aplicada_por_admin OR decidido_por IS NOT NULL);

COMMENT ON COLUMN solicitacoes_multa.aplicada_por_admin IS
  'True quando o próprio admin enviou a multa: nasce aprovada (sem análise), com quem aplicou em decidido_por. reportante_id fica NULL nesse caso.';

COMMIT;
