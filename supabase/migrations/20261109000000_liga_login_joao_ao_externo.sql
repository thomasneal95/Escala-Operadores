-- ============================================================================
-- Jornada 360 — Migration: liga o login do João ao operador externo
--
-- O João (joao@mailsa.com) é operador externo pago por FTD e passa a ter no
-- portal só o comissionamento e os infoprodutos dele. O login é ligado ao
-- externo pelo "nome na base" do cadastro de colaborador dele.
--
-- Só preenche se ainda estiver vazio e houver exatamente um operador externo
-- pago por FTD (sem ambiguidade). Senão não muda nada — o admin liga em
-- Comissionamento → TNT → "Nomes na base".
-- ============================================================================

BEGIN;

UPDATE colaboradores c
SET nome_base = e.nome_base
FROM perfis p, operadores_externos e
WHERE c.perfil_id = p.id
  AND lower(p.email) = 'joao@mailsa.com'
  AND c.comissionamento_individual
  AND c.nome_base IS NULL
  AND e.valor_por_ftd IS NOT NULL
  AND (SELECT count(*) FROM operadores_externos WHERE valor_por_ftd IS NOT NULL) = 1
  AND NOT EXISTS (
    SELECT 1 FROM colaboradores o WHERE o.nome_base IS NOT NULL AND lower(btrim(o.nome_base)) = lower(btrim(e.nome_base))
  );

COMMIT;
