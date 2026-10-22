-- ============================================================================
-- Escala Operadores — Migration: cobertura e conferência na troca de turno
--
-- 1. Nova coluna solicitacoes_troca.tipo:
--    - 'troca' (padrão): os dois blocos de trabalho trocam de dono;
--    - 'cobertura': o colega (de folga) assume o bloco de quem pediu, sem
--      devolver nenhum dia — escala_colega_id fica NULL.
-- 2. aprovar_troca() passa a tratar a cobertura e a devolver quantos turnos
--    mudaram de dono. Se nenhum mudar, a aprovação é recusada (nada fica
--    marcado como "aprovado" sem efeito na escala).
-- ============================================================================

BEGIN;

ALTER TABLE solicitacoes_troca
  ADD COLUMN tipo text NOT NULL DEFAULT 'troca'
    CHECK (tipo IN ('troca', 'cobertura'));

COMMENT ON COLUMN solicitacoes_troca.tipo IS
  'troca: os dois blocos de trabalho trocam de dono. cobertura: o colega assume o bloco de quem pediu, sem devolver dia (escala_colega_id NULL).';

-- O tipo de retorno muda (void → integer), então a função é recriada.
DROP FUNCTION aprovar_troca(uuid);

CREATE FUNCTION aprovar_troca(p_solicitacao_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  s        solicitacoes_troca%ROWTYPE;
  a        escalas%ROWTYPE;
  b        escalas%ROWTYPE;
  movidas  integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar trocas.';
  END IF;

  SELECT * INTO s FROM solicitacoes_troca WHERE id = p_solicitacao_id FOR UPDATE;
  IF NOT FOUND OR s.status <> 'aceito_pelo_colega' THEN
    RAISE EXCEPTION 'Solicitação não está aguardando aprovação.';
  END IF;

  SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar o dia de quem pediu a troca.';
  END IF;

  -- Durante a troca as duas pessoas podem se sobrepor por um instante.
  SET CONSTRAINTS excl_escala_sem_sobreposicao DEFERRED;

  IF s.tipo = 'cobertura' THEN
    -- O colega assume o bloco inteiro de quem pediu.
    UPDATE escalas SET colaborador_id = s.colega_id
    WHERE colaborador_id = a.colaborador_id AND data = a.data;
    GET DIAGNOSTICS movidas = ROW_COUNT;
  ELSE
    IF s.escala_colega_id IS NULL THEN
      RAISE EXCEPTION 'O colega ainda não escolheu o dia que oferece.';
    END IF;

    SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
    IF b.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia oferecido pelo colega.';
    END IF;

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
    GET DIAGNOSTICS movidas = ROW_COUNT;
  END IF;

  IF movidas = 0 THEN
    RAISE EXCEPTION 'Nenhum turno mudou de dono com esta troca. Confira a escala dos dois dias.';
  END IF;

  UPDATE solicitacoes_troca
  SET status = 'aprovado',
      respondido_admin_em = now(),
      admin_id = auth.uid()
  WHERE id = p_solicitacao_id;

  RETURN movidas;
END;
$$;

COMMENT ON FUNCTION aprovar_troca(uuid) IS
  'Aprova uma troca já aceita pelo colega numa única transação: troca os blocos de trabalho (ou, na cobertura, passa o bloco de quem pediu para o colega). Devolve quantos turnos mudaram de dono; recusa se nenhum mudar.';

GRANT EXECUTE ON FUNCTION aprovar_troca(uuid) TO authenticated;

COMMIT;
