-- ============================================================================
-- Escala Operadores — Migration: corrige comissionamento_individual do
-- João Gabriel
--
-- O e-mail joao@mailsa.com (marcado como comissionamento_individual pela
-- migration 20260923000000) é do "João" mesmo — isso ficou certo. O
-- problema é outra pessoa: João Gabriel (Joaogabriel2@mypainel.site), que
-- já tinha esse flag = true de antes desta sessão (por conta da tentativa
-- anterior, malsucedida, da funcionalidade de comissionamento). Ele é um
-- operador normal — o flag nunca deveria ter ficado true pra ele. Como as
-- telas de operador passaram a filtrar por esse flag (migration
-- 20260923000000), ele começou a desaparecer das telas como efeito
-- colateral, mesmo sem essa migration ter tocado no cadastro dele.
--
-- Só reverte o flag — a equipe dele nunca foi alterada por nós, então não
-- precisa restaurar nada além disso.
-- ============================================================================

BEGIN;

UPDATE colaboradores c
SET comissionamento_individual = false
FROM perfis p
WHERE c.perfil_id = p.id
  AND lower(p.email) = 'joaogabriel2@mypainel.site';

COMMIT;
