-- ============================================================================
-- Escala Operadores — Migration: fechamento mensal a partir da base em Excel
--
-- O fechamento deixa de buscar os leads na API e passa a usar a base de
-- vendas (FTDs) que o admin importa do Excel (aba "Base" da planilha de
-- comissões). O cálculo espelha a planilha — ver
-- supabase/functions/_shared/calculoFechamento.ts.
--
--   1. colaboradores.nome_base: nome do operador como aparece na base.
--   2. vendas_importadas: linhas da base (uma por FTD).
--   3. operadores_externos: logins da base que não são da operação; com
--      valor_por_ftd preenchido entram no fechamento ganhando por FTD.
--   4. pagamentos_fixos: salário fixo / auxílio fixo de quem não é
--      comissionado.
--   5. configuracao_comissao: valores e datas das regras (singleton).
--   6. fechamentos_mensais: novas colunas para a foto do mês.
--   7. importar_vendas_base(): substitui, de uma vez, os meses do arquivo.
-- ============================================================================

BEGIN;

-- 1. Nome na base ------------------------------------------------------------
ALTER TABLE colaboradores ADD COLUMN nome_base text;

COMMENT ON COLUMN colaboradores.nome_base IS
  'Nome do operador exatamente como aparece na coluna Operador da base de vendas (Excel). Usado para ligar cada FTD ao colaborador.';

CREATE UNIQUE INDEX uq_colaborador_nome_base
  ON colaboradores (lower(btrim(nome_base)))
  WHERE nome_base IS NOT NULL;

-- 2. Base de vendas importada -------------------------------------------------
CREATE TABLE vendas_importadas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente        text,
  operador       text NOT NULL,
  lead_telefone  text,
  etapa          text NOT NULL,
  data           date NOT NULL,
  hora           time NOT NULL,
  importado_em   timestamptz NOT NULL DEFAULT now(),
  importado_por  uuid REFERENCES perfis (id)
);

CREATE INDEX ix_vendas_importadas_data ON vendas_importadas (data);

COMMENT ON TABLE vendas_importadas IS
  'Base de vendas (FTDs) importada do Excel, uma linha por evento. A data/hora é a do CRM; o Dia Real (virada às X horas) é calculado no fechamento.';

ALTER TABLE vendas_importadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia vendas importadas"
ON vendas_importadas FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON vendas_importadas TO authenticated;
GRANT ALL ON vendas_importadas TO service_role;

-- 3. Operadores externos ------------------------------------------------------
CREATE TABLE operadores_externos (
  nome_base      text PRIMARY KEY,
  valor_por_ftd  numeric(10,2),
  criado_em      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE operadores_externos IS
  'Logins da base que não pertencem à operação. Sem valor_por_ftd ficam fora de tudo; com valor, aparecem no fechamento ganhando esse valor por FTD (ex.: João, US$ 2).';

ALTER TABLE operadores_externos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia operadores externos"
ON operadores_externos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON operadores_externos TO authenticated;
GRANT ALL ON operadores_externos TO service_role;

-- 4. Pagamentos fixos ---------------------------------------------------------
CREATE TABLE pagamentos_fixos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('salario_fixo', 'auxilio_fixo')),
  valor         numeric(10,2) NOT NULL DEFAULT 0,
  data_inicio   date,
  adiantamento  numeric(10,2) NOT NULL DEFAULT 0,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pagamentos_fixos IS
  'Pessoas pagas sem comissão: salário fixo (proporcional à data de início) ou auxílio fixo. Entram no Fechamento Geral.';

ALTER TABLE pagamentos_fixos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia pagamentos fixos"
ON pagamentos_fixos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos_fixos TO authenticated;
GRANT ALL ON pagamentos_fixos TO service_role;

-- 5. Parâmetros das regras ----------------------------------------------------
CREATE TABLE configuracao_comissao (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),
  inicio_regra_nova      date NOT NULL DEFAULT '2026-10-01',
  valor_regra_nova       numeric(10,2) NOT NULL DEFAULT 0.50,
  valor_antigo_dia_util  numeric(10,2) NOT NULL DEFAULT 2,
  valor_antigo_fds       numeric(10,2) NOT NULL DEFAULT 3,
  valor_ftd_individual   numeric(10,2) NOT NULL DEFAULT 2,
  taxa_total_a_pagar     numeric(6,4) NOT NULL DEFAULT 0.02,
  hora_virada_dia        integer NOT NULL DEFAULT 6 CHECK (hora_virada_dia BETWEEN 0 AND 12),
  atualizado_em          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE configuracao_comissao IS
  'Valores e datas das regras de comissão (uma linha só). Valor por FTD a partir de inicio_regra_nova; antes, valores antigos de dia útil e FDS. taxa_total_a_pagar: acréscimo sobre o salário (ex.: 0,02 = 2%). hora_virada_dia: vendas antes dessa hora contam para o dia anterior.';

INSERT INTO configuracao_comissao (id) VALUES (true);

ALTER TABLE configuracao_comissao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia configuracao de comissao"
ON configuracao_comissao FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, UPDATE ON configuracao_comissao TO authenticated;
GRANT ALL ON configuracao_comissao TO service_role;

-- 6. Foto do mês ----------------------------------------------------------------
ALTER TABLE fechamentos_mensais
  ADD COLUMN ftds integer NOT NULL DEFAULT 0,
  ADD COLUMN comissao_propria numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN total_a_pagar numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN equipe_nome text;

-- 7. Importação -------------------------------------------------------------------
-- Recebe as linhas do Excel (jsonb) e substitui, numa única transação, todas
-- as vendas já importadas dos meses presentes no arquivo.
CREATE OR REPLACE FUNCTION importar_vendas_base(p_linhas jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  inseridas integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem importar a base.';
  END IF;

  WITH novas AS (
    SELECT
      nullif(btrim(l->>'cliente'), '')       AS cliente,
      btrim(l->>'operador')                  AS operador,
      nullif(btrim(l->>'lead_telefone'), '') AS lead_telefone,
      btrim(l->>'etapa')                     AS etapa,
      (l->>'data')::date                     AS data,
      (l->>'hora')::time                     AS hora
    FROM jsonb_array_elements(p_linhas) AS l
    WHERE coalesce(btrim(l->>'operador'), '') <> ''
  ), apagadas AS (
    DELETE FROM vendas_importadas v
    WHERE date_trunc('month', v.data) IN (SELECT DISTINCT date_trunc('month', data) FROM novas)
    RETURNING 1
  )
  INSERT INTO vendas_importadas (cliente, operador, lead_telefone, etapa, data, hora, importado_por)
  SELECT cliente, operador, lead_telefone, etapa, data, hora, auth.uid() FROM novas;
  GET DIAGNOSTICS inseridas = ROW_COUNT;

  RETURN inseridas;
END;
$$;

COMMENT ON FUNCTION importar_vendas_base(jsonb) IS
  'Importa a base de vendas do Excel: apaga as vendas já importadas dos meses presentes no arquivo e grava as novas, numa única transação. Devolve quantas linhas foram gravadas.';

GRANT EXECUTE ON FUNCTION importar_vendas_base(jsonb) TO authenticated;

COMMIT;
