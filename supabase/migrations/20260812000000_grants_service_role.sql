-- ============================================================================
-- Escala Operadores — Migration: GRANTs para service_role
--
-- Complementa 20260811220000_grants.sql (que concedeu privilegios a
-- authenticated). O papel service_role e usado por Edge Functions com
-- privilegios administrativos (ctx.supabaseAdmin em @supabase/server) para
-- operacoes que exigem bypass de RLS, como criar colaboradores em nome do
-- administrador (supabase/functions/criar-colaborador).
--
-- Sem este GRANT, o Postgres rejeita qualquer INSERT/UPDATE/DELETE feito
-- pelo service_role com "permission denied for table X", mesmo que o RLS
-- da tabela nao esteja em vigor para essa role (GRANT e uma camada anterior
-- e independente do RLS).
-- ============================================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON
    perfis,
    colaboradores,
    equipes,
    turnos,
    periodos_operacao,
    disponibilidades,
    escalas
TO service_role;

COMMIT;