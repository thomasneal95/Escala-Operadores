-- ============================================================================
-- Escala Operadores — Migration: suporte a indicadores de notificação
--
-- mural_multas() precisa expor quando cada multa foi decidida
-- (decidido_em) e se o colaborador logado é quem foi multado
-- (sou_eu_multado), para o operador conseguir saber "tem multa nova
-- decidida no meu nome que eu ainda não vi" sem que a função vaze
-- reportante_id pra ninguém (mesma proteção de antes).
--
-- Muda o conjunto de colunas retornadas, então precisa DROP + CREATE (em
-- vez de CREATE OR REPLACE, que o Postgres não aceita quando as colunas
-- de saída mudam) — e refazer o GRANT, que some junto com o DROP.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS mural_multas();

CREATE FUNCTION mural_multas()
RETURNS TABLE (
  id                   uuid,
  criado_em            timestamptz,
  turno_nome           text,
  colaborador_nome     text,
  status               text,
  justificativa_admin  text,
  eu_reportei          boolean,
  decidido_em          timestamptz,
  sou_eu_multado       boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    m.id,
    m.criado_em,
    t.nome,
    CASE
      WHEN m.status = 'pendente' THEN NULL
      ELSE COALESCE(pf.nome_completo, pa.nome_completo)
    END,
    m.status,
    m.justificativa_admin,
    (m.reportante_id = meu_colaborador_id()),
    m.decidido_em,
    (m.colaborador_final_id = meu_colaborador_id())
  FROM solicitacoes_multa m
  JOIN turnos t ON t.id = m.turno_id
  LEFT JOIN colaboradores cf ON cf.id = m.colaborador_final_id
  LEFT JOIN perfis pf ON pf.id = cf.perfil_id
  LEFT JOIN colaboradores ca ON ca.id = m.colaborador_apontado_id
  LEFT JOIN perfis pa ON pa.id = ca.perfil_id
  ORDER BY m.criado_em DESC;
$$;

COMMENT ON FUNCTION mural_multas() IS
  'Visão pública (para qualquer autenticado) do mural de multas: nunca expõe reportante_id/anonimo, e só revela o nome da pessoa multada depois de decidido. eu_reportei/sou_eu_multado deixam a própria pessoa se reconhecer sem quebrar o anonimato pros outros. decidido_em serve pra notificação de "multa decidida no meu nome".';

GRANT EXECUTE ON FUNCTION mural_multas() TO authenticated;

COMMIT;
