-- ============================================================================
-- Jornada 360 — Migration: pagamentos só do quadro geral
--
-- Salários fixos (ex.: o do administrador) que são pagos junto com os dos
-- operadores, mas não fazem parte de nenhum fechamento: aparecem apenas no
-- "Quadro geral" do comissionamento, somados ao Total a pagar (com a taxa),
-- em todos os meses a partir de `desde`.
--
-- Só uma tabela nova: nada do que já existe é alterado.
-- ============================================================================

BEGIN;

CREATE TABLE pagamentos_quadro_geral (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL CHECK (btrim(nome) <> ''),
  valor      numeric(12, 2) NOT NULL CHECK (valor >= 0),
  -- Primeiro mês em que entra no quadro (sempre dia 1).
  desde      date NOT NULL CHECK (extract(day FROM desde) = 1),
  criado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pagamentos_quadro_geral IS
  'Salários fixos mensais que entram só no Quadro geral do comissionamento (no Total a pagar, com a taxa), a partir do mês "desde".';

ALTER TABLE pagamentos_quadro_geral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia pagamentos do quadro geral"
ON pagamentos_quadro_geral FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos_quadro_geral TO authenticated;
GRANT ALL ON pagamentos_quadro_geral TO service_role;

COMMIT;
