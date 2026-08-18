-- ============================================================================
-- Escala Operadores — Migration: solicitações de troca de turno
--
-- Fluxo: colaborador A solicita trocar um turno seu com um colega B da
-- mesma equipe → B escolhe qual dos turnos dele oferece em troca e aceita
-- → admin aprova, e só então a troca é executada de verdade na escala
-- (troca o colaborador_id das duas linhas de escalas).
-- ============================================================================

BEGIN;

-- Função auxiliar: id do colaborador correspondente ao usuário logado.
CREATE OR REPLACE FUNCTION meu_colaborador_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM colaboradores WHERE perfil_id = auth.uid();
$$;

COMMENT ON FUNCTION meu_colaborador_id() IS
  'Retorna o id do colaborador correspondente ao usuário autenticado, ou NULL. SECURITY DEFINER para evitar recursão de RLS.';

CREATE TABLE solicitacoes_troca (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_id             uuid NOT NULL REFERENCES periodos_operacao(id) ON DELETE CASCADE,
  solicitante_id         uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  escala_solicitante_id  uuid NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
  colega_id              uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  escala_colega_id       uuid REFERENCES escalas(id) ON DELETE CASCADE,
  status                 text NOT NULL DEFAULT 'pendente'
                           CHECK (status IN (
                             'pendente',
                             'aceito_pelo_colega',
                             'aprovado',
                             'rejeitado_pelo_colega',
                             'rejeitado_pelo_admin',
                             'cancelado'
                           )),
  criado_em              timestamptz NOT NULL DEFAULT now(),
  respondido_colega_em   timestamptz,
  respondido_admin_em    timestamptz,
  admin_id               uuid REFERENCES perfis(id) ON DELETE SET NULL,
  CONSTRAINT solicitante_diferente_colega CHECK (solicitante_id <> colega_id)
);

COMMENT ON TABLE solicitacoes_troca IS
  'Solicitações de troca de turno entre colaboradores da mesma equipe, com aceite do colega e aprovação final do admin.';

CREATE INDEX idx_solicitacoes_troca_solicitante ON solicitacoes_troca(solicitante_id);
CREATE INDEX idx_solicitacoes_troca_colega ON solicitacoes_troca(colega_id);
CREATE INDEX idx_solicitacoes_troca_periodo ON solicitacoes_troca(periodo_id);

ALTER TABLE solicitacoes_troca ENABLE ROW LEVEL SECURITY;

-- SELECT: o próprio solicitante, o colega envolvido, ou o admin.
CREATE POLICY "Ver solicitacoes proprias ou admin"
ON solicitacoes_troca FOR SELECT
USING (
  solicitante_id = meu_colaborador_id()
  OR colega_id = meu_colaborador_id()
  OR is_admin()
);

-- INSERT: só o próprio colaborador pode criar uma solicitação em seu nome.
CREATE POLICY "Colaborador cria solicitacao"
ON solicitacoes_troca FOR INSERT
WITH CHECK (solicitante_id = meu_colaborador_id());

-- UPDATE: colega aceita/rejeita enquanto pendente.
CREATE POLICY "Colega responde solicitacao"
ON solicitacoes_troca FOR UPDATE
USING (colega_id = meu_colaborador_id() AND status = 'pendente');

-- UPDATE: solicitante pode cancelar enquanto pendente.
CREATE POLICY "Solicitante cancela solicitacao"
ON solicitacoes_troca FOR UPDATE
USING (solicitante_id = meu_colaborador_id() AND status = 'pendente');

-- UPDATE: admin aprova ou rejeita.
CREATE POLICY "Admin decide solicitacao"
ON solicitacoes_troca FOR UPDATE
USING (is_admin());

GRANT SELECT, INSERT, UPDATE ON solicitacoes_troca TO authenticated;
GRANT SELECT, INSERT, UPDATE ON solicitacoes_troca TO service_role;

COMMIT;