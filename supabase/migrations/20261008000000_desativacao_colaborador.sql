-- ============================================================================
-- Escala Operadores — Migration: desativação de colaborador
--
-- Desativar tira a pessoa de tudo que é atual/futuro e preserva o histórico:
--   * marca colaboradores.ativo / perfis.ativo = false e guarda a data;
--   * encerra a vigência de equipe (historico_equipe) e tira da equipe;
--   * remove escalas e disponibilidades de períodos ainda não terminados
--     (status <> 'encerrado' e data_fim >= hoje);
--   * cancela trocas pendentes em que a pessoa está envolvida;
--   * troca o token do calendário (o link .ics antigo para de funcionar).
-- Escalas, disponibilidades, faltas, multas, fechamentos etc. de períodos
-- passados não são tocados.
--
-- O bloqueio do login (ban no Auth) é feito pela edge function
-- desativar-colaborador, que chama estas funções.
-- ============================================================================

BEGIN;

ALTER TABLE colaboradores
  ADD COLUMN desativado_em date;

COMMENT ON COLUMN colaboradores.desativado_em IS
  'Último dia em que o colaborador esteve ativo (data da desativação). NULL = ativo, ou desativado antes desta coluna existir. Usado no fechamento mensal para incluir quem saiu no meio do mês.';

-- ----------------------------------------------------------------------------
-- Prévia: o que será removido ao desativar (para a tela de confirmação).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION previa_desativacao_colaborador(p_colaborador_id uuid)
RETURNS TABLE (escalas_futuras integer, disponibilidades_futuras integer, trocas_pendentes integer)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem desativar colaboradores.';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*)::integer
       FROM escalas e
       JOIN periodos_operacao p ON p.id = e.periodo_id
      WHERE e.colaborador_id = p_colaborador_id
        AND p.status <> 'encerrado'
        AND p.data_fim >= current_date),
    (SELECT count(*)::integer
       FROM disponibilidades d
       JOIN periodos_operacao p ON p.id = d.periodo_id
      WHERE d.colaborador_id = p_colaborador_id
        AND p.status <> 'encerrado'
        AND p.data_fim >= current_date),
    (SELECT count(*)::integer
       FROM solicitacoes_troca t
      WHERE (t.solicitante_id = p_colaborador_id OR t.colega_id = p_colaborador_id)
        AND t.status IN ('pendente', 'aceito_pelo_colega'));
END;
$$;

-- ----------------------------------------------------------------------------
-- Desativação (idempotente: rodar de novo não causa problema).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION desativar_colaborador(p_colaborador_id uuid)
RETURNS TABLE (escalas_removidas integer, disponibilidades_removidas integer, trocas_canceladas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id uuid;
  v_escalas integer;
  v_disponibilidades integer;
  v_trocas integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem desativar colaboradores.';
  END IF;

  SELECT perfil_id INTO v_perfil_id FROM colaboradores WHERE id = p_colaborador_id;
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

  -- Encerra a vigência de equipe em aberto (mantém o histórico para o
  -- fechamento mensal saber em qual equipe a pessoa estava).
  UPDATE historico_equipe
     SET valido_ate = GREATEST(valido_de, current_date)
   WHERE colaborador_id = p_colaborador_id
     AND valido_ate IS NULL;

  UPDATE colaboradores
     SET ativo = false,
         desativado_em = COALESCE(desativado_em, current_date),
         equipe_id = NULL,
         calendario_token = gen_random_uuid()
   WHERE id = p_colaborador_id;

  UPDATE perfis SET ativo = false WHERE id = v_perfil_id;

  RETURN QUERY SELECT v_escalas, v_disponibilidades, v_trocas;
END;
$$;

-- ----------------------------------------------------------------------------
-- Reativação: devolve o status ativo. A equipe deve ser escolhida de novo
-- na tela de Colaboradores.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reativar_colaborador(p_colaborador_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil_id uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem reativar colaboradores.';
  END IF;

  SELECT perfil_id INTO v_perfil_id FROM colaboradores WHERE id = p_colaborador_id;
  IF v_perfil_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado.';
  END IF;

  UPDATE colaboradores
     SET ativo = true,
         desativado_em = NULL
   WHERE id = p_colaborador_id;

  UPDATE perfis SET ativo = true WHERE id = v_perfil_id;
END;
$$;

REVOKE ALL ON FUNCTION previa_desativacao_colaborador(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION desativar_colaborador(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reativar_colaborador(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION previa_desativacao_colaborador(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION desativar_colaborador(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reativar_colaborador(uuid) TO authenticated;

COMMIT;
