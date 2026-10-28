-- ============================================================================
-- Escala Operadores — Migration: troca e "assumir" quando a pessoa já
-- trabalha em parte do horário que recebe
--
-- Estende à troca (em dias diferentes) e ao tipo 'assumir' a regra criada
-- para a cobertura em 20261101000000: quem recebe um bloco fica só com os
-- turnos que não coincidem com os que já tem; os turnos que coincidem saem
-- da escala. Antes a troca inteira era recusada pela restrição
-- excl_escala_sem_sobreposicao.
--
-- cobrir_bloco_do_dia() ganha o parâmetro p_data_saindo: na troca, o bloco
-- que quem recebe está entregando nessa data não conta como coincidência
-- (ele sai da pessoa na mesma transação). A versão de 3 parâmetros é
-- substituída. A mensagem de recusa passa a dizer quem e em que dia.
--
-- Só muda o comportamento de aprovações que hoje falham; nenhum dado
-- existente é alterado pela migration.
-- ============================================================================

BEGIN;

DROP FUNCTION cobrir_bloco_do_dia(uuid, uuid, date);

CREATE FUNCTION cobrir_bloco_do_dia(p_de uuid, p_para uuid, p_data date, p_data_saindo date)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  movidos      uuid[];
  coincidentes uuid[];
  nome         text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a escala.';
  END IF;

  -- Turnos de p_de num horário em que p_para já trabalha (sem contar o
  -- bloco que p_para entrega em p_data_saindo).
  SELECT coalesce(array_agg(e.id), '{}') INTO coincidentes
  FROM escalas e
  WHERE e.colaborador_id = p_de AND e.data = p_data
    AND EXISTS (
      SELECT 1 FROM escalas k
      WHERE k.colaborador_id = p_para
        AND k.data IS DISTINCT FROM p_data_saindo
        AND tsrange(k.inicio_efetivo, k.fim_efetivo, '[)') && tsrange(e.inicio_efetivo, e.fim_efetivo, '[)')
    );

  SELECT array_agg(e.id ORDER BY e.inicio_efetivo) INTO movidos
  FROM escalas e
  WHERE e.colaborador_id = p_de AND e.data = p_data AND e.id <> ALL (coincidentes);

  IF movidos IS NULL THEN
    IF cardinality(coincidentes) > 0 THEN
      SELECT p.nome_completo INTO nome
      FROM colaboradores c JOIN perfis p ON p.id = c.perfil_id
      WHERE c.id = p_para;
      RAISE EXCEPTION '% já trabalha em todo o horário que receberia em %; não há turno para passar.',
        coalesce(nome, 'O colega'), to_char(p_data, 'DD/MM');
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

COMMENT ON FUNCTION cobrir_bloco_do_dia(uuid, uuid, date, date) IS
  'Passa para p_para os turnos de p_de na data que não coincidem com os dele (ignorando o bloco que p_para entrega em p_data_saindo); os que coincidem saem da escala. Devolve quantos turnos mudaram (movidos + removidos); recusa se todos coincidirem.';

-- ----------------------------------------------------------------------------
-- aprovar_troca() e aplicar_troca_aprovada(): mesma assinatura; troca em
-- dias diferentes e 'assumir' passam a usar cobrir_bloco_do_dia()
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

    movidas := cobrir_bloco_do_dia(s.colega_id, s.solicitante_id, b.data, NULL);
  ELSE
    SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
    IF a.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia de quem pediu a troca.';
    END IF;

    IF s.tipo = 'cobertura' THEN
      -- O colega assume o bloco de quem pediu (o que não coincide com os
      -- turnos que ele já tem).
      movidas := cobrir_bloco_do_dia(a.colaborador_id, s.colega_id, a.data, NULL);
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
        GET DIAGNOSTICS movidas = ROW_COUNT;
      ELSE
        -- Dias diferentes: os blocos trocam de dono; cada um recebe só os
        -- turnos que não coincidem com os que já tem.
        movidas := cobrir_bloco_do_dia(a.colaborador_id, b.colaborador_id, a.data, b.data)
                 + cobrir_bloco_do_dia(b.colaborador_id, a.colaborador_id, b.data, NULL);
      END IF;
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
    movidas := cobrir_bloco_do_dia(s.colega_id, s.solicitante_id, b.data, NULL);
  ELSE
    SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
    IF a.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o dia de quem pediu a troca.';
    END IF;

    IF s.tipo = 'cobertura' THEN
      movidas := cobrir_bloco_do_dia(s.solicitante_id, s.colega_id, a.data, NULL);
    ELSE
      SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
      IF b.id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível localizar o dia oferecido pelo colega.';
      END IF;

      IF a.data <> b.data THEN
        movidas := cobrir_bloco_do_dia(s.solicitante_id, s.colega_id, a.data, b.data)
                 + cobrir_bloco_do_dia(s.colega_id, s.solicitante_id, b.data, NULL);
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
