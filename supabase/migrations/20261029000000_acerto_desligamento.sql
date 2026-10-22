-- ============================================================================
-- Escala Operadores — Migration: acerto de desligamento
--
-- 1. desativar_colaborador() passa a aceitar a data de desligamento (padrão:
--    hoje). Ela vira o último dia ativo (desativado_em) e o fim da vigência
--    de equipe — o fechamento usa isso para o auxílio proporcional e para
--    tirar a pessoa da divisão da equipe a partir do dia seguinte.
-- 2. ajustar_desligamento(): corrige a data de quem já foi desativado (e,
--    se faltar, registra a equipe em que a pessoa estava).
-- 3. Garante uma vigência de equipe para quem tem equipe e nenhum registro
--    em historico_equipe (colaboradores criados depois do histórico existir).
--    Sem isso, ao desativar, a pessoa perderia a equipe no fechamento.
-- 4. acertos_desligamento: o acerto pago a quem saiu (foto dos valores). No
--    fechamento do mês, esse valor aparece como "já pago" e é descontado.
-- ============================================================================

BEGIN;

-- 3. Vigência de equipe para quem não tem nenhuma -----------------------------
INSERT INTO historico_equipe (colaborador_id, equipe_id, valido_de, valido_ate)
SELECT c.id, c.equipe_id, COALESCE(c.data_admissao, '2020-01-01'), NULL
FROM colaboradores c
WHERE c.equipe_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM historico_equipe h WHERE h.colaborador_id = c.id);

-- 1. Desativação com data -------------------------------------------------------
DROP FUNCTION desativar_colaborador(uuid);

CREATE FUNCTION desativar_colaborador(p_colaborador_id uuid, p_data_desligamento date DEFAULT NULL)
RETURNS TABLE (escalas_removidas integer, disponibilidades_removidas integer, trocas_canceladas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id uuid;
  v_equipe_id uuid;
  v_admissao date;
  v_data date := COALESCE(p_data_desligamento, current_date);
  v_escalas integer;
  v_disponibilidades integer;
  v_trocas integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem desativar colaboradores.';
  END IF;
  IF v_data > current_date THEN
    RAISE EXCEPTION 'A data de desligamento não pode ser no futuro.';
  END IF;

  SELECT perfil_id, equipe_id, data_admissao INTO v_perfil_id, v_equipe_id, v_admissao
  FROM colaboradores WHERE id = p_colaborador_id;
  IF v_perfil_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado.';
  END IF;
  IF v_perfil_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode desativar o próprio perfil.';
  END IF;

  -- Trocas em andamento são canceladas antes de mexer nas escalas.
  UPDATE solicitacoes_troca
     SET status = 'cancelado'
   WHERE (solicitante_id = p_colaborador_id OR colega_id = p_colaborador_id)
     AND status IN ('pendente', 'aceito_pelo_colega');
  GET DIAGNOSTICS v_trocas = ROW_COUNT;

  DELETE FROM escalas e
   USING periodos_operacao p
   WHERE p.id = e.periodo_id
     AND e.colaborador_id = p_colaborador_id
     AND p.status <> 'encerrado'
     AND p.data_fim >= current_date;
  GET DIAGNOSTICS v_escalas = ROW_COUNT;

  DELETE FROM disponibilidades d
   USING periodos_operacao p
   WHERE p.id = d.periodo_id
     AND d.colaborador_id = p_colaborador_id
     AND p.status <> 'encerrado'
     AND p.data_fim >= current_date;
  GET DIAGNOSTICS v_disponibilidades = ROW_COUNT;

  -- Garante que a equipe atual fique registrada antes de tirar a pessoa dela
  -- (o fechamento precisa saber em qual equipe ela estava até sair).
  IF v_equipe_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM historico_equipe WHERE colaborador_id = p_colaborador_id) THEN
    INSERT INTO historico_equipe (colaborador_id, equipe_id, valido_de, valido_ate)
    VALUES (p_colaborador_id, v_equipe_id, COALESCE(v_admissao, '2020-01-01'), NULL);
  END IF;

  -- Encerra a vigência de equipe em aberto no dia do desligamento.
  UPDATE historico_equipe
     SET valido_ate = GREATEST(valido_de, v_data)
   WHERE colaborador_id = p_colaborador_id
     AND valido_ate IS NULL;

  UPDATE colaboradores
     SET ativo = false,
         desativado_em = COALESCE(desativado_em, v_data),
         equipe_id = NULL,
         calendario_token = gen_random_uuid()
   WHERE id = p_colaborador_id;

  UPDATE perfis SET ativo = false WHERE id = v_perfil_id;

  RETURN QUERY SELECT v_escalas, v_disponibilidades, v_trocas;
