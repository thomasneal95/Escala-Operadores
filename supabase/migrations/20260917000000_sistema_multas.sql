-- ============================================================================
-- Escala Operadores — Migration: sistema de multas por organização/limpeza
--
-- Qualquer colaborador pode apontar uma ocorrência (com foto de comprovação),
-- indicando o turno e, se souber, quem deveria ser multado. O admin decide
-- (aprova/recusa, sempre com justificativa) e pode apontar/corrigir quem
-- efetivamente leva a multa.
--
-- ANONIMATO: quando o colaborador marca "enviar anonimamente", a identidade
-- de quem reportou (reportante_id) continua sendo gravada no banco — o
-- admin sempre consegue ver quem foi, mas os demais colaboradores nunca
-- veem essa coluna. Para isso a tabela base so e legivel pelo admin via
-- RLS; os colaboradores só leem o "mural" através da função
-- mural_multas() (SECURITY DEFINER), que expõe apenas colunas seguras e
-- nunca reportante_id. Mesmo padrão de função auxiliar já usado em
-- is_admin()/minha_equipe_id()/meu_colaborador_id().
--
-- O nome da pessoa multada só aparece no mural depois que o admin decide
-- (pendente = "Em análise"), para não expor ninguém publicamente antes de
-- uma decisão.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. CONFIGURAÇÃO (regras exibidas para os colaboradores) — singleton, mesmo
--    padrão de configuracao_recorrencia.
-- ----------------------------------------------------------------------------

CREATE TABLE configuracao_multas (
  id          boolean PRIMARY KEY DEFAULT true,
  regras      text NOT NULL DEFAULT 'As regras de aplicação de multas ainda não foram definidas pelo administrador.',
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unica_linha_config_multas CHECK (id = true)
);

COMMENT ON TABLE configuracao_multas IS
  'Configuração única (singleton) com o texto de regras de aplicação de multas, editável pelo admin.';

CREATE TRIGGER trg_updated_at_configuracao_multas
  BEFORE UPDATE ON configuracao_multas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO configuracao_multas (regras) VALUES (
  'Em breve o administrador vai detalhar aqui as regras de aplicação de multas por organização e limpeza do escritório.'
);

ALTER TABLE configuracao_multas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer autenticado ve as regras"
ON configuracao_multas FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admin edita as regras"
ON configuracao_multas FOR UPDATE
USING (is_admin());

GRANT SELECT, UPDATE ON configuracao_multas TO authenticated;
GRANT SELECT, UPDATE ON configuracao_multas TO service_role;

-- ----------------------------------------------------------------------------
-- 2. SOLICITAÇÕES DE MULTA
-- ----------------------------------------------------------------------------

CREATE TABLE solicitacoes_multa (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em                timestamptz NOT NULL DEFAULT now(),

  reportante_id            uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  anonimo                  boolean NOT NULL DEFAULT false,

  turno_id                 uuid NOT NULL REFERENCES turnos(id),

  colaborador_apontado_id  uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  nao_sabe_informar        boolean NOT NULL DEFAULT false,

  imagens                  text[] NOT NULL DEFAULT '{}',

  status                   text NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente', 'aprovada', 'recusada')),
  colaborador_final_id     uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  justificativa_admin      text,
  decidido_por             uuid REFERENCES perfis(id),
  decidido_em              timestamptz,

  CONSTRAINT chk_apontado_xor_nao_sabe
    CHECK ((colaborador_apontado_id IS NULL) = nao_sabe_informar),
  CONSTRAINT chk_tem_imagem
    CHECK (array_length(imagens, 1) >= 1),
  CONSTRAINT chk_decisao_tem_justificativa_e_responsavel
    CHECK (
      status = 'pendente'
      OR (justificativa_admin IS NOT NULL AND length(trim(justificativa_admin)) > 0)
    ),
  CONSTRAINT chk_aprovada_tem_responsavel_final
    CHECK (status <> 'aprovada' OR colaborador_final_id IS NOT NULL)
);

