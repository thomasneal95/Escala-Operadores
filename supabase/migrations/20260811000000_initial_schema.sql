-- ============================================================================
-- Escala Operadores — Migration inicial (V1)
--
-- Implementa a modelagem aprovada em docs/MODELO-BANCO-V1.md, incluindo a
-- validacao tecnica de docs/MODELO-BANCO-V1.md secao 6.1 (conflito de
-- horarios). Referencia funcional: docs/ESPECIFICACAO-V1.md.
--
-- NAO inclui:
--   - Row Level Security (etapa separada — ver docs/MODELO-BANCO-V1.md secao 14)
--   - dados de exemplo/seed
--   - qualquer usuario ou colaborador real
--
-- NAO executar manualmente em producao sem revisar supabase/README.md e
-- docs/TESTES-BANCO-V1.md primeiro.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. EXTENSOES
-- ----------------------------------------------------------------------------

-- gen_random_uuid() para todas as chaves primarias (docs/MODELO-BANCO-V1.md secao 0).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Necessaria para a exclusion constraint de conflito de horario
-- (docs/MODELO-BANCO-V1.md secao 6.1): permite combinar igualdade de uuid
-- com sobreposicao de tsrange num unico indice GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- 2. TIPOS ENUMERADOS
-- ----------------------------------------------------------------------------

CREATE TYPE papel_usuario AS ENUM (
  'administrador',
  'colaborador'
);

CREATE TYPE status_periodo AS ENUM (
  'aberto',
  'em_organizacao',
  'confirmado',
  'encerrado'
);

-- ----------------------------------------------------------------------------
-- 3. FUNCAO GENERICA DE AUDITORIA (updated_at)
-- ----------------------------------------------------------------------------
-- Reaproveitada por todas as tabelas com updated_at (secao 12 da modelagem),
-- em vez de repetir a mesma logica em sete funcoes distintas (secao 15).

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. TABELA: perfis (modelagem secao 3.1)
-- ----------------------------------------------------------------------------
-- Extensao de auth.users com o papel de acesso (administrador/colaborador).

CREATE TABLE perfis (
  id             uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  papel          papel_usuario NOT NULL,
  nome_completo  text NOT NULL,
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE perfis IS
  'Perfil de acesso (administrador/colaborador), extensao 1:1 de auth.users. CASCADE aqui e intencional (unico caso): remover o usuario de autenticacao torna o perfil invalido por definicao. Ver docs/MODELO-BANCO-V1.md secao 3.1.';

CREATE TRIGGER trg_updated_at_perfis
  BEFORE UPDATE ON perfis
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. TABELA: equipes (modelagem secao 3.3)
-- ----------------------------------------------------------------------------

CREATE TABLE equipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_equipe_nome UNIQUE (nome)
);

COMMENT ON TABLE equipes IS
  'Agrupamento nomeado de colaboradores, sem logica de distribuicao automatica na V1. Ver docs/MODELO-BANCO-V1.md secao 3.3.';
COMMENT ON COLUMN equipes.ativo IS
  'Desativacao logica (regra importante #2). Exclusao fisica bloqueada por ON DELETE RESTRICT em colaboradores.equipe_id quando ha colaborador vinculado.';

CREATE TRIGGER trg_updated_at_equipes
  BEFORE UPDATE ON equipes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. TABELA: colaboradores (modelagem secao 3.2)
-- ----------------------------------------------------------------------------
-- ON DELETE RESTRICT em perfil_id/equipe_id: nao usar CASCADE em dados
-- historicos de operacao (regra importante #1).

CREATE TABLE colaboradores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfis (id) ON DELETE RESTRICT,
  equipe_id   uuid REFERENCES equipes (id) ON DELETE RESTRICT,
  matricula   text,
  telefone    text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_colaborador_perfil UNIQUE (perfil_id)
);

COMMENT ON TABLE colaboradores IS
  'Dados operacionais de um trabalhador (extensao de perfis com papel colaborador). Ver docs/MODELO-BANCO-V1.md secao 3.2.';
COMMENT ON COLUMN colaboradores.matricula IS
  'Opcional (regra importante #5). Unica somente quando preenchida — ver indice parcial uq_colaborador_matricula abaixo.';
COMMENT ON COLUMN colaboradores.ativo IS
  'Desligamento logico (regra importante #2). Nunca excluir fisicamente quando houver disponibilidade/escala associada.';

-- Matricula opcional, unica apenas quando informada (secao 5/18 da modelagem).
CREATE UNIQUE INDEX uq_colaborador_matricula
  ON colaboradores (matricula)
  WHERE matricula IS NOT NULL;

