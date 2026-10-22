-- ============================================================================
-- Escala Operadores — Migration: aplicar na escala trocas já aprovadas
--
-- Algumas trocas ficaram "aprovadas" sem chegar (ou chegando só em parte) à
-- escala — ex.: aprovadas quando a troca ainda era turno a turno. Esta
-- função completa a troca para o bloco de trabalho do dia:
--   - troca entre dias diferentes: os turnos que quem pediu ainda tem no dia
--     que entregou vão para o colega, e os que o colega ainda tem no dia que
--     deu vão para quem pediu;
--   - troca no mesmo dia: só se nada foi aplicado ainda (as duas linhas de
--     referência continuam com os donos originais), troca os turnos que uma
--     pessoa tem e a outra não;
--   - cobertura: os turnos que quem pediu ainda tem no dia vão para o colega.
-- Só move o que ainda está com a pessoa errada — não desfaz o que já foi
-- aplicado. Devolve quantos turnos mudaram de dono.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION aplicar_troca_aprovada(p_solicitacao_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  s        solicitacoes_troca%ROWTYPE;
  a        escalas%ROWTYPE;
  b        escalas%ROWTYPE;
  movidas  integer := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aplicar trocas.';
  END IF;

  SELECT * INTO s FROM solicitacoes_troca WHERE id = p_solicitacao_id;
  IF NOT FOUND OR s.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Só trocas aprovadas podem ser aplicadas.';
  END IF;

  SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
  IF a.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar o dia de quem pediu a troca.';
  END IF;

  SET CONSTRAINTS excl_escala_sem_sobreposicao DEFERRED;

  IF s.tipo = 'cobertura' THEN
    UPDATE escalas SET colaborador_id = s.colega_id
    WHERE colaborador_id = s.solicitante_id AND data = a.data;
    GET DIAGNOSTICS movidas = ROW_COUNT;
  ELSE
    SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
    IF b.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia oferecido pelo colega.';
    END IF;

    IF a.data <> b.data THEN
      UPDATE escalas e
      SET colaborador_id = CASE
        WHEN e.data = a.data THEN s.colega_id
        ELSE s.solicitante_id
      END
      WHERE (e.colaborador_id = s.solicitante_id AND e.data = a.data)
         OR (e.colaborador_id = s.colega_id AND e.data = b.data);
      GET DIAGNOSTICS movidas = ROW_COUNT;
    ELSIF a.colaborador_id = s.solicitante_id AND b.colaborador_id = s.colega_id THEN
      WITH bloco_a AS (
        SELECT id, turno_id FROM escalas WHERE colaborador_id = s.solicitante_id AND data = a.data
      ), bloco_b AS (
        SELECT id, turno_id FROM escalas WHERE colaborador_id = s.colega_id AND data = b.data
      ), mover AS (
        SELECT id, s.colega_id AS novo_dono FROM bloco_a
        WHERE turno_id NOT IN (SELECT turno_id FROM bloco_b)
        UNION ALL
        SELECT id, s.solicitante_id FROM bloco_b
        WHERE turno_id NOT IN (SELECT turno_id FROM bloco_a)
      )
      UPDATE escalas e SET colaborador_id = m.novo_dono
      FROM mover m WHERE e.id = m.id;
      GET DIAGNOSTICS movidas = ROW_COUNT;
    END IF;
  END IF;

  IF movidas = 0 THEN
    RAISE EXCEPTION 'Nada a aplicar: esta troca já está refletida na escala.';
  END IF;

  RETURN movidas;
END;
$$;

COMMENT ON FUNCTION aplicar_troca_aprovada(uuid) IS
  'Completa na escala uma troca já aprovada (bloco de trabalho do dia), movendo só os turnos que ainda estão com a pessoa errada. Devolve quantos turnos mudaram de dono.';

GRANT EXECUTE ON FUNCTION aplicar_troca_aprovada(uuid) TO authenticated;

COMMIT;