COMMENT ON TABLE solicitacoes_multa IS
  'Apontamentos de multa por organização/limpeza, com foto de comprovação. reportante_id é sempre gravado (mesmo quando "anonimo"); só a leitura pelos colaboradores via mural_multas() esconde essa coluna.';
COMMENT ON COLUMN solicitacoes_multa.anonimo IS
  'Quando true, o mural (visão dos colaboradores) não mostra quem reportou. O admin sempre vê (lendo a tabela diretamente).';
COMMENT ON COLUMN solicitacoes_multa.nao_sabe_informar IS
  'True quando quem reportou não soube dizer quem deveria ser multado (ex.: bagunça pode ser de outro turno). Nesse caso colaborador_apontado_id fica NULL até o admin decidir.';
COMMENT ON COLUMN solicitacoes_multa.colaborador_final_id IS
  'Quem efetivamente leva a multa, definido/confirmado pelo admin — pode diferir de colaborador_apontado_id (ex.: multa redirecionada, ou apontado como "não sei informar").';

CREATE INDEX ix_solicitacoes_multa_status ON solicitacoes_multa (status);
CREATE INDEX ix_solicitacoes_multa_reportante ON solicitacoes_multa (reportante_id);

ALTER TABLE solicitacoes_multa ENABLE ROW LEVEL SECURITY;

-- Só o admin lê a tabela base diretamente (protege reportante_id de verdade,
-- não só por convenção de frontend — ver mural_multas() para os colaboradores).
CREATE POLICY "Admin ve todas as solicitacoes de multa"
ON solicitacoes_multa FOR SELECT
USING (is_admin());

CREATE POLICY "Colaborador cria solicitacao de multa em seu nome"
ON solicitacoes_multa FOR INSERT
WITH CHECK (reportante_id = meu_colaborador_id());

CREATE POLICY "Admin decide solicitacoes de multa"
ON solicitacoes_multa FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove solicitacoes de multa"
ON solicitacoes_multa FOR DELETE
USING (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON solicitacoes_multa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON solicitacoes_multa TO service_role;

-- ----------------------------------------------------------------------------
-- 3. MURAL (leitura segura para todos os colaboradores autenticados)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION mural_multas()
RETURNS TABLE (
  id                   uuid,
  criado_em            timestamptz,
  turno_nome           text,
  colaborador_nome     text,
  status               text,
  justificativa_admin  text,
  eu_reportei          boolean
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
    (m.reportante_id = meu_colaborador_id())
  FROM solicitacoes_multa m
  JOIN turnos t ON t.id = m.turno_id
  LEFT JOIN colaboradores cf ON cf.id = m.colaborador_final_id
  LEFT JOIN perfis pf ON pf.id = cf.perfil_id
  LEFT JOIN colaboradores ca ON ca.id = m.colaborador_apontado_id
  LEFT JOIN perfis pa ON pa.id = ca.perfil_id
  ORDER BY m.criado_em DESC;
$$;

COMMENT ON FUNCTION mural_multas() IS
  'Visão pública (para qualquer autenticado) do mural de multas: nunca expõe reportante_id/anonimo, e só revela o nome da pessoa multada depois de decidido (pendente = NULL/"Em análise"). eu_reportei deixa a própria pessoa reconhecer o próprio apontamento sem quebrar o anonimato pros outros.';

GRANT EXECUTE ON FUNCTION mural_multas() TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. STORAGE: bucket privado para as fotos de comprovação
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-multa', 'comprovantes-multa', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Autenticado envia comprovante de multa"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'comprovantes-multa' AND auth.role() = 'authenticated');

CREATE POLICY "Admin ve comprovantes de multa"
ON storage.objects FOR SELECT
USING (bucket_id = 'comprovantes-multa' AND is_admin());

CREATE POLICY "Admin remove comprovantes de multa"
ON storage.objects FOR DELETE
USING (bucket_id = 'comprovantes-multa' AND is_admin());

COMMIT;
