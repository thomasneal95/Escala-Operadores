-- ============================================================================
-- Escala Operadores — Migration: histórico de comissões (meses arquivados)
--
-- Igual ao botão "Arquivar mês → Histórico" da planilha: no fim do mês o
-- admin arquiva uma foto do fechamento. Arquivar de novo substitui a foto.
-- A foto não muda se a base ou os cadastros mudarem depois.
--
--   1. meses_arquivados: um registro por mês arquivado.
--   2. historico_comissoes: as linhas da foto (colaboradores e casos
--      especiais — externos e pagamentos fixos, que não têm colaborador).
--   3. arquivar_mes_comissoes(): grava a foto de uma vez (substitui).
-- ============================================================================

BEGIN;

CREATE TABLE meses_arquivados (
  mes             date PRIMARY KEY CHECK (extract(day FROM mes) = 1),
  origem          text NOT NULL DEFAULT 'site' CHECK (origem IN ('site', 'planilha')),
  total_ftds      integer,
  arquivado_em    timestamptz NOT NULL DEFAULT now(),
  arquivado_por   uuid REFERENCES perfis (id)
);

COMMENT ON TABLE meses_arquivados IS
  'Meses de comissão arquivados (foto do fechamento). origem: site (botão Arquivar) ou planilha (importado da aba Historico do Excel).';

CREATE TABLE historico_comissoes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes               date NOT NULL REFERENCES meses_arquivados (mes) ON DELETE CASCADE,
  tipo              text NOT NULL DEFAULT 'colaborador',
  colaborador_id    uuid REFERENCES colaboradores (id) ON DELETE SET NULL,
  nome              text NOT NULL,
  equipe            text,
  data_inicio       date,
  auxilio           numeric(10,2) NOT NULL DEFAULT 0,
  comissao_propria  numeric(10,2) NOT NULL DEFAULT 0,
  comissao_equipe   numeric(10,2) NOT NULL DEFAULT 0,
  comissao_fds      numeric(10,2) NOT NULL DEFAULT 0,
  adiantamento      numeric(10,2) NOT NULL DEFAULT 0,
  salario_total     numeric(10,2) NOT NULL DEFAULT 0,
  ftds              integer,
  total_a_pagar     numeric(10,2)
);

CREATE INDEX ix_historico_comissoes_mes ON historico_comissoes (mes);
CREATE INDEX ix_historico_comissoes_colaborador ON historico_comissoes (colaborador_id);

COMMENT ON TABLE historico_comissoes IS
  'Linhas da foto de cada mês arquivado. ftds e total_a_pagar ficam vazios nos meses importados da planilha (a aba Historico não tinha essas colunas).';

ALTER TABLE meses_arquivados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia meses arquivados"
ON meses_arquivados FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON meses_arquivados TO authenticated;
GRANT ALL ON meses_arquivados TO service_role;

ALTER TABLE historico_comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia historico de comissoes"
ON historico_comissoes FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON historico_comissoes TO authenticated;
GRANT ALL ON historico_comissoes TO service_role;

-- Grava (ou substitui) a foto de um mês numa única transação.
CREATE OR REPLACE FUNCTION arquivar_mes_comissoes(
  p_mes date,
  p_linhas jsonb,
  p_origem text DEFAULT 'site',
  p_total_ftds integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  gravadas integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem arquivar meses.';
  END IF;

  DELETE FROM meses_arquivados WHERE mes = p_mes;

  INSERT INTO meses_arquivados (mes, origem, total_ftds, arquivado_por)
  VALUES (p_mes, p_origem, p_total_ftds, auth.uid());

  INSERT INTO historico_comissoes (
    mes, tipo, colaborador_id, nome, equipe, data_inicio, auxilio, comissao_propria,
    comissao_equipe, comissao_fds, adiantamento, salario_total, ftds, total_a_pagar
  )
  SELECT
    p_mes,
    coalesce(l->>'tipo', 'colaborador'),
    (SELECT c.id FROM colaboradores c WHERE c.id::text = l->>'colaborador_id'),
    l->>'nome',
    nullif(l->>'equipe', ''),
    (l->>'data_inicio')::date,
    coalesce((l->>'auxilio')::numeric, 0),
    coalesce((l->>'comissao_propria')::numeric, 0),
    coalesce((l->>'comissao_equipe')::numeric, 0),
    coalesce((l->>'comissao_fds')::numeric, 0),
    coalesce((l->>'adiantamento')::numeric, 0),
    coalesce((l->>'salario_total')::numeric, 0),
    (l->>'ftds')::integer,
    (l->>'total_a_pagar')::numeric
  FROM jsonb_array_elements(p_linhas) AS l
  WHERE coalesce(l->>'nome', '') <> '';
  GET DIAGNOSTICS gravadas = ROW_COUNT;

  RETURN gravadas;
END;
$$;

COMMENT ON FUNCTION arquivar_mes_comissoes(date, jsonb, text, integer) IS
  'Arquiva (ou substitui) a foto do fechamento de um mês. Devolve quantas linhas foram gravadas.';

GRANT EXECUTE ON FUNCTION arquivar_mes_comissoes(date, jsonb, text, integer) TO authenticated;

COMMIT;
