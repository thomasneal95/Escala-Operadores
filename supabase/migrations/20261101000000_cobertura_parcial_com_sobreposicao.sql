-- ============================================================================
-- Escala Operadores — Migration: cobertura quando o colega já trabalha em
-- parte do horário
--
-- Antes, uma cobertura em que o colega já tinha turno sobreposto no mesmo
-- horário (ex.: quem pede está na Manhã + Tarde e o colega na Tarde + Noite)
-- era recusada inteira pela restrição excl_escala_sem_sobreposicao.
--
-- Agora o colega cobre só os turnos que não coincidem com os dele; os turnos
-- de quem pediu que coincidem saem da escala (o horário já tem o colega). Se
-- todos coincidirem, a cobertura continua sendo recusada.
--
-- Como solicitacoes_troca referencia escalas com ON DELETE CASCADE, antes de
-- excluir um turno as solicitações que apontam para ele passam a apontar para
-- um turno do mesmo bloco que foi para o colega — nenhuma solicitação some.
--
-- Só muda o comportamento de coberturas que hoje falham; as demais seguem
-- iguais. Nenhum dado existente é alterado pela migration.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- cobrir_bloco_do_dia(): passa o bloco de p_de na data para p_para
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION cobrir_bloco_do_dia(p_de uuid, p_para uuid, p_data date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  movidos      uuid[];
  coincidentes uuid[];
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a escala.';
  END IF;

  -- Turnos de quem pediu num horário em que o colega já trabalha.
  SELECT coalesce(array_agg(e.id), '{}') INTO coincidentes
  FROM escalas e
  WHERE e.colaborador_id = p_de AND e.data = p_data
    AND EXISTS (
      SELECT 1 FROM escalas k
      WHERE k.colaborador_id = p_para
        AND tsrange(k.inicio_efetivo, k.fim_efetivo, '[)') && tsrange(e.inicio_efetivo, e.fim_efetivo, '[)')
    );

  SELECT array_agg(e.id ORDER BY e.inicio_efetivo) INTO movidos
  FROM escalas e
  WHERE e.colaborador_id = p_de AND e.data = p_data AND e.id <> ALL (coincidentes);

  IF movidos IS NULL THEN
    IF cardinality(coincidentes) > 0 THEN
      RAISE EXCEPTION 'O colega já trabalha em todo esse horário; não há turno para ele cobrir.';
    END IF;
    RETURN 0;
  END IF;

  UPDATE escalas SET colaborador_id = p_para WHERE id = ANY (movidos);

  IF cardinality(coincidentes) > 0 THEN
    UPDATE solicitacoes_troca SET escala_solicitante_id = movidos[1]
    WHERE escala_solicitante_id = ANY (coincidentes);
    UPDATE solicitacoes_troca SET escala_colega_id = movidos[1]
    WHERE escala_colega_id = ANY (coincidentes);
    DELETE FROM escalas WHERE id = ANY (coincidentes);
  END IF;

  RETURN cardinality(movidos) + cardinality(coincidentes);
END;
$$;

COMMENT ON FUNCTION cobrir_bloco_do_dia(uuid, uuid, date) IS
  'Cobertura: passa para p_para os turnos de p_de na data que não coincidem com os dele; os que coincidem saem da escala. Devolve quantos turnos mudaram (movidos + removidos); recusa se todos coincidirem.';

-- ----------------------------------------------------------------------------
-- aprovar_troca() e aplicar_troca_aprovada(): mesma assinatura; a cobertura
-- passa a usar cobrir_bloco_do_dia()
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION aprovar_troca(p_solicitacao_id uuid)
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

  -- Durante a troca as duas pessoas podem se sobrepor por um instante.
  SET CONSTRAINTS excl_escala_sem_sobreposicao DEFERRED;

  IF s.tipo = 'assumir' THEN
    -- Quem pediu (de folga) assume o bloco inteiro do colega.
    SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
    IF b.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia do colega.';
    END IF;
    IF EXISTS (SELECT 1 FROM escalas WHERE colaborador_id = s.solicitante_id AND data = b.data) THEN
      RAISE EXCEPTION 'Quem pediu já trabalha nesse dia; o pedido só vale para um dia de folga.';
    END IF;

    UPDATE escalas SET colaborador_id = s.solicitante_id
    WHERE colaborador_id = s.colega_id AND data = b.data;
    GET DIAGNOSTICS movidas = ROW_COUNT;
  ELSE
    SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
    IF a.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia de quem pediu a troca.';
    END IF;

    IF s.tipo = 'cobertura' THEN
      -- O colega assume o bloco de quem pediu (o que não coincide com os
      -- turnos que ele já tem).
      movidas := cobrir_bloco_do_dia(a.colaborador_id, s.colega_id, a.data);
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
  'Aprova uma troca já aceita pelo colega numa única transação: troca os blocos de trabalho, passa o bloco de quem pediu para o colega (cobertura) ou o do colega para quem pediu (assumir). Devolve quantos turnos mudaram de dono; recusa se nenhum mudar.';

-- ----------------------------------------------------------------------------
-- aplicar_troca_aprovada(): mesma assinatura, com o tipo 'assumir'
-- ----------------------------------------------------------------------------

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

  SET CONSTRAINTS excl_escala_sem_sobreposicao DEFERRED;

  IF s.tipo = 'assumir' THEN
    SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
    IF b.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia do colega.';
    END IF;
    UPDATE escalas SET colaborador_id = s.solicitante_id
    WHERE colaborador_id = s.colega_id AND data = b.data;
    GET DIAGNOSTICS movidas = ROW_COUNT;
  ELSE
    SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
    IF a.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia de quem pediu a troca.';
    END IF;

    IF s.tipo = 'cobertura' THEN
      movidas := cobrir_bloco_do_dia(s.solicitante_id, s.colega_id, a.data);
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
  END IF;

  IF movidas = 0 THEN
    RAISE EXCEPTION 'Nada a aplicar: esta troca já está refletida na escala.';
  END IF;

  RETURN movidas;
END;
$$;

COMMENT ON FUNCTION aplicar_troca_aprovada(uuid) IS
  'Completa na escala uma troca já aprovada (bloco de trabalho do dia), movendo só os turnos que ainda estão com a pessoa errada. Devolve quantos turnos mudaram de dono.';

COMMIT;
