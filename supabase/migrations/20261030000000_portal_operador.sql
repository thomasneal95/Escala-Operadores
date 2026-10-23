-- ============================================================================
-- Escala Operadores — Migration: portal do operador (ganhos, recibos, dupla
-- e registro de infoprodutos)
--
-- O operador passa a ver os PRÓPRIOS dados de comissão. Tudo continua
-- fechado no banco: cada acesso abaixo só devolve o que é da pessoa logada.
--
--   1. vendas_infoprodutos: o operador registra as próprias vendas, que
--      entram como "pendente" até o admin conferir (só "confirmada" entra
--      no fechamento). Vendas lançadas pelo admin nascem confirmadas.
--   2. Recibos: o operador lê as próprias linhas do histórico de comissões.
--   3. minha_dupla(): a dupla do fim de semana da pessoa (para o rodízio).
-- (Os ganhos do mês em andamento vêm da edge function meu-fechamento, que
-- devolve só a linha da própria pessoa e números agregados da equipe.)
-- ============================================================================

BEGIN;

-- 1. Registro de infoprodutos pelo operador ------------------------------------
ALTER TABLE vendas_infoprodutos
  ADD COLUMN colaborador_id uuid REFERENCES colaboradores (id) ON DELETE SET NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'confirmada'
    CHECK (status IN ('pendente', 'confirmada', 'recusada')),
  ADD COLUMN conferido_em timestamptz,
  ADD COLUMN conferido_por uuid REFERENCES perfis (id);

COMMENT ON COLUMN vendas_infoprodutos.status IS
  'pendente: lançada pelo operador, aguardando conferência do admin. confirmada: entra no fechamento. recusada: não entra.';
COMMENT ON COLUMN vendas_infoprodutos.colaborador_id IS
  'Quem registrou a venda pelo portal (NULL quando lançada pelo admin).';

-- O operador vê as vendas dele (registradas por ele ou lançadas no nome dele).
CREATE POLICY "Operador ve as proprias vendas de infoprodutos"
ON vendas_infoprodutos FOR SELECT
USING (
  colaborador_id = meu_colaborador_id()
  OR lower(btrim(operador)) = (
    SELECT lower(btrim(c.nome_base)) FROM colaboradores c WHERE c.id = meu_colaborador_id()
  )
);

CREATE OR REPLACE FUNCTION registrar_venda_infoproduto(
  p_data date,
  p_produto text,
  p_email_lead text,
  p_valor numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador uuid := meu_colaborador_id();
  v_nome_base text;
  v_ativo boolean;
  v_id uuid;
BEGIN
  SELECT nome_base, ativo INTO v_nome_base, v_ativo FROM colaboradores WHERE id = v_colaborador;
  IF v_colaborador IS NULL OR NOT COALESCE(v_ativo, false) THEN
    RAISE EXCEPTION 'Seu cadastro de colaborador não está ativo.';
  END IF;
  IF v_nome_base IS NULL THEN
    RAISE EXCEPTION 'Seu nome ainda não foi ligado à base de vendas. Avise o administrador.';
  END IF;
  IF p_data IS NULL OR p_data > current_date THEN
    RAISE EXCEPTION 'Informe uma data de venda válida (não pode ser no futuro).';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe o valor da venda.';
  END IF;
  IF coalesce(btrim(p_produto), '') = '' THEN
    RAISE EXCEPTION 'Informe o produto.';
  END IF;

  INSERT INTO vendas_infoprodutos (data, produto, email_lead, operador, valor, status, colaborador_id, criado_por)
  VALUES (p_data, btrim(p_produto), nullif(btrim(p_email_lead), ''), v_nome_base, p_valor, 'pendente', v_colaborador, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Edita ou exclui uma venda própria enquanto ainda está pendente.
CREATE OR REPLACE FUNCTION editar_venda_infoproduto_pendente(
  p_id uuid,
  p_data date,
  p_produto text,
  p_email_lead text,
  p_valor numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_data IS NULL OR p_data > current_date OR p_valor IS NULL OR p_valor <= 0
     OR coalesce(btrim(p_produto), '') = '' THEN
    RAISE EXCEPTION 'Confira a data, o produto e o valor.';
  END IF;
  UPDATE vendas_infoprodutos
     SET data = p_data, produto = btrim(p_produto), email_lead = nullif(btrim(p_email_lead), ''), valor = p_valor
   WHERE id = p_id AND colaborador_id = meu_colaborador_id() AND status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só é possível alterar as suas vendas que ainda estão pendentes.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION excluir_venda_infoproduto_pendente(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM vendas_infoprodutos
   WHERE id = p_id AND colaborador_id = meu_colaborador_id() AND status = 'pendente';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Só é possível excluir as suas vendas que ainda estão pendentes.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION registrar_venda_infoproduto(date, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION editar_venda_infoproduto_pendente(uuid, date, text, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION excluir_venda_infoproduto_pendente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_venda_infoproduto(date, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION editar_venda_infoproduto_pendente(uuid, date, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION excluir_venda_infoproduto_pendente(uuid) TO authenticated;

-- 2. Recibos: o operador lê as próprias linhas do histórico ---------------------
CREATE POLICY "Operador ve o proprio historico de comissoes"
ON historico_comissoes FOR SELECT
USING (colaborador_id = meu_colaborador_id());

CREATE POLICY "Operador ve os meses arquivados em que tem recibo"
ON meses_arquivados FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM historico_comissoes h
    WHERE h.mes = meses_arquivados.mes AND h.colaborador_id = meu_colaborador_id()
  )
);

-- 3. Minha dupla do fim de semana ------------------------------------------------
CREATE OR REPLACE FUNCTION minha_dupla()
RETURNS TABLE (numero smallint, posicao text, parceiro text, equipe text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    d.numero,
    CASE WHEN d.manha_tarde_id = meu_colaborador_id() THEN 'manha_tarde' ELSE 'tarde_noite' END,
    (SELECT p.nome_completo
       FROM colaboradores c JOIN perfis p ON p.id = c.perfil_id
      WHERE c.id = CASE WHEN d.manha_tarde_id = meu_colaborador_id() THEN d.tarde_noite_id ELSE d.manha_tarde_id END),
    e.nome
  FROM duplas_fim_de_semana d
  JOIN equipes e ON e.id = d.equipe_id
  WHERE meu_colaborador_id() IN (d.manha_tarde_id, d.tarde_noite_id);
$$;

REVOKE ALL ON FUNCTION minha_dupla() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION minha_dupla() TO authenticated;

COMMIT;
