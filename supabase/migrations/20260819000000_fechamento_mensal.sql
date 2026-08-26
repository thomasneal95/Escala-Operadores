-- ============================================================================
-- Escala Operadores — Migration: fechamento mensal de comissionamento
--
-- Adiciona o que falta para reproduzir a lógica da planilha de comissões:
--   1. Auxílio mensal (valor cheio) por colaborador.
--   2. Histórico de qual equipe cada colaborador pertencia em cada período
--      de tempo (necessário porque trocas de equipe no meio do mês fazem
--      cada venda contar para a equipe vigente naquele dia específico).
--   3. Adiantamentos mensais (digitados manualmente pelo admin).
--   4. Fechamentos mensais salvos (histórico consultável depois).
-- ============================================================================

BEGIN;

-- 1. Auxílio mensal cheio por colaborador (padrão US$400, ajustável).
ALTER TABLE colaboradores
  ADD COLUMN auxilio_mensal numeric(10,2) NOT NULL DEFAULT 400;

COMMENT ON COLUMN colaboradores.auxilio_mensal IS
  'Valor cheio do auxílio mensal. É rateado proporcionalmente se a admissão for no meio do mês.';

-- 2. Histórico de vigência de equipe.
CREATE TABLE historico_equipe (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  equipe_id      uuid REFERENCES equipes(id) ON DELETE SET NULL,
  valido_de      date NOT NULL,
  valido_ate     date, -- NULL = ainda vigente
  CHECK (valido_ate IS NULL OR valido_ate >= valido_de)
);

CREATE INDEX idx_historico_equipe_colaborador ON historico_equipe(colaborador_id);

COMMENT ON TABLE historico_equipe IS
  'Registra qual equipe cada colaborador pertencia em cada intervalo de datas, para apurar corretamente o comissionamento quando há troca de equipe no meio do mês.';

-- Semente: cria o registro inicial de vigência para todo mundo que já tem
-- equipe, usando a data de admissão (ou uma data bem antiga, se não tiver)
-- como início.
INSERT INTO historico_equipe (colaborador_id, equipe_id, valido_de, valido_ate)
SELECT id, equipe_id, COALESCE(data_admissao, '2020-01-01'), NULL
FROM colaboradores
WHERE equipe_id IS NOT NULL;

ALTER TABLE historico_equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia historico de equipe"
ON historico_equipe FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE ON historico_equipe TO authenticated;
GRANT ALL ON historico_equipe TO service_role;

-- 3. Adiantamentos mensais (um valor por colaborador, por mês).
CREATE TABLE adiantamentos_mensais (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  mes            date NOT NULL, -- sempre o dia 1 do mês de referência
  valor          numeric(10,2) NOT NULL DEFAULT 0,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, mes)
);

ALTER TABLE adiantamentos_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia adiantamentos"
ON adiantamentos_mensais FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE ON adiantamentos_mensais TO authenticated;
GRANT ALL ON adiantamentos_mensais TO service_role;

-- 4. Fechamentos mensais salvos (uma "foto" do resultado de cada mês).
CREATE TABLE fechamentos_mensais (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes                   date NOT NULL,
  colaborador_id        uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  nome_snapshot         text NOT NULL,
  equipe_nome_snapshot  text,
  auxilio               numeric(10,2) NOT NULL DEFAULT 0,
  comissao_dia_semana   numeric(10,2) NOT NULL DEFAULT 0,
  comissao_fim_semana   numeric(10,2) NOT NULL DEFAULT 0,
  adiantamento          numeric(10,2) NOT NULL DEFAULT 0,
  salario_total         numeric(10,2) NOT NULL DEFAULT 0,
  calculado_em          timestamptz NOT NULL DEFAULT now(),
  calculado_por         uuid REFERENCES perfis(id),
  UNIQUE (mes, colaborador_id)
);

ALTER TABLE fechamentos_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia fechamentos"
ON fechamentos_mensais FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON fechamentos_mensais TO authenticated;
GRANT ALL ON fechamentos_mensais TO service_role;

COMMIT;