-- ============================================================================
-- Jornada 360 — Migration: fim de semana em dois horários
--
-- A partir do fim de semana de 14/11/2026 a dupla deixa de dividir a tarde:
-- quem fazia Manhã + Tarde passa a fazer a Manhã das 08:00 às 17:00 e quem
-- fazia Tarde + Noite passa a fazer a Noite das 17:00 às 02:00.
--
-- 1. Turnos: Manhã 08:00–17:00, Noite 17:00–02:00 e a Tarde desativada (não
--    é apagada — as escalas antigas continuam apontando para ela).
-- 2. Escalas de 14/11/2026 em diante (as anteriores ficam como foram):
--    - quem tem a Tarde junto com a Manhã ou a Noite no dia perde a linha da
--      Tarde; antes, as trocas e os "vi minha escala" que apontam para ela
--      passam para a linha que fica (nenhuma solicitação some);
--    - quem tem só a Tarde no dia (sobra de troca/cobertura) passa para a
--      Manhã ou a Noite conforme a posição dele na dupla;
--    - as linhas de Manhã e Noite recebem o horário novo no snapshot.
--
-- Se os turnos ativos não forem exatamente Manhã, Tarde e Noite, a
-- migration falha sem mudar nada.
-- ============================================================================

BEGIN;

SET CONSTRAINTS excl_escala_sem_sobreposicao DEFERRED;

DO $$
DECLARE
  v_manha uuid;
  v_tarde uuid;
  v_noite uuid;
  v_inicio constant date := '2026-11-14';
  r record;
  v_fica uuid;
BEGIN
  SELECT
    (array_agg(id ORDER BY ordem_exibicao NULLS LAST, nome))[1],
    (array_agg(id ORDER BY ordem_exibicao NULLS LAST, nome))[2],
    (array_agg(id ORDER BY ordem_exibicao NULLS LAST, nome))[3]
  INTO v_manha, v_tarde, v_noite
  FROM turnos
  WHERE ativo
  HAVING count(*) = 3;

  IF v_manha IS NULL
    OR NOT (SELECT nome ILIKE 'manh%' FROM turnos WHERE id = v_manha)
    OR NOT (SELECT nome ILIKE 'tarde%' FROM turnos WHERE id = v_tarde)
    OR NOT (SELECT nome ILIKE 'noite%' FROM turnos WHERE id = v_noite)
  THEN
    RAISE EXCEPTION 'Os turnos ativos não são exatamente Manhã, Tarde e Noite — nada foi alterado.';
  END IF;

  -- 1. Turnos
  UPDATE turnos SET hora_inicio = '08:00', hora_fim = '17:00' WHERE id = v_manha;
  UPDATE turnos SET hora_inicio = '17:00', hora_fim = '02:00' WHERE id = v_noite;
  UPDATE turnos SET ativo = false WHERE id = v_tarde;

  -- 2. Linhas de Tarde de 14/11 em diante
  FOR r IN
    SELECT t.id, t.colaborador_id, t.data,
      (SELECT e.id FROM escalas e
        WHERE e.colaborador_id = t.colaborador_id AND e.data = t.data AND e.turno_id = v_manha) AS manha_id,
      (SELECT e.id FROM escalas e
        WHERE e.colaborador_id = t.colaborador_id AND e.data = t.data AND e.turno_id = v_noite) AS noite_id
    FROM escalas t
    WHERE t.turno_id = v_tarde AND t.data >= v_inicio
  LOOP
    v_fica := coalesce(r.manha_id, r.noite_id);

    IF v_fica IS NOT NULL THEN
      UPDATE solicitacoes_troca SET escala_solicitante_id = v_fica WHERE escala_solicitante_id = r.id;
      UPDATE solicitacoes_troca SET escala_colega_id = v_fica WHERE escala_colega_id = r.id;
      INSERT INTO escala_visualizacoes (escala_id, colaborador_id, visualizado_em)
        SELECT v_fica, v.colaborador_id, v.visualizado_em
        FROM escala_visualizacoes v WHERE v.escala_id = r.id
        ON CONFLICT (escala_id, colaborador_id) DO NOTHING;
      DELETE FROM escalas WHERE id = r.id;
    ELSE
      -- Só a Tarde no dia: vai para o horário da posição na dupla (o
      -- gatilho preenche o snapshot com o horário novo).
      UPDATE escalas
      SET turno_id = CASE
        WHEN EXISTS (SELECT 1 FROM duplas_fim_de_semana d WHERE d.tarde_noite_id = r.colaborador_id)
          THEN v_noite
        ELSE v_manha
      END
      WHERE id = r.id;
    END IF;
  END LOOP;

  -- Horário novo nas linhas de Manhã e Noite de 14/11 em diante.
  UPDATE escalas e
  SET turno_nome_snapshot = t.nome,
      turno_hora_inicio_snapshot = t.hora_inicio,
      turno_hora_fim_snapshot = t.hora_fim
  FROM turnos t
  WHERE t.id = e.turno_id
    AND e.turno_id IN (v_manha, v_noite)
    AND e.data >= v_inicio;
END;
$$;

COMMIT;