CREATE INDEX ix_colaborador_equipe ON colaboradores (equipe_id);
CREATE INDEX ix_colaborador_ativo ON colaboradores (ativo);

CREATE TRIGGER trg_updated_at_colaboradores
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Garante que so existe linha em "colaboradores" para perfis com
-- papel = 'colaborador' (secao 3.2/18 da modelagem).
CREATE OR REPLACE FUNCTION valida_perfil_do_colaborador()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  papel_do_perfil papel_usuario;
BEGIN
  SELECT papel INTO papel_do_perfil FROM perfis WHERE id = NEW.perfil_id;
  IF papel_do_perfil <> 'colaborador' THEN
    RAISE EXCEPTION 'Perfil % nao tem papel colaborador', NEW.perfil_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_valida_perfil_colaborador
  BEFORE INSERT OR UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION valida_perfil_do_colaborador();

-- ----------------------------------------------------------------------------
-- 7. TABELA: turnos (modelagem secao 3.5)
-- ----------------------------------------------------------------------------

CREATE TABLE turnos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  hora_inicio     time NOT NULL,
  hora_fim        time NOT NULL,
  ordem_exibicao  integer,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_turno_nome UNIQUE (nome),
  -- Elimina a ambiguidade de hora_inicio = hora_fim antes que ela chegue
  -- a checagem de sobreposicao (docs/MODELO-BANCO-V1.md secao 6.1, limitacao 1).
  CONSTRAINT chk_turno_horario_nao_degenerado CHECK (hora_inicio <> hora_fim)
);

COMMENT ON TABLE turnos IS
  'Fonte unica de nome/horario de turno, configuravel sem alteracao de codigo. Ver docs/MODELO-BANCO-V1.md secao 3.5.';
COMMENT ON COLUMN turnos.hora_fim IS
  'Pode ser MENOR que hora_inicio: significa que o turno cruza a meia-noite (ex.: Noite 20:00-02:00). Isso e esperado e tratado em escalas.fim_efetivo.';

CREATE TRIGGER trg_updated_at_turnos
  BEFORE UPDATE ON turnos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- 8. TABELA: periodos_operacao (modelagem secao 3.4)
-- ----------------------------------------------------------------------------
-- ON DELETE RESTRICT em created_by/confirmed_by: nao usar CASCADE em dados
-- historicos de operacao (regra importante #1).

CREATE TABLE periodos_operacao (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inicio   date NOT NULL,
  data_fim      date NOT NULL,
  status        status_periodo NOT NULL DEFAULT 'aberto',
  confirmed_at  timestamptz,
  confirmed_by  uuid REFERENCES perfis (id) ON DELETE RESTRICT,
  created_by    uuid NOT NULL REFERENCES perfis (id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  observacoes   text,
  CONSTRAINT uq_periodo_datas UNIQUE (data_inicio, data_fim),
  CONSTRAINT chk_periodo_datas CHECK (data_fim >= data_inicio)
);

COMMENT ON TABLE periodos_operacao IS
  'Final de semana de operacao e seu ciclo de vida (status), com confirmacao persistente (confirmed_at/confirmed_by). Ver docs/MODELO-BANCO-V1.md secoes 1, 3.4 e 9.';
COMMENT ON COLUMN periodos_operacao.confirmed_at IS
  'Obrigatorio quando status IN (confirmado, encerrado); proibido fora disso — ver trg_valida_confirmacao_periodo (regra importante #9).';

CREATE INDEX ix_periodo_status ON periodos_operacao (status);

CREATE TRIGGER trg_updated_at_periodos_operacao
  BEFORE UPDATE ON periodos_operacao
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Confirmacao persistente do periodo (regra importante #9): confirmed_at e
-- confirmed_by sao obrigatorios quando status IN (confirmado, encerrado), e
-- proibidos fora disso (secao 9/18 da modelagem).
CREATE OR REPLACE FUNCTION valida_confirmacao_periodo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('confirmado', 'encerrado') THEN
    IF NEW.confirmed_at IS NULL OR NEW.confirmed_by IS NULL THEN
      RAISE EXCEPTION 'confirmed_at e confirmed_by sao obrigatorios para status %', NEW.status;
    END IF;
  ELSE
    IF NEW.confirmed_at IS NOT NULL OR NEW.confirmed_by IS NOT NULL THEN
      RAISE EXCEPTION 'confirmed_at/confirmed_by so podem ser preenchidos em confirmado/encerrado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_valida_confirmacao_periodo
  BEFORE INSERT OR UPDATE ON periodos_operacao
  FOR EACH ROW EXECUTE FUNCTION valida_confirmacao_periodo();

-- ----------------------------------------------------------------------------
-- 9. FUNCAO: data deve pertencer ao periodo referenciado
-- ----------------------------------------------------------------------------
-- Compartilhada por disponibilidades e escalas (secao 3.6/3.7/18 da
-- modelagem). Definida apos periodos_operacao, que ela consulta.

CREATE OR REPLACE FUNCTION valida_data_pertence_ao_periodo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT data_inicio, data_fim INTO p
  FROM periodos_operacao WHERE id = NEW.periodo_id;

  IF NEW.data NOT IN (p.data_inicio, p.data_fim) THEN
    RAISE EXCEPTION 'A data % nao pertence ao periodo %', NEW.data, NEW.periodo_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. TABELA: disponibilidades (modelagem secao 3.6)
-- ----------------------------------------------------------------------------
-- Entidade independente de escalas (regra importante #3): SEM qualquer FK
-- para a tabela escalas. ON DELETE RESTRICT em todas as FKs (regra #1).

CREATE TABLE disponibilidades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  uuid NOT NULL REFERENCES colaboradores (id) ON DELETE RESTRICT,
  periodo_id      uuid NOT NULL REFERENCES periodos_operacao (id) ON DELETE RESTRICT,
  data            date NOT NULL,
  turno_id        uuid NOT NULL REFERENCES turnos (id) ON DELETE RESTRICT,
  disponivel      boolean NOT NULL,
  observacao      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_disponibilidade UNIQUE (colaborador_id, periodo_id, data, turno_id)
);

COMMENT ON TABLE disponibilidades IS
  'Intencao/capacidade informada pelo colaborador. NAO representa alocacao — ver escalas. Sem FK para escalas (regra importante #3). Ver docs/MODELO-BANCO-V1.md secao 3.6.';

CREATE INDEX ix_disponibilidade_periodo ON disponibilidades (periodo_id);
CREATE INDEX ix_disponibilidade_turno ON disponibilidades (turno_id);

CREATE TRIGGER trg_updated_at_disponibilidades
  BEFORE UPDATE ON disponibilidades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_valida_data_disponibilidade
  BEFORE INSERT OR UPDATE ON disponibilidades
  FOR EACH ROW EXECUTE FUNCTION valida_data_pertence_ao_periodo();

-- Escrita so e permitida enquanto o periodo esta 'aberto' (secao 3.6/18 da
-- modelagem).
CREATE OR REPLACE FUNCTION bloqueia_disponibilidade_fora_do_prazo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  status_atual status_periodo;
BEGIN
  SELECT status INTO status_atual FROM periodos_operacao WHERE id = NEW.periodo_id;
  IF status_atual <> 'aberto' THEN
    RAISE EXCEPTION 'Periodo % nao esta aberto para disponibilidade', NEW.periodo_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloqueia_disponibilidade
  BEFORE INSERT OR UPDATE ON disponibilidades
  FOR EACH ROW EXECUTE FUNCTION bloqueia_disponibilidade_fora_do_prazo();

-- ----------------------------------------------------------------------------
-- 11. TABELA: escalas (modelagem secoes 3.7, 6, 6.1, 11)
-- ----------------------------------------------------------------------------
-- Decisao final do administrador. Entidade independente de disponibilidades
-- (regra importante #3): SEM qualquer FK para a tabela disponibilidades.
-- Preserva snapshot imutavel do turno (regra #4/#5) e calcula
-- inicio_efetivo/fim_efetivo (colunas geradas) para a exclusion constraint
-- de conflito de horario (regra #6), com tratamento de turnos que cruzam a
-- meia-noite (regra #8). ON DELETE RESTRICT em todas as FKs (regra #1).

CREATE TABLE escalas (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id              uuid NOT NULL REFERENCES colaboradores (id) ON DELETE RESTRICT,
  periodo_id                  uuid NOT NULL REFERENCES periodos_operacao (id) ON DELETE RESTRICT,
  data                        date NOT NULL,
  turno_id                    uuid NOT NULL REFERENCES turnos (id) ON DELETE RESTRICT,

  -- Snapshot imutavel do turno no momento da alocacao (regra importante #4
  -- e #5): uma alteracao futura em "turnos" NUNCA reescreve estas colunas.
  turno_nome_snapshot         text NOT NULL,
  turno_hora_inicio_snapshot  time NOT NULL,
  turno_hora_fim_snapshot     time NOT NULL,

  created_by  uuid NOT NULL REFERENCES perfis (id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES perfis (id) ON DELETE RESTRICT,
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Instante absoluto de inicio da alocacao, gerado a partir do snapshot
  -- imutavel — nunca recalculado por edicao futura em "turnos".
  inicio_efetivo timestamp GENERATED ALWAYS AS (
    data + turno_hora_inicio_snapshot
  ) STORED,

  -- Instante absoluto de fim, tratando corretamente turnos que cruzam a
  -- meia-noite (regra importante #8): quando hora_fim <= hora_inicio, soma
  -- 24h ao intervalo entre os dois horarios. Gerada de forma independente
  -- de inicio_efetivo — o PostgreSQL nao permite que uma coluna gerada
  -- referencie outra coluna gerada (docs/MODELO-BANCO-V1.md secao 6.1).
  fim_efetivo timestamp GENERATED ALWAYS AS (
    (data + turno_hora_inicio_snapshot)
      + CASE
          WHEN turno_hora_fim_snapshot <= turno_hora_inicio_snapshot
            THEN interval '24 hours' + (turno_hora_fim_snapshot - turno_hora_inicio_snapshot)
          ELSE (turno_hora_fim_snapshot - turno_hora_inicio_snapshot)
        END
  ) STORED,

  CONSTRAINT uq_escala_sem_conflito UNIQUE (colaborador_id, periodo_id, data, turno_id),

  -- Impede que o mesmo colaborador tenha dois intervalos sobrepostos, mesmo
  -- em turnos diferentes e mesmo atravessando dias do periodo (regra
  -- importante #6/#7 — turnos que apenas encostam, ex. 08:00-14:00 e
  -- 14:00-20:00, sao permitidos pelo limite de intervalo semiaberto '[)').
  -- DEFERRABLE INITIALLY IMMEDIATE: comportamento identico ao nao diferido
  -- em operacoes comuns, mas permite SET CONSTRAINTS ... DEFERRED para
  -- reordenacoes atomicas de multiplas escalas numa mesma transacao.
  CONSTRAINT excl_escala_sem_sobreposicao EXCLUDE USING gist (
    colaborador_id WITH =,
    tsrange(inicio_efetivo, fim_efetivo, '[)') WITH &&
  ) DEFERRABLE INITIALLY IMMEDIATE
);

COMMENT ON TABLE escalas IS
  'Decisao final de alocacao do administrador. Entidade independente de disponibilidades (regra importante #3). Ver docs/MODELO-BANCO-V1.md secao 3.7.';
COMMENT ON COLUMN escalas.turno_nome_snapshot IS
  'Copia imutavel do turno no momento da alocacao. Nunca reescrita por edicoes futuras em turnos (regra importante #4/#5).';
COMMENT ON COLUMN escalas.inicio_efetivo IS
  'Instante absoluto de inicio, derivado do snapshot. Suporte a exclusion constraint e a consultas administrativas (docs/MODELO-BANCO-V1.md secao 6.1).';
COMMENT ON COLUMN escalas.fim_efetivo IS
  'Instante absoluto de fim, tratando turnos que cruzam a meia-noite (regra importante #8, docs/MODELO-BANCO-V1.md secao 6.1).';
COMMENT ON CONSTRAINT excl_escala_sem_sobreposicao ON escalas IS
  'Impede que o mesmo colaborador_id tenha escalas com intervalo de tempo sobreposto, mesmo em turno_id diferente (regra importante #6). Requer a extensao btree_gist.';

CREATE INDEX ix_escala_periodo ON escalas (periodo_id);
CREATE INDEX ix_escala_turno ON escalas (turno_id);

CREATE TRIGGER trg_updated_at_escalas
  BEFORE UPDATE ON escalas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_valida_data_escala
  BEFORE INSERT OR UPDATE ON escalas
  FOR EACH ROW EXECUTE FUNCTION valida_data_pertence_ao_periodo();

-- Preenche/atualiza o snapshot do turno ao criar a escala ou ao trocar o
-- turno_id (regra importante #4/#5, secao 11/18 da modelagem).
CREATE OR REPLACE FUNCTION preenche_snapshot_turno()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT nome, hora_inicio, hora_fim
    INTO NEW.turno_nome_snapshot, NEW.turno_hora_inicio_snapshot, NEW.turno_hora_fim_snapshot
    FROM turnos WHERE id = NEW.turno_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_turno
  BEFORE INSERT OR UPDATE OF turno_id ON escalas
  FOR EACH ROW EXECUTE FUNCTION preenche_snapshot_turno();

COMMIT;
