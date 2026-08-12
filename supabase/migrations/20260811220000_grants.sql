-- ============================================================================
-- Escala Operadores — Migration: GRANTs para authenticated
--
-- O Row Level Security (RLS, ver 20260811210000_rls_policies.sql) restringe
-- QUAIS LINHAS uma role pode tocar, mas nao concede a permissao base de
-- tocar na tabela — isso e feito por GRANT, camada anterior ao RLS.
-- Sem o GRANT aqui, toda policy de RLS e ignorada e o Postgres rejeita o
-- acesso com "permission denied" antes mesmo de avaliar as policies.
--
-- authenticated: qualquer usuario logado (administrador ou colaborador).
--   Recebe SELECT/INSERT/UPDATE/DELETE em todas as tabelas do dominio — o
--   RLS e quem decide, linha a linha, o que cada papel realmente pode ler
--   ou escrever (docs/MODELO-BANCO-V1.md secao 14).
-- anon: visitante nao autenticado. Nenhuma tabela do dominio deve ser
--   acessivel sem login (docs/ESPECIFICACAO-V1.md secao 11) — por isso,
--   nenhum GRANT e concedido a anon aqui.
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
TO authenticated;

COMMIT;