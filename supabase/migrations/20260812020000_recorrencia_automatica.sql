-- ============================================================================
-- Escala Operadores — Migration: recorrência automática de disponibilidade
--
-- Permite que o administrador configure uma regra recorrente fixa de
-- abertura/fechamento do período de disponibilidade (ex.: abre toda
-- segunda-feira, fecha toda quinta-feira), executada automaticamente pelo
-- Postgres via pg_cron — sem depender de nenhum clique manual ou servidor
-- externo.
--
-- Convenção de dia da semana: segue EXTRACT(DOW), onde 0 = domingo,
-- 1 = segunda, ..., 6 = sábado (igual ao padrão do PostgreSQL).
-- Fuso horário fixo em 'America/Sao_Paulo' (ajustar aqui se a operação
-- mudar de fuso).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ----------------------------------------------------------------------------
-- 1. TABELA DE CONFIGURAÇÃO (singleton — sempre 1 linha)
-- ----------------------------------------------------------------------------

CREATE TABLE configuracao_recorrencia (
  id               boolean PRIMARY KEY DEFAULT true,
  dia_abertura     integer NOT NULL CHECK (dia_abertura BETWEEN 0 AND 6),
  hora_abertura    time NOT NULL,
  dia_fechamento   integer NOT NULL CHECK (dia_fechamento BETWEEN 0 AND 6),
  hora_fechamento  time NOT NULL,
  ativo            boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unica_linha CHECK (id = true)
);

COMMENT ON TABLE configuracao_recorrencia IS
  'Configuração única (singleton, forçado por id boolean) da regra recorrente de abertura/fechamento automático do período de disponibilidade.';
COMMENT ON COLUMN configuracao_recorrencia.dia_abertura IS
  'Dia da semana em que o período abre automaticamente, no padrão EXTRACT(DOW): 0=domingo .. 6=sábado.';
COMMENT ON COLUMN configuracao_recorrencia.dia_fechamento IS
  'Dia da semana em que o recebimento de disponibilidade encerra automaticamente (mesmo padrão de dia_abertura).';

CREATE TRIGGER trg_updated_at_configuracao_recorrencia
  BEFORE UPDATE ON configuracao_recorrencia
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Semente inicial: abre segunda 08:00, fecha quinta 18:00 (ajustável pelo admin).
INSERT INTO configuracao_recorrencia (dia_abertura, hora_abertura, dia_fechamento, hora_fechamento, ativo)
VALUES (1, '08:00', 4, '18:00', true);

-- ----------------------------------------------------------------------------
-- 2. RLS: apenas administrador lê/edita a configuração
-- ----------------------------------------------------------------------------

ALTER TABLE configuracao_recorrencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin ve configuracao"
ON configuracao_recorrencia FOR SELECT
USING (is_admin());

CREATE POLICY "Admin edita configuracao"
ON configuracao_recorrencia FOR UPDATE
USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON configuracao_recorrencia TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON configuracao_recorrencia TO service_role;

-- ----------------------------------------------------------------------------
-- 3. FUNÇÃO: executa a transição automática, se for a hora
-- ----------------------------------------------------------------------------
-- Idempotente: pode ser chamada várias vezes por hora sem criar duplicatas
-- ou repetir transições, porque cada ação só ocorre se o estado atual do
-- banco ainda permitir (ex.: só abre se não houver período 'aberto').

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

  -- ABERTURA: hoje é o dia configurado, já passou da hora configurada,
  -- e não existe nenhum período 'aberto' no momento.
  IF dow_hoje = cfg.dia_abertura AND hora_hoje >= cfg.hora_abertura THEN
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

  -- FECHAMENTO: hoje é o dia configurado, já passou da hora configurada,
  -- e existe um período 'aberto' para encerrar.
  IF dow_hoje = cfg.dia_fechamento AND hora_hoje >= cfg.hora_fechamento THEN
    UPDATE periodos_operacao
    SET status = 'em_organizacao'
    WHERE status = 'aberto';
  END IF;
END;
$$;

COMMENT ON FUNCTION executar_recorrencia_disponibilidade() IS
  'Executa a abertura/fechamento automático do período de disponibilidade conforme configuracao_recorrencia. Chamada periodicamente via pg_cron. Idempotente.';

-- ----------------------------------------------------------------------------
-- 4. AGENDAMENTO: roda a cada hora, no minuto 0
-- ----------------------------------------------------------------------------

SELECT cron.schedule(
  'recorrencia-disponibilidade',
  '0 * * * *',
  'SELECT executar_recorrencia_disponibilidade();'
);

COMMIT;