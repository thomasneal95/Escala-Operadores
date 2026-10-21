-- ============================================================================
-- Escala Operadores — Migration: troca de turno por bloco de trabalho
--
-- Com as duplas do fim de semana, cada pessoa trabalha um bloco no dia
-- (Manhã + Tarde ou Tarde + Noite), que são 2 linhas em `escalas`. A troca
-- passa a ser do bloco inteiro: a solicitação continua apontando para uma
-- linha de cada pessoa (escala_solicitante_id / escala_colega_id), e o bloco
-- é "todas as linhas daquela pessoa naquela data".
--
-- 1. aprovar_troca(): o admin aprova e os dois blocos trocam de dono numa
--    única transação (ou nada muda). Se as duas pessoas trabalham na mesma
--    data, só trocam os turnos que não têm em comum (ex.: Manhã ↔ Noite;
--    a Tarde, que as duas fazem, fica como está).
-- 2. Operador pode ver o bloco inteiro do colega envolvido na troca (antes
--    via só a linha referenciada).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Aprovação atômica da troca por bloco
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION aprovar_troca(p_solicitacao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  s   solicitacoes_troca%ROWTYPE;
  a   escalas%ROWTYPE;
  b   escalas%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar trocas.';
  END IF;

  SELECT * INTO s FROM solicitacoes_troca WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'aceito_pelo_colega' OR s.escala_colega_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não está aguardando aprovação.';
  END IF;

  SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
  SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
  IF a.id IS NULL OR b.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar as escalas envolvidas na troca.';
  END IF;

  -- Durante a troca as duas pessoas podem se sobrepor por um instante.
  SET CONSTRAINTS excl_escala_sem_sobreposicao DEFERRED;

  IF a.data = b.data THEN
    -- Mesmo dia: troca só os turnos que uma tem e a outra não.
    WITH bloco_a AS (
      SELECT id, turno_id FROM escalas WHERE colaborador_id = a.colaborador_id AND data = a.data
    ), bloco_b AS (
      SELECT id, turno_id FROM escalas WHERE colaborador_id = b.colaborador_id AND data = b.data
    ), mover AS (
      SELECT id, b.colaborador_id AS novo_dono FROM bloco_a
      WHERE turno_id NOT IN (SELECT turno_id FROM bloco_b)
      UNION ALL
      SELECT id, a.colaborador_id FROM bloco_b
      WHERE turno_id NOT IN (SELECT turno_id FROM bloco_a)
    )
    UPDATE escalas e SET colaborador_id = m.novo_dono
    FROM mover m WHERE e.id = m.id;
  ELSE
    -- Dias diferentes: os blocos inteiros trocam de dono.
    UPDATE escalas e
    SET colaborador_id = CASE
      WHEN e.colaborador_id = a.colaborador_id THEN b.colaborador_id
      ELSE a.colaborador_id
    END
    WHERE (e.colaborador_id = a.colaborador_id AND e.data = a.data)
       OR (e.colaborador_id = b.colaborador_id AND e.data = b.data);
  END IF;

  UPDATE solicitacoes_troca
  SET status = 'aprovado',
      respondido_admin_em = now(),
      admin_id = auth.uid()
  WHERE id = p_solicitacao_id;
END;
$$;

COMMENT ON FUNCTION aprovar_troca(uuid) IS
  'Aprova uma troca já aceita pelo colega: os blocos de trabalho (todas as linhas da pessoa na data) trocam de dono numa única transação.';

GRANT EXECUTE ON FUNCTION aprovar_troca(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Operador vê o bloco inteiro do colega numa troca da qual participa
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER para não cair em recursão de RLS ao consultar escalas
-- dentro de uma policy da própria tabela escalas.

CREATE OR REPLACE FUNCTION escalas_dos_blocos_em_trocas_minhas()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT e.id
  FROM solicitacoes_troca s
  JOIN escalas ref ON ref.id IN (s.escala_solicitante_id, s.escala_colega_id)
  JOIN escalas e ON e.colaborador_id = ref.colaborador_id AND e.data = ref.data
  WHERE s.solicitante_id = meu_colaborador_id() OR s.colega_id = meu_colaborador_id();
$$;

COMMENT ON FUNCTION escalas_dos_blocos_em_trocas_minhas() IS
  'Ids das escalas que fazem parte dos blocos (pessoa + data) envolvidos em trocas do colaborador logado.';

CREATE POLICY "Ver bloco envolvido em solicitacao de troca propria"
ON escalas FOR SELECT
USING (id IN (SELECT escalas_dos_blocos_em_trocas_minhas()));

COMMIT;
