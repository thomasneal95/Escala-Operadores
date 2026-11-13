-- ============================================================================
-- Jornada 360 — Migration: relatórios de qualidade do atendimento
--
-- Aba "Qualidade" do admin: o relatório (modelo em Excel, um por operador e
-- avaliação) é enviado pelo site, separado em tópicos (pontos positivos e
-- pontos de melhoria, cada um com uma categoria) e guardado junto com o
-- arquivo original. Só administradores leem e alteram.
--
-- Só cria tabelas e o bucket novos; nenhum dado existente é alterado.
-- ============================================================================

BEGIN;

CREATE TABLE relatorios_qualidade (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid REFERENCES colaboradores (id) ON DELETE SET NULL,
  -- Nome como veio no arquivo (fica mesmo se o cadastro sair).
  operador_nome   text NOT NULL,
  data_avaliacao  date NOT NULL,
  periodo         text,
  avaliador       text,
  nota            numeric(4, 2) CHECK (nota BETWEEN 0 AND 10),
  resumo          text,
  arquivo_path    text,
  arquivo_nome    text,
  enviado_por     uuid REFERENCES perfis (id) ON DELETE SET NULL,
  enviado_em      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_relatorios_qualidade_colaborador ON relatorios_qualidade (colaborador_id, data_avaliacao);
CREATE INDEX ix_relatorios_qualidade_data ON relatorios_qualidade (data_avaliacao);

CREATE TABLE relatorio_qualidade_topicos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relatorio_id  uuid NOT NULL REFERENCES relatorios_qualidade (id) ON DELETE CASCADE,
  ordem         integer NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('positivo', 'melhoria')),
  categoria     text NOT NULL,
  descricao     text NOT NULL,
  gravidade     text CHECK (gravidade IN ('baixa', 'media', 'alta')),
  exemplo       text
);

CREATE INDEX ix_topicos_qualidade_relatorio ON relatorio_qualidade_topicos (relatorio_id, ordem);

ALTER TABLE relatorios_qualidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE relatorio_qualidade_topicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia relatorios de qualidade"
ON relatorios_qualidade FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin gerencia topicos de qualidade"
ON relatorio_qualidade_topicos FOR ALL USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON relatorios_qualidade TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON relatorio_qualidade_topicos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON relatorios_qualidade TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON relatorio_qualidade_topicos TO service_role;

-- Arquivos originais: bucket privado, só admin.
INSERT INTO storage.buckets (id, name, public)
VALUES ('relatorios-qualidade', 'relatorios-qualidade', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin envia relatorio de qualidade"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'relatorios-qualidade' AND is_admin());

CREATE POLICY "Admin ve relatorio de qualidade"
ON storage.objects FOR SELECT
USING (bucket_id = 'relatorios-qualidade' AND is_admin());

CREATE POLICY "Admin remove relatorio de qualidade"
ON storage.objects FOR DELETE
USING (bucket_id = 'relatorios-qualidade' AND is_admin());

COMMIT;
