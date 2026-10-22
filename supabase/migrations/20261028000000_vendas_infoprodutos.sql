-- ============================================================================
-- Escala Operadores — Migration: vendas de infoprodutos
--
-- O admin lança no site cada venda de infoproduto (Sala de Sinais,
-- Transmissões VIP, Combo...). Cada venda gera comissão de um percentual do
-- valor (padrão 10%):
--   - colaborador: dividida igualmente entre todos da equipe dele na data;
--   - operador externo pago por FTD (ex.: João): fica inteira com ele.
-- A comissão entra no fechamento do mês da venda (coluna própria).
-- ============================================================================

BEGIN;

CREATE TABLE vendas_infoprodutos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data          date NOT NULL,
  produto       text NOT NULL,
  email_lead    text,
  operador      text NOT NULL,
  valor         numeric(10,2) NOT NULL CHECK (valor >= 0),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  criado_por    uuid REFERENCES perfis (id)
);

CREATE INDEX ix_vendas_infoprodutos_data ON vendas_infoprodutos (data);

COMMENT ON TABLE vendas_infoprodutos IS
  'Vendas de infoprodutos lançadas pelo admin. operador = nome na base (colaboradores.nome_base) ou operador externo. Geram comissão de configuracao_comissao.percentual_infoproduto sobre o valor.';

ALTER TABLE vendas_infoprodutos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia vendas de infoprodutos"
ON vendas_infoprodutos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON vendas_infoprodutos TO authenticated;
GRANT ALL ON vendas_infoprodutos TO service_role;

ALTER TABLE configuracao_comissao
  ADD COLUMN percentual_infoproduto numeric(6,4) NOT NULL DEFAULT 0.10;

COMMENT ON COLUMN configuracao_comissao.percentual_infoproduto IS
  'Comissão sobre o valor de cada venda de infoproduto (0,10 = 10%).';

-- Histórico: nova coluna da foto do mês.
ALTER TABLE historico_comissoes
  ADD COLUMN comissao_infoprodutos numeric(10,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION arquivar_mes_comissoes(
  p_mes date,
  p_linhas jsonb,
  p_origem text DEFAULT 'site',
  p_total_ftds integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  gravadas integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem arquivar meses.';
  END IF;

  DELETE FROM meses_arquivados WHERE mes = p_mes;

  INSERT INTO meses_arquivados (mes, origem, total_ftds, arquivado_por)
  VALUES (p_mes, p_origem, p_total_ftds, auth.uid());

  INSERT INTO historico_comissoes (
    mes, tipo, colaborador_id, nome, equipe, data_inicio, auxilio, comissao_propria,
    comissao_equipe, comissao_fds, comissao_infoprodutos, adiantamento, salario_total,
    ftds, total_a_pagar
  )
  SELECT
    p_mes,
    coalesce(l->>'tipo', 'colaborador'),
    (SELECT c.id FROM colaboradores c WHERE c.id::text = l->>'colaborador_id'),
    l->>'nome',
    nullif(l->>'equipe', ''),
    (l->>'data_inicio')::date,
    coalesce((l->>'auxilio')::numeric, 0),
    coalesce((l->>'comissao_propria')::numeric, 0),
    coalesce((l->>'comissao_equipe')::numeric, 0),
    coalesce((l->>'comissao_fds')::numeric, 0),
    coalesce((l->>'comissao_infoprodutos')::numeric, 0),
    coalesce((l->>'adiantamento')::numeric, 0),
    coalesce((l->>'salario_total')::numeric, 0),
    (l->>'ftds')::integer,
    (l->>'total_a_pagar')::numeric
  FROM jsonb_array_elements(p_linhas) AS l
  WHERE coalesce(l->>'nome', '') <> '';
  GET DIAGNOSTICS gravadas = ROW_COUNT;

  RETURN gravadas;
END;
$$;

COMMIT;
