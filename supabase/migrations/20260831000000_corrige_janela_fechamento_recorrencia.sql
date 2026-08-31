-- ============================================================================
-- Escala Operadores — Migration: corrige janela perdida no fechamento
-- automático do período de disponibilidade
--
-- BUG: o cron "recorrencia-disponibilidade" roda de hora em hora, sempre no
-- minuto 0. A condição original de fechamento (dow_hoje = dia_fechamento AND
-- hora_hoje >= hora_fechamento) nunca fica verdadeira quando hora_fechamento
-- cai entre a última checagem do dia (23:00) e a virada (00:00) — porque,
-- às 00:00, o dia da semana já mudou e a igualdade "dow_hoje = dia_fechamento"
-- deixa de bater. Com hora_fechamento = 23:50 (configurado em 2026-08-21),
-- isso fazia o fechamento nunca acontecer sozinho.
--
-- CORREÇÃO: além da checagem normal (mesmo dia, já passou da hora), também
-- fecha/abre no dia seguinte ao configurado, como rede de segurança — pior
-- caso, a transição acontece com até ~1h de atraso na madrugada seguinte,
-- em vez de nunca acontecer. Aplicado nos dois lados (abertura e
-- fechamento) por simetria, já que o mesmo bug afetaria a abertura se algum
-- dia hora_abertura for configurado perto da virada do dia.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION executar_recorrencia_disponibilidade()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cfg RECORD;
  agora_local timestamp;
  dow_hoje integer;
  hora_hoje time;
  offset_dias integer;
  proxima_data_inicio date;
  proxima_data_fim date;
  admin_id uuid;
BEGIN
  SELECT * INTO cfg FROM configuracao_recorrencia WHERE id = true;

  IF cfg IS NULL OR NOT cfg.ativo THEN
    RETURN;
  END IF;

  agora_local := now() AT TIME ZONE 'America/Sao_Paulo';
  dow_hoje := EXTRACT(DOW FROM agora_local)::integer;
  hora_hoje := agora_local::time;

  -- ABERTURA: hoje é o dia configurado e já passou da hora configurada,
  -- OU já é o dia seguinte (rede de segurança, ver nota acima) — e não
  -- existe nenhum período 'aberto' no momento.
  IF (
      (dow_hoje = cfg.dia_abertura AND hora_hoje >= cfg.hora_abertura)
      OR dow_hoje = (cfg.dia_abertura + 1) % 7
     )
  THEN
    IF NOT EXISTS (SELECT 1 FROM periodos_operacao WHERE status = 'aberto') THEN
      SELECT id INTO admin_id FROM perfis WHERE papel = 'administrador' LIMIT 1;

      IF admin_id IS NOT NULL THEN
        offset_dias := (6 - EXTRACT(DOW FROM agora_local)::integer + 7) % 7;
        proxima_data_inicio := agora_local::date + offset_dias;
        proxima_data_fim := proxima_data_inicio + 1;

        INSERT INTO periodos_operacao (data_inicio, data_fim, status, created_by)
        VALUES (proxima_data_inicio, proxima_data_fim, 'aberto', admin_id)
        ON CONFLICT (data_inicio, data_fim) DO NOTHING;
      END IF;
    END IF;
  END IF;

  -- FECHAMENTO: hoje é o dia configurado e já passou da hora configurada,
  -- OU já é o dia seguinte (rede de segurança, ver nota acima) — encerra
  -- qualquer período que ainda esteja 'aberto'.
  IF (
      (dow_hoje = cfg.dia_fechamento AND hora_hoje >= cfg.hora_fechamento)
      OR dow_hoje = (cfg.dia_fechamento + 1) % 7
     )
  THEN
    UPDATE periodos_operacao
    SET status = 'em_organizacao'
    WHERE status = 'aberto';
  END IF;
END;
$$;

COMMENT ON FUNCTION executar_recorrencia_disponibilidade() IS
  'Executa a abertura/fechamento automático do período de disponibilidade conforme configuracao_recorrencia. Chamada periodicamente via pg_cron. Idempotente. Inclui rede de segurança para o dia seguinte ao configurado, evitando perder a janela quando a hora configurada cai perto da virada do dia (bug corrigido em 2026-08-31).';

COMMIT;
