-- ============================================================================
-- Jornada 360 — Migration: notificações no celular (Web Push)
--
-- 1. push_inscricoes: aparelhos que ativaram as notificações (um por
--    navegador/app instalado). Só se mexe nela pelas funções
--    registrar_push() e remover_push(), sempre para o próprio usuário.
-- 2. push_fila: mensagens a enviar. Os gatilhos abaixo colocam mensagens na
--    fila e chamam a edge function enviar-push, que envia e marca como
--    enviadas. Um agendamento a cada 5 minutos reenvia o que ficou para trás.
-- 3. Gatilhos (só para quem tem aparelho inscrito):
--    - operador: escala confirmada, pedido de troca recebido, troca recusada
--      pelo colega, troca aprovada/recusada pelo admin, multa aplicada,
--      venda de infoproduto confirmada/recusada;
--    - admin: troca aguardando aprovação, venda de infoproduto para
--      conferir, apontamento de multa para analisar.
-- 4. Lembretes diários (10h de Brasília): operador que ainda não confirmou
--    ciência da escala do fim de semana que está chegando; admin com
--    presenças do último fim de semana sem confirmar.
--
-- Uma falha ao enfileirar nunca desfaz a ação principal (vira só um aviso
-- no log). Só cria tabelas, funções, gatilhos e agendamentos; nenhum dado
-- existente é alterado.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. Tabelas
-- ----------------------------------------------------------------------------

CREATE TABLE push_inscricoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id      uuid NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
  endpoint       text NOT NULL UNIQUE,
  p256dh         text NOT NULL,
  auth           text NOT NULL,
  dispositivo    text,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_push_inscricoes_perfil ON push_inscricoes (perfil_id);

COMMENT ON TABLE push_inscricoes IS
  'Aparelhos que ativaram as notificações (Web Push). Um endpoint por navegador/app instalado; o dono é sempre quem fez login por último nele.';

