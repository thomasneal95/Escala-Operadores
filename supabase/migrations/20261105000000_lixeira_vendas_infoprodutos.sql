-- ============================================================================
-- Jornada 360 — Migration: lixeira das vendas de infoprodutos
--
-- Uma venda excluída (pelo admin ou pelo operador, na própria venda
-- pendente) não se perde mais: antes de sair de vendas_infoprodutos, a linha
-- inteira é copiada para vendas_infoprodutos_excluidas, de onde o admin pode
-- restaurá-la com o mesmo id, status e dados.
--
--   1. vendas_infoprodutos_excluidas: cópia da venda + quando e quem excluiu.
--   2. Gatilho BEFORE DELETE que guarda a cópia.
--   3. restaurar_venda_infoproduto(): devolve a venda (só admin).
--
-- Só objetos novos: nada do que já existe é alterado. A venda continua
-- saindo de vendas_infoprodutos, então o fechamento e o portal do operador
-- não precisam mudar.
-- ============================================================================

BEGIN;

-- 1. Lixeira ------------------------------------------------------------------
CREATE TABLE vendas_infoprodutos_excluidas (
  id            uuid PRIMARY KEY,
  data          date NOT NULL,
  dados         jsonb NOT NULL,
  excluido_em   timestamptz NOT NULL DEFAULT now(),
  excluido_por  uuid REFERENCES perfis (id) ON DELETE SET NULL
);

CREATE INDEX ix_vendas_infoprodutos_excluidas_data ON vendas_infoprodutos_excluidas (data);

COMMENT ON TABLE vendas_infoprodutos_excluidas IS
  'Lixeira das vendas de infoprodutos: a linha completa (dados) de cada venda excluída, para poder restaurar. id é o id original da venda.';

ALTER TABLE vendas_infoprodutos_excluidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin ve a lixeira de infoprodutos"
ON vendas_infoprodutos_excluidas FOR SELECT USING (is_admin());
GRANT SELECT ON vendas_infoprodutos_excluidas TO authenticated;
GRANT ALL ON vendas_infoprodutos_excluidas TO service_role;

-- 2. Guarda a cópia antes de excluir ------------------------------------------
CREATE OR REPLACE FUNCTION guardar_venda_infoproduto_excluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO vendas_infoprodutos_excluidas (id, data, dados, excluido_por)
  VALUES (OLD.id, OLD.data, to_jsonb(OLD), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET data = EXCLUDED.data, dados = EXCLUDED.dados,
        excluido_em = now(), excluido_por = EXCLUDED.excluido_por;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION guardar_venda_infoproduto_excluida() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guardar_venda_infoproduto_excluida
  BEFORE DELETE ON vendas_infoprodutos
  FOR EACH ROW EXECUTE FUNCTION guardar_venda_infoproduto_excluida();

-- 3. Restaurar ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restaurar_venda_infoproduto(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  guardada vendas_infoprodutos_excluidas;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem restaurar vendas.';
  END IF;

  SELECT * INTO guardada FROM vendas_infoprodutos_excluidas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada na lixeira.';
  END IF;

  INSERT INTO vendas_infoprodutos
  SELECT * FROM jsonb_populate_record(NULL::vendas_infoprodutos, guardada.dados);

  DELETE FROM vendas_infoprodutos_excluidas WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION restaurar_venda_infoproduto(uuid) IS
  'Devolve uma venda da lixeira para vendas_infoprodutos, com o mesmo id, status e dados de quando foi excluída.';

REVOKE ALL ON FUNCTION restaurar_venda_infoproduto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION restaurar_venda_infoproduto(uuid) TO authenticated;

COMMIT;
