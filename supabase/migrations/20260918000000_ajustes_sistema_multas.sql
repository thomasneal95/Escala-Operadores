-- ============================================================================
-- Escala Operadores — Migration: ajustes no sistema de multas
--
-- 1. O formulário de apontar multa precisa listar TODOS os operadores
--    ativos (não só os da própria equipe) para escolher quem deve ser
--    multado. A tabela "colaboradores" só permite que um colaborador veja
--    a si mesmo e colegas da mesma equipe (migration
--    20260812010000_colegas_equipe.sql) — não dá pra simplesmente abrir o
--    SELECT da tabela toda pra qualquer autenticado, porque ela tem colunas
--    sensíveis (telefone, matrícula, auxílio, etc.) que não devem vazar
--    entre equipes. Em vez disso, uma função SECURITY DEFINER expõe só
--    id + nome de quem está ativo — mesmo padrão de mural_multas().
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION colaboradores_ativos_nomes()
RETURNS TABLE (id uuid, nome_completo text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT c.id, p.nome_completo
  FROM colaboradores c
  JOIN perfis p ON p.id = c.perfil_id
  WHERE c.ativo = true
  ORDER BY p.nome_completo;
$$;

COMMENT ON FUNCTION colaboradores_ativos_nomes() IS
  'Lista id + nome de todos os colaboradores ativos, para qualquer autenticado — usada no apontamento de multa (precisa listar todo mundo, não só a própria equipe). Expõe só as duas colunas seguras, nunca telefone/matrícula/equipe/etc.';

GRANT EXECUTE ON FUNCTION colaboradores_ativos_nomes() TO authenticated;

COMMIT;
