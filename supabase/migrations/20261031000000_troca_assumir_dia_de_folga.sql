-- ============================================================================
-- Escala Operadores — Migration: pedido feito a partir de um dia de folga
--
-- Novo tipo de solicitação, 'assumir': quem pede está de folga numa data e
-- quer trabalhar no lugar de um colega que trabalha nela, sem devolver nada
-- (é a cobertura no sentido inverso). O colega fica de folga.
--
-- 1. escala_solicitante_id passa a aceitar NULL — só no tipo 'assumir', que
--    não tem dia de quem pede; nele, escala_colega_id (o dia do colega) é
--    obrigatório desde a criação.
-- 2. aprovar_troca() e aplicar_troca_aprovada() tratam o novo tipo: o bloco
--    do colega naquela data passa para quem pediu. A aprovação é recusada se
--    quem pediu já tiver turno nessa data.
--
-- Todas as linhas existentes têm escala_solicitante_id preenchido (a coluna
-- era NOT NULL) e tipo 'troca' ou 'cobertura', então as novas regras valem
-- para elas sem alteração.
-- ============================================================================

BEGIN;

ALTER TABLE solicitacoes_troca ALTER COLUMN escala_solicitante_id DROP NOT NULL;

ALTER TABLE solicitacoes_troca DROP CONSTRAINT IF EXISTS solicitacoes_troca_tipo_check;
ALTER TABLE solicitacoes_troca
  ADD CONSTRAINT solicitacoes_troca_tipo_check
    CHECK (tipo IN ('troca', 'cobertura', 'assumir'));

ALTER TABLE solicitacoes_troca
  ADD CONSTRAINT solicitacoes_troca_dias_por_tipo CHECK (
    CASE tipo
      WHEN 'assumir' THEN escala_solicitante_id IS NULL AND escala_colega_id IS NOT NULL
      ELSE escala_solicitante_id IS NOT NULL
    END
  );

COMMENT ON COLUMN solicitacoes_troca.tipo IS
  'troca: os dois blocos de trabalho trocam de dono. cobertura: o colega assume o bloco de quem pediu, sem devolver dia (escala_colega_id NULL). assumir: quem pediu, de folga, assume o bloco do colega (escala_solicitante_id NULL).';

-- ----------------------------------------------------------------------------
-- aprovar_troca(): mesma assinatura, com o tipo 'assumir'
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
