-- ============================================================================
-- Escala Operadores — Migration: retira colaborador de comissionamento
-- individual das telas de operador
--
-- João (joao@mailsa.com) foi cadastrado só para a aba de comissionamento,
-- que não seguiu adiante como funcionalidade de equipe. Ele não deve
-- aparecer nas telas que listam colaboradores como se fossem operadores.
-- Marca o cadastro dele com o flag comissionamento_individual (já existente
-- para esse cenário — ver migration 20260821000000) e remove a equipe, já
-- que o cálculo de comissão individual não depende de equipe.
-- ============================================================================

BEGIN;

UPDATE colaboradores c
SET comissionamento_individual = true,
    equipe_id = NULL
FROM perfis p
WHERE c.perfil_id = p.id
  AND p.email = 'joao@mailsa.com';

-- A função usada no formulário de apontar multa lista "todos os
-- colaboradores ativos" (ver migration 20260918000000) — precisa excluir
-- quem é só de comissionamento individual também.
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
    AND c.comissionamento_individual = false
  ORDER BY p.nome_completo;
$$;

COMMIT;
