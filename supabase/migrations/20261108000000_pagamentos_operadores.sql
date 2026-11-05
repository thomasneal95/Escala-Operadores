-- ============================================================================
-- Jornada 360 — Migration: carteiras e confirmação de pagamentos
--
-- Seção "Pagamentos" do comissionamento: o admin paga cada pessoa do Quadro
-- geral e marca como pago.
--
--   - carteiras_pagamento: a carteira de cada pessoa, guardada para os
--     próximos meses.
--   - pagamentos_realizados: o que foi pago em cada mês, com o valor e a
--     carteira do momento do pagamento (se o fechamento mudar depois, a tela
--     mostra a diferença).
--
-- A pessoa é identificada pela mesma chave do Quadro geral:
-- `c:<colaborador_id>` ou `n:<nome normalizado>` (quem não é colaborador,
-- como pagamentos fixos e externos).
--
-- Só tabelas novas: nada do que já existe é alterado.
-- ============================================================================

BEGIN;

CREATE TABLE carteiras_pagamento (
  chave          text PRIMARY KEY CHECK (chave ~ '^[cn]:.+'),
  nome           text NOT NULL,
  rede           text NOT NULL CHECK (btrim(rede) <> ''),
  endereco       text NOT NULL CHECK (btrim(endereco) <> ''),
  observacao     text,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE carteiras_pagamento IS
  'Carteira de pagamento de cada pessoa do Quadro geral (chave c:<colaborador_id> ou n:<nome normalizado>).';

CREATE TABLE pagamentos_realizados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes         date NOT NULL CHECK (extract(day FROM mes) = 1),
  chave       text NOT NULL CHECK (chave ~ '^[cn]:.+'),
  nome        text NOT NULL,
  valor       numeric(12, 2) NOT NULL,
  rede        text,
  endereco    text,
  transacao   text,
  pago_por    uuid REFERENCES perfis (id) ON DELETE SET NULL,
  pago_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_pagamento_mes_pessoa UNIQUE (mes, chave)
);

COMMENT ON TABLE pagamentos_realizados IS
  'Pagamentos do mês confirmados pelo admin, com o valor e a carteira usados no momento.';

CREATE INDEX ix_pagamentos_realizados_mes ON pagamentos_realizados (mes);

ALTER TABLE carteiras_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia carteiras"
ON carteiras_pagamento FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON carteiras_pagamento TO authenticated;
GRANT ALL ON carteiras_pagamento TO service_role;

ALTER TABLE pagamentos_realizados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia pagamentos realizados"
ON pagamentos_realizados FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos_realizados TO authenticated;
GRANT ALL ON pagamentos_realizados TO service_role;

COMMIT;