CREATE TABLE push_fila (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id    uuid NOT NULL REFERENCES perfis (id) ON DELETE CASCADE,
  titulo       text NOT NULL,
  corpo        text NOT NULL,
  aba          text,
  chave        text,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  enviado_em   timestamptz,
  tentativas   integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX uq_push_fila_chave ON push_fila (perfil_id, chave) WHERE chave IS NOT NULL;
CREATE INDEX ix_push_fila_pendentes ON push_fila (criado_em) WHERE enviado_em IS NULL;

COMMENT ON TABLE push_fila IS
  'Notificações a enviar. aba = tela do app aberta ao tocar. chave evita repetir o mesmo lembrete. Processada pela edge function enviar-push.';

-- Ninguém do app lê ou grava direto; só as funções abaixo e o servidor.
ALTER TABLE push_inscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_fila ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON push_inscricoes, push_fila FROM anon, authenticated;
GRANT ALL ON push_inscricoes, push_fila TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Inscrição do aparelho (chamadas pelo app)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION registrar_push(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  INSERT INTO push_inscricoes (perfil_id, endpoint, p256dh, auth, dispositivo)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_dispositivo)
  ON CONFLICT (endpoint) DO UPDATE
    SET perfil_id = auth.uid(),
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        dispositivo = EXCLUDED.dispositivo,
        atualizado_em = now();
END;
$$;

CREATE OR REPLACE FUNCTION remover_push(p_endpoint text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM push_inscricoes WHERE endpoint = p_endpoint AND perfil_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION registrar_push(text, text, text, text), remover_push(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_push(text, text, text, text), remover_push(text) TO authenticated;

COMMENT ON FUNCTION registrar_push(text, text, text, text) IS
  'Liga este aparelho às notificações do usuário logado (se o aparelho era de outra pessoa, passa a ser de quem está logado).';
COMMENT ON FUNCTION remover_push(text) IS
  'Desliga as notificações deste aparelho para o usuário logado.';

-- ----------------------------------------------------------------------------
-- 3. Fila e envio
-- ----------------------------------------------------------------------------

-- Chama a edge function que envia o que está na fila (assíncrono: o pedido
-- só sai depois que a transação confirma).
CREATE OR REPLACE FUNCTION disparar_envio_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://cmveztaigvnxzegwoicq.supabase.co/functions/v1/enviar-push',
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION enfileirar_push(
  p_perfis uuid[],
  p_titulo text,
  p_corpo text,
  p_aba text,
  p_chave text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inseridas integer;
BEGIN
  INSERT INTO push_fila (perfil_id, titulo, corpo, aba, chave)
  SELECT DISTINCT p.id, p_titulo, p_corpo, p_aba, p_chave
  FROM perfis p
  WHERE p.id = ANY (p_perfis)
    AND p.ativo
    AND EXISTS (SELECT 1 FROM push_inscricoes i WHERE i.perfil_id = p.id)
  ON CONFLICT (perfil_id, chave) WHERE chave IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS inseridas = ROW_COUNT;

  IF inseridas > 0 THEN
    PERFORM disparar_envio_push();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Notificação nunca pode impedir a ação que a gerou.
  RAISE WARNING 'enfileirar_push falhou: %', SQLERRM;
END;
$$;

-- Usada pela edge function: separa até p_limite mensagens para enviar,
-- sem que duas execuções ao mesmo tempo peguem a mesma.
CREATE OR REPLACE FUNCTION reservar_push(p_limite integer DEFAULT 100)
RETURNS SETOF push_fila
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE push_fila f
  SET enviado_em = now(), tentativas = f.tentativas + 1
  WHERE f.id IN (
    SELECT id FROM push_fila
    WHERE enviado_em IS NULL AND tentativas < 3
    ORDER BY criado_em
    LIMIT p_limite
    FOR UPDATE SKIP LOCKED
  )
  RETURNING f.*;
$$;

REVOKE ALL ON FUNCTION disparar_envio_push(), enfileirar_push(uuid[], text, text, text, text), reservar_push(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reservar_push(integer) TO service_role;

-- Ajudantes para os textos.
CREATE OR REPLACE FUNCTION perfil_do_colaborador(p_colaborador uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT perfil_id FROM colaboradores WHERE id = p_colaborador;
$$;

CREATE OR REPLACE FUNCTION nome_do_colaborador(p_colaborador uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(p.nome_completo, 'Um colega')
  FROM colaboradores c JOIN perfis p ON p.id = c.perfil_id
  WHERE c.id = p_colaborador;
$$;

CREATE OR REPLACE FUNCTION perfis_admin()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(id), '{}') FROM perfis WHERE papel = 'administrador' AND ativo;
$$;

REVOKE ALL ON FUNCTION perfil_do_colaborador(uuid), nome_do_colaborador(uuid), perfis_admin()
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Gatilhos
-- ----------------------------------------------------------------------------

-- Escala do fim de semana confirmada → quem está escalado nela.
CREATE OR REPLACE FUNCTION push_escala_confirmada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM enfileirar_push(
    ARRAY(
      SELECT DISTINCT c.perfil_id
      FROM escalas e JOIN colaboradores c ON c.id = e.colaborador_id
      WHERE e.periodo_id = NEW.id
    ),
    'Escala confirmada',
    format('Sua escala do fim de semana de %s a %s está publicada. Confira seus turnos.',
      to_char(NEW.data_inicio, 'DD/MM'), to_char(NEW.data_fim, 'DD/MM')),
    'minha-area',
    'escala:' || NEW.id || ':' || coalesce(NEW.confirmed_at::text, '')
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_push_escala_confirmada
  AFTER UPDATE OF status ON periodos_operacao
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado' AND OLD.status IS DISTINCT FROM 'confirmado')
  EXECUTE FUNCTION push_escala_confirmada();

-- Trocas de turno.
CREATE OR REPLACE FUNCTION push_troca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  solicitante text := nome_do_colaborador(NEW.solicitante_id);
  colega      text := nome_do_colaborador(NEW.colega_id);
  os_dois     uuid[] := ARRAY[perfil_do_colaborador(NEW.solicitante_id), perfil_do_colaborador(NEW.colega_id)];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pendente' THEN
      PERFORM enfileirar_push(
        ARRAY[perfil_do_colaborador(NEW.colega_id)],
        'Pedido de troca',
        CASE NEW.tipo
          WHEN 'cobertura' THEN solicitante || ' pediu que você cubra um dia de trabalho. Toque para responder.'
          WHEN 'assumir' THEN solicitante || ' quer trabalhar no seu lugar em um dia. Toque para responder.'
          ELSE solicitante || ' quer trocar um dia de trabalho com você. Toque para responder.'
        END,
        'trocas'
      );
    END IF;
    RETURN NULL;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;

  CASE NEW.status
    WHEN 'aceito_pelo_colega' THEN
      PERFORM enfileirar_push(
        perfis_admin(),
        'Troca aguardando aprovação',
        format('%s e %s combinaram uma troca. Falta a sua aprovação.', solicitante, colega),
        'trocas'
      );
    WHEN 'rejeitado_pelo_colega' THEN
      PERFORM enfileirar_push(
        ARRAY[perfil_do_colaborador(NEW.solicitante_id)],
        'Pedido de troca recusado',
        colega || ' recusou o seu pedido de troca.',
        'trocas'
      );
    WHEN 'aprovado' THEN
      PERFORM enfileirar_push(
        os_dois,
        'Troca aprovada',
        format('A troca entre %s e %s foi aprovada. Confira sua escala.', solicitante, colega),
        'minha-area'
      );
    WHEN 'rejeitado_pelo_admin' THEN
      PERFORM enfileirar_push(
        os_dois,
        'Troca não aprovada',
        format('O administrador não aprovou a troca entre %s e %s.', solicitante, colega),
        'trocas'
      );
    ELSE
      NULL;
  END CASE;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_push_troca
  AFTER INSERT OR UPDATE OF status ON solicitacoes_troca
  FOR EACH ROW EXECUTE FUNCTION push_troca();

-- Multas.
CREATE OR REPLACE FUNCTION push_multa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'aprovada'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'aprovada')
     AND NEW.colaborador_final_id IS NOT NULL THEN
    PERFORM enfileirar_push(
      ARRAY[perfil_do_colaborador(NEW.colaborador_final_id)],
      'Multa aplicada',
      'Uma multa foi aplicada a você. Toque para ver os detalhes.',
      'multas'
    );
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'pendente' THEN
    PERFORM enfileirar_push(
      perfis_admin(),
      'Apontamento de multa',
      'Há um novo apontamento de multa aguardando sua análise.',
      'multas'
    );
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_push_multa
  AFTER INSERT OR UPDATE OF status ON solicitacoes_multa
  FOR EACH ROW EXECUTE FUNCTION push_multa();

-- Vendas de infoprodutos: por comando (a conferência e a importação mexem em
-- várias de uma vez), para mandar uma notificação por pessoa e não por venda.
CREATE OR REPLACE FUNCTION push_venda_registrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qtd integer;
  uma record;
BEGIN
  SELECT count(*) INTO qtd FROM novas WHERE status = 'pendente' AND colaborador_id IS NOT NULL;
  IF qtd = 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO uma FROM novas WHERE status = 'pendente' AND colaborador_id IS NOT NULL LIMIT 1;
  PERFORM enfileirar_push(
    perfis_admin(),
    'Venda de infoproduto para conferir',
    CASE WHEN qtd = 1
      THEN format('%s registrou %s (US$ %s).', nome_do_colaborador(uma.colaborador_id), uma.produto,
                  replace(to_char(uma.valor, 'FM999999990.00'), '.', ','))
      ELSE qtd || ' vendas de infoprodutos aguardando conferência.'
    END,
    'comissionamento'
  );
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_push_venda_registrada
  AFTER INSERT ON vendas_infoprodutos
  REFERENCING NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION push_venda_registrada();

CREATE OR REPLACE FUNCTION push_venda_conferida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  g record;
BEGIN
  FOR g IN
    SELECT n.colaborador_id, n.status, count(*) AS qtd, min(n.produto) AS produto
    FROM novas n JOIN antigas a ON a.id = n.id
    WHERE a.status = 'pendente' AND n.status IN ('confirmada', 'recusada') AND n.colaborador_id IS NOT NULL
    GROUP BY n.colaborador_id, n.status
  LOOP
    PERFORM enfileirar_push(
      ARRAY[perfil_do_colaborador(g.colaborador_id)],
      CASE WHEN g.status = 'confirmada'
        THEN CASE WHEN g.qtd = 1 THEN 'Venda confirmada' ELSE g.qtd || ' vendas confirmadas' END
        ELSE CASE WHEN g.qtd = 1 THEN 'Venda recusada' ELSE g.qtd || ' vendas recusadas' END
      END,
      CASE WHEN g.status = 'confirmada'
        THEN CASE WHEN g.qtd = 1
          THEN 'Sua venda de ' || g.produto || ' entrou na comissão do mês.'
          ELSE 'Suas vendas de infoprodutos entraram na comissão do mês.' END
        ELSE CASE WHEN g.qtd = 1
          THEN 'Sua venda de ' || g.produto || ' não foi confirmada na conferência.'
          ELSE 'Algumas vendas suas não foram confirmadas na conferência.' END
      END,
      'infoprodutos'
    );
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_push_venda_conferida
  AFTER UPDATE ON vendas_infoprodutos
  REFERENCING OLD TABLE AS antigas NEW TABLE AS novas
  FOR EACH STATEMENT EXECUTE FUNCTION push_venda_conferida();

REVOKE ALL ON FUNCTION push_escala_confirmada(), push_troca(), push_multa(), push_venda_registrada(), push_venda_conferida()
  FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Lembretes diários e limpeza
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION lembretes_push()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  p record;
  pendentes integer;
BEGIN
  -- Operador: fim de semana confirmado começando em até 2 dias, sem o
  -- "estou ciente" (termo de aceite).
  FOR p IN
    SELECT id, data_inicio, data_fim FROM periodos_operacao
    WHERE status = 'confirmado' AND data_inicio BETWEEN hoje AND hoje + 2
  LOOP
    PERFORM enfileirar_push(
      ARRAY(
        SELECT DISTINCT c.perfil_id
        FROM escalas e JOIN colaboradores c ON c.id = e.colaborador_id
        WHERE e.periodo_id = p.id
          AND NOT EXISTS (
            SELECT 1 FROM termos_aceite t WHERE t.periodo_id = p.id AND t.colaborador_id = e.colaborador_id
          )
      ),
      'Confirme sua escala',
      format('O fim de semana de %s a %s está chegando. Abra o app e confirme que está ciente dos seus turnos.',
        to_char(p.data_inicio, 'DD/MM'), to_char(p.data_fim, 'DD/MM')),
      'minha-area',
      'termo:' || p.id || ':' || hoje
    );
  END LOOP;

  -- Admin: presenças sem confirmar do último fim de semana (até 7 dias depois).
  SELECT id, data_inicio, data_fim INTO p FROM periodos_operacao
  WHERE status IN ('confirmado', 'encerrado') AND data_fim < hoje AND data_fim >= hoje - 7
  ORDER BY data_inicio DESC LIMIT 1;
  IF FOUND THEN
    SELECT count(*) INTO pendentes FROM escalas WHERE periodo_id = p.id AND compareceu IS NULL;
    IF pendentes > 0 THEN
      PERFORM enfileirar_push(
        perfis_admin(),
        'Presenças a confirmar',
        format('%s presença(s) do fim de semana de %s a %s ainda sem confirmar.',
          pendentes, to_char(p.data_inicio, 'DD/MM'), to_char(p.data_fim, 'DD/MM')),
        'historico',
        'presenca:' || p.id || ':' || hoje
      );
    END IF;
  END IF;

  DELETE FROM push_fila WHERE criado_em < now() - interval '30 days';
END;
$$;

CREATE OR REPLACE FUNCTION reenviar_push_pendente()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM push_fila WHERE enviado_em IS NULL AND tentativas < 3) THEN
    PERFORM disparar_envio_push();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION lembretes_push(), reenviar_push_pendente() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('push-lembretes', '0 13 * * *', 'SELECT lembretes_push();');
SELECT cron.schedule('push-reenvio', '*/5 * * * *', 'SELECT reenviar_push_pendente();');

COMMIT;
