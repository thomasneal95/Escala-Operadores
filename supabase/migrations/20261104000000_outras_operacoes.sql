-- ============================================================================
-- Jornada 360 — Migration: outras operações
--
-- Alguns atendentes também trabalham em outras operações. Cada operação tem
-- a sua própria base de vendas (o admin sobe o Excel, no mesmo formato da
-- base de FTDs) e o seu próprio fechamento; a divisão (individual ou em
-- equipe) é decidida mês a mês, depois de ver o resultado. O total a pagar
-- por pessoa (operação principal + outras) é somado no site.
--
--   1. operacoes: cadastro das operações.
--   2. vendas_operacoes: linhas da base de cada operação (uma por venda).
--   3. operacao_operadores: liga o nome na base ao colaborador.
--   4. operacao_fechamentos: valor por venda de cada operação no mês.
--   5. operacao_divisao: como cada pessoa recebe no mês (individual,
--      equipe ou sem pagamento).
--   6. importar_vendas_operacao(): substitui, de uma vez, os meses do
--      arquivo naquela operação.
--
-- Só tabelas novas: nada do que já existe é alterado.
-- ============================================================================

BEGIN;

-- 1. Operações ------------------------------------------------------------------
CREATE TABLE operacoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL CHECK (btrim(nome) <> ''),
  ativo      boolean NOT NULL DEFAULT true,
  criado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_operacoes_nome ON operacoes (lower(btrim(nome)));

COMMENT ON TABLE operacoes IS
  'Outras operações (além da principal) em que os atendentes também vendem. Cada uma tem base e fechamento próprios.';

ALTER TABLE operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia operacoes"
ON operacoes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON operacoes TO authenticated;
GRANT ALL ON operacoes TO service_role;

-- 2. Base de vendas de cada operação ---------------------------------------------
CREATE TABLE vendas_operacoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao_id    uuid NOT NULL REFERENCES operacoes (id) ON DELETE CASCADE,
  cliente        text,
  operador       text NOT NULL,
  lead_telefone  text,
  etapa          text NOT NULL,
  data           date NOT NULL,
  hora           time NOT NULL,
  importado_em   timestamptz NOT NULL DEFAULT now(),
  importado_por  uuid REFERENCES perfis (id)
);

CREATE INDEX ix_vendas_operacoes_operacao_data ON vendas_operacoes (operacao_id, data);

COMMENT ON TABLE vendas_operacoes IS
  'Base de vendas de cada outra operação, importada do Excel (uma linha por venda). Mesma regra de Dia Real e de "Rejeitado" da base principal.';

ALTER TABLE vendas_operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia vendas das operacoes"
ON vendas_operacoes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON vendas_operacoes TO authenticated;
GRANT ALL ON vendas_operacoes TO service_role;

-- 3. Nome na base → colaborador ----------------------------------------------------
CREATE TABLE operacao_operadores (
  operacao_id     uuid NOT NULL REFERENCES operacoes (id) ON DELETE CASCADE,
  nome_base       text NOT NULL,
  colaborador_id  uuid REFERENCES colaboradores (id) ON DELETE SET NULL,
  PRIMARY KEY (operacao_id, nome_base)
);

COMMENT ON TABLE operacao_operadores IS
  'Liga o nome do operador na base de uma operação ao colaborador, para somar no pagamento geral. Sem linha, o site tenta pelo nome na base / nome do colaborador.';

ALTER TABLE operacao_operadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia operadores das operacoes"
ON operacao_operadores FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON operacao_operadores TO authenticated;
GRANT ALL ON operacao_operadores TO service_role;

-- 4. Valor por venda no mês ---------------------------------------------------------
CREATE TABLE operacao_fechamentos (
  operacao_id    uuid NOT NULL REFERENCES operacoes (id) ON DELETE CASCADE,
  mes            date NOT NULL CHECK (extract(day FROM mes) = 1),
  valor_por_ftd  numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_por_ftd >= 0),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operacao_id, mes)
);

COMMENT ON TABLE operacao_fechamentos IS
  'Valor pago por venda válida em cada operação e mês.';

ALTER TABLE operacao_fechamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia fechamentos das operacoes"
ON operacao_fechamentos FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON operacao_fechamentos TO authenticated;
GRANT ALL ON operacao_fechamentos TO service_role;

-- 5. Divisão do mês ---------------------------------------------------------------
CREATE TABLE operacao_divisao (
  operacao_id  uuid NOT NULL REFERENCES operacoes (id) ON DELETE CASCADE,
  mes          date NOT NULL CHECK (extract(day FROM mes) = 1),
  nome_base    text NOT NULL,
  modo         text NOT NULL CHECK (modo IN ('individual', 'equipe', 'sem_pagamento')),
  equipe       text,
  PRIMARY KEY (operacao_id, mes, nome_base),
  CHECK (modo <> 'equipe' OR coalesce(btrim(equipe), '') <> '')
);

COMMENT ON TABLE operacao_divisao IS
  'Como cada pessoa recebe numa operação e mês. individual: as próprias vendas × valor; equipe: vendas da equipe × valor, divididas igualmente entre os membros; sem_pagamento: não recebe. Sem linha = individual.';

ALTER TABLE operacao_divisao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia divisao das operacoes"
ON operacao_divisao FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON operacao_divisao TO authenticated;
GRANT ALL ON operacao_divisao TO service_role;

-- 6. Importação ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION importar_vendas_operacao(p_operacao_id uuid, p_linhas jsonb)
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
  IF NOT EXISTS (SELECT 1 FROM operacoes WHERE id = p_operacao_id) THEN
    RAISE EXCEPTION 'Operação não encontrada.';
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
    DELETE FROM vendas_operacoes v
    WHERE v.operacao_id = p_operacao_id
      AND date_trunc('month', v.data) IN (SELECT DISTINCT date_trunc('month', data) FROM novas)
    RETURNING 1
  )
  INSERT INTO vendas_operacoes (operacao_id, cliente, operador, lead_telefone, etapa, data, hora, importado_por)
  SELECT p_operacao_id, cliente, operador, lead_telefone, etapa, data, hora, auth.uid() FROM novas;
  GET DIAGNOSTICS inseridas = ROW_COUNT;

  RETURN inseridas;
END;
$$;

COMMENT ON FUNCTION importar_vendas_operacao(uuid, jsonb) IS
  'Importa a base de uma operação: apaga as vendas já importadas dessa operação nos meses presentes no arquivo e grava as novas, numa única transação.';

GRANT EXECUTE ON FUNCTION importar_vendas_operacao(uuid, jsonb) TO authenticated;

COMMIT;
