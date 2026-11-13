-- ============================================================================
-- Jornada 360 — Migration: troca de turno por turno (não mais pelo dia todo)
--
-- Com o fim de semana em dois horários (Manhã 08–17 e Noite 17–02), cada
-- turno é um período inteiro. Quem está escalado nos dois no mesmo dia (ex.:
-- cobrindo um colega) precisa poder trocar só um deles — antes a troca levava
-- o "bloco" do dia inteiro (08:00–02:00).
--
-- A partir daqui a solicitação vale só para as linhas de escala que ela
-- referencia (escala_solicitante_id / escala_colega_id):
--   - troca: as duas linhas trocam de dono;
--   - cobertura: a linha de quem pediu passa para o colega;
--   - assumir: a linha do colega passa para quem pediu (de folga no dia).
-- Se quem recebe já trabalha num horário que coincide, a aprovação é recusada
-- com o nome e o dia.
--
-- aprovar_troca() e aplicar_troca_aprovada() mantêm a assinatura.
-- cobrir_bloco_do_dia() deixa de ser usada e fica no banco. Nenhum dado
-- existente é alterado.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- passar_turno(): passa uma linha de escala para p_para
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION passar_turno(p_escala uuid, p_para uuid, p_ignorar uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  e     escalas%ROWTYPE;
  nome  text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a escala.';
  END IF;

  SELECT * INTO e FROM escalas WHERE id = p_escala;
  IF e.id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível localizar o turno da troca.';
  END IF;
  IF e.colaborador_id = p_para THEN
    RETURN 0;
  END IF;

  -- p_ignorar: o turno que p_para entrega na mesma troca.
  IF EXISTS (
    SELECT 1 FROM escalas k
    WHERE k.colaborador_id = p_para
      AND k.id IS DISTINCT FROM p_ignorar
      AND tsrange(k.inicio_efetivo, k.fim_efetivo, '[)') && tsrange(e.inicio_efetivo, e.fim_efetivo, '[)')
  ) THEN
    SELECT p.nome_completo INTO nome
    FROM colaboradores c JOIN perfis p ON p.id = c.perfil_id
    WHERE c.id = p_para;
    RAISE EXCEPTION '% já trabalha nesse horário em % (%). A troca não pode ser feita.',
      coalesce(nome, 'O colega'), to_char(e.data, 'DD/MM'), e.turno_nome_snapshot;
  END IF;

  UPDATE escalas SET colaborador_id = p_para WHERE id = p_escala;
  RETURN 1;
END;
$$;

COMMENT ON FUNCTION passar_turno(uuid, uuid, uuid) IS
  'Passa a linha de escala p_escala para p_para (0 se já é dele). Recusa se p_para já tem turno no mesmo horário, sem contar p_ignorar (o turno que ele entrega na mesma troca).';

-- ----------------------------------------------------------------------------
-- aprovar_troca()
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
    -- Quem pediu (de folga no dia) assume o turno do colega.
    SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
    IF b.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o turno do colega.';
    END IF;
    IF EXISTS (SELECT 1 FROM escalas WHERE colaborador_id = s.solicitante_id AND data = b.data) THEN
      RAISE EXCEPTION 'Quem pediu já trabalha nesse dia; o pedido só vale para um dia de folga.';
    END IF;
    movidas := passar_turno(b.id, s.solicitante_id, NULL);
  ELSE
    SELECT * INTO a FROM escalas WHERE id = s.escala_solicitante_id;
    IF a.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o turno de quem pediu a troca.';
    END IF;

    IF s.tipo = 'cobertura' THEN
      movidas := passar_turno(a.id, s.colega_id, NULL);
    ELSE
      IF s.escala_colega_id IS NULL THEN
        RAISE EXCEPTION 'O colega ainda não escolheu o turno que oferece.';
      END IF;
      SELECT * INTO b FROM escalas WHERE id = s.escala_colega_id;
      IF b.id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível localizar o turno oferecido pelo colega.';
      END IF;
      IF a.data = b.data AND a.turno_id = b.turno_id THEN
        RAISE EXCEPTION 'Os dois turnos são o mesmo horário; não há o que trocar.';
      END IF;

      movidas := passar_turno(a.id, b.colaborador_id, b.id)
               + passar_turno(b.id, a.colaborador_id, a.id);
    END IF;
  END IF;

  IF movidas = 0 THEN
    RAISE EXCEPTION 'Nenhum turno mudou de dono com esta troca. Confira a escala.';
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
  'Aprova uma troca já aceita pelo colega numa única transação, só com os turnos referenciados: troca os dois turnos de dono (troca), passa o turno de quem pediu para o colega (cobertura) ou o do colega para quem pediu (assumir). Devolve quantos turnos mudaram de dono; recusa se nenhum mudar.';

-- ----------------------------------------------------------------------------
-- aplicar_troca_aprovada(): completa na escala uma troca já aprovada
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION aplicar_troca_aprovada(p_solicitacao_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  s        solicitacoes_troca%ROWTYPE;
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
    IF s.escala_colega_id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o turno do colega.';
    END IF;
    movidas := passar_turno(s.escala_colega_id, s.solicitante_id, NULL);
  ELSIF s.tipo = 'cobertura' THEN
    movidas := passar_turno(s.escala_solicitante_id, s.colega_id, NULL);
  ELSE
    IF s.escala_colega_id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível localizar o turno oferecido pelo colega.';
    END IF;
    movidas := passar_turno(s.escala_solicitante_id, s.colega_id, s.escala_colega_id)
             + passar_turno(s.escala_colega_id, s.solicitante_id, s.escala_solicitante_id);
  END IF;

  IF movidas = 0 THEN
    RAISE EXCEPTION 'Nada a aplicar: esta troca já está refletida na escala.';
  END IF;

  RETURN movidas;
END;
$$;

COMMENT ON FUNCTION aplicar_troca_aprovada(uuid) IS
  'Completa na escala uma troca já aprovada, movendo só os turnos referenciados que ainda estão com a pessoa errada. Devolve quantos turnos mudaram de dono.';

COMMIT;