END;
$$;

REVOKE ALL ON FUNCTION desativar_colaborador(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION desativar_colaborador(uuid, date) TO authenticated;

-- 2. Ajuste da data de quem já saiu ------------------------------------------------
CREATE OR REPLACE FUNCTION ajustar_desligamento(
  p_colaborador_id uuid,
  p_data_desligamento date,
  p_equipe_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anterior date;
  v_ativo boolean;
  v_admissao date;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem ajustar desligamentos.';
  END IF;
  IF p_data_desligamento > current_date THEN
    RAISE EXCEPTION 'A data de desligamento não pode ser no futuro.';
  END IF;

  SELECT desativado_em, ativo, data_admissao INTO v_anterior, v_ativo, v_admissao
  FROM colaboradores WHERE id = p_colaborador_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Colaborador não encontrado.';
  END IF;
  IF v_ativo THEN
    RAISE EXCEPTION 'Este colaborador está ativo. Desative-o informando a data de desligamento.';
  END IF;

  -- A vigência que terminava na data antiga passa a terminar na nova.
  UPDATE historico_equipe
     SET valido_ate = GREATEST(valido_de, p_data_desligamento)
   WHERE colaborador_id = p_colaborador_id
     AND (valido_ate IS NULL OR valido_ate = v_anterior);

  -- Sem nenhuma vigência registrada: grava a equipe informada.
  IF p_equipe_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM historico_equipe WHERE colaborador_id = p_colaborador_id) THEN
    INSERT INTO historico_equipe (colaborador_id, equipe_id, valido_de, valido_ate)
    VALUES (
      p_colaborador_id,
      p_equipe_id,
      LEAST(COALESCE(v_admissao, '2020-01-01'), p_data_desligamento),
      p_data_desligamento
    );
  END IF;

  UPDATE colaboradores SET desativado_em = p_data_desligamento WHERE id = p_colaborador_id;
END;
$$;

REVOKE ALL ON FUNCTION ajustar_desligamento(uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION ajustar_desligamento(uuid, date, uuid) TO authenticated;

-- 4. Acertos pagos ----------------------------------------------------------------
CREATE TABLE acertos_desligamento (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id         uuid NOT NULL REFERENCES colaboradores (id) ON DELETE CASCADE,
  mes                    date NOT NULL CHECK (extract(day FROM mes) = 1),
  data_desligamento      date NOT NULL,
  auxilio                numeric(10,2) NOT NULL DEFAULT 0,
  comissao_equipe        numeric(10,2) NOT NULL DEFAULT 0,
  comissao_fds           numeric(10,2) NOT NULL DEFAULT 0,
  comissao_infoprodutos  numeric(10,2) NOT NULL DEFAULT 0,
  adiantamento           numeric(10,2) NOT NULL DEFAULT 0,
  valor_pago             numeric(10,2) NOT NULL,
  total_a_pagar          numeric(10,2) NOT NULL,
  ftds                   integer NOT NULL DEFAULT 0,
  base_ate               date,
  pago_em                timestamptz NOT NULL DEFAULT now(),
  registrado_por         uuid REFERENCES perfis (id),
  CONSTRAINT uq_acerto_colaborador_mes UNIQUE (colaborador_id, mes)
);

COMMENT ON TABLE acertos_desligamento IS
  'Acerto pago a quem foi desligado no mês (foto dos valores). valor_pago é o salário do acerto; no fechamento do mês ele é descontado como "já pago".';

ALTER TABLE acertos_desligamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia acertos de desligamento"
ON acertos_desligamento FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON acertos_desligamento TO authenticated;
GRANT ALL ON acertos_desligamento TO service_role;

COMMIT;
