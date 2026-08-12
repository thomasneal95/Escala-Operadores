-- ============================================================================
-- Escala Operadores — Migration: Row Level Security (RLS) e policies
--
-- Implementa a seguranca descrita em docs/MODELO-BANCO-V1.md secao 14 e
-- docs/ESPECIFICACAO-V1.md secao 13, sobre a migration inicial
-- (20260811000000_initial_schema.sql).
--
-- Papeis:
--   - administrador: acesso completo de leitura e escrita em todas as
--     tabelas do dominio.
--   - colaborador: le/edita apenas os proprios dados; disponibilidade so
--     pode ser escrita enquanto o periodo esta 'aberto'; escala so pode
--     ser lida quando o periodo esta 'confirmado' ou 'encerrado'.
--
-- perfis.id = auth.users.id (mesmo uuid), o que permite usar auth.uid()
-- diretamente nas policies, sem tabela de mapeamento adicional.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. FUNCAO AUXILIAR: is_admin()
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER e necessario: sem ele, a funcao rodaria com as
-- permissoes do usuario que a chamou, e como "perfis" tera RLS ativado,
-- ela nao conseguiria ler a propria tabela "perfis" para checar o papel.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = auth.uid() AND papel = 'administrador'
  );
$$;

COMMENT ON FUNCTION is_admin() IS
  'Retorna true se o usuario autenticado (auth.uid()) tem papel administrador em perfis. SECURITY DEFINER para nao ser bloqueada pelo RLS da propria tabela perfis.';

-- ----------------------------------------------------------------------------
-- 2. PERFIS
-- ----------------------------------------------------------------------------

ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ve o proprio perfil"
ON perfis FOR SELECT
USING (id = auth.uid() OR is_admin());

CREATE POLICY "Colaborador edita o proprio perfil"
ON perfis FOR UPDATE
USING (id = auth.uid() OR is_admin());

CREATE POLICY "Admin insere perfis"
ON perfis FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin remove perfis"
ON perfis FOR DELETE
USING (is_admin());

-- ----------------------------------------------------------------------------
-- 3. COLABORADORES
-- ----------------------------------------------------------------------------

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ve o proprio registro"
ON colaboradores FOR SELECT
USING (perfil_id = auth.uid() OR is_admin());

CREATE POLICY "Admin insere colaboradores"
ON colaboradores FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita colaboradores"
ON colaboradores FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove colaboradores"
ON colaboradores FOR DELETE
USING (is_admin());

-- ----------------------------------------------------------------------------
-- 4. EQUIPES
-- ----------------------------------------------------------------------------

ALTER TABLE equipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados veem equipes"
ON equipes FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin insere equipes"
ON equipes FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita equipes"
ON equipes FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove equipes"
ON equipes FOR DELETE
USING (is_admin());

-- ----------------------------------------------------------------------------
-- 5. TURNOS
-- ----------------------------------------------------------------------------

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados veem turnos"
ON turnos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin insere turnos"
ON turnos FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita turnos"
ON turnos FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove turnos"
ON turnos FOR DELETE
USING (is_admin());

-- ----------------------------------------------------------------------------
-- 6. PERIODOS_OPERACAO
-- ----------------------------------------------------------------------------

ALTER TABLE periodos_operacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados veem periodos"
ON periodos_operacao FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin insere periodos"
ON periodos_operacao FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita periodos"
ON periodos_operacao FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove periodos"
ON periodos_operacao FOR DELETE
USING (is_admin());

-- ----------------------------------------------------------------------------
-- 7. DISPONIBILIDADES
-- ----------------------------------------------------------------------------

ALTER TABLE disponibilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ve a propria disponibilidade"
ON disponibilidades FOR SELECT
USING (
    colaborador_id IN (SELECT id FROM colaboradores WHERE perfil_id = auth.uid())
    OR is_admin()
);

CREATE POLICY "Colaborador insere a propria disponibilidade"
ON disponibilidades FOR INSERT
WITH CHECK (
    (
        colaborador_id IN (SELECT id FROM colaboradores WHERE perfil_id = auth.uid())
        AND periodo_id IN (SELECT id FROM periodos_operacao WHERE status = 'aberto')
    )
    OR is_admin()
);

CREATE POLICY "Colaborador edita a propria disponibilidade"
ON disponibilidades FOR UPDATE
USING (
    (
        colaborador_id IN (SELECT id FROM colaboradores WHERE perfil_id = auth.uid())
        AND periodo_id IN (SELECT id FROM periodos_operacao WHERE status = 'aberto')
    )
    OR is_admin()
);

CREATE POLICY "Admin remove disponibilidades"
ON disponibilidades FOR DELETE
USING (is_admin());

-- ----------------------------------------------------------------------------
-- 8. ESCALAS
-- ----------------------------------------------------------------------------

ALTER TABLE escalas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colaborador ve a propria escala"
ON escalas FOR SELECT
USING (
    (
        colaborador_id IN (SELECT id FROM colaboradores WHERE perfil_id = auth.uid())
        AND periodo_id IN (
            SELECT id FROM periodos_operacao WHERE status IN ('confirmado', 'encerrado')
        )
    )
    OR is_admin()
);

CREATE POLICY "Admin insere escalas"
ON escalas FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin edita escalas"
ON escalas FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin remove escalas"
ON escalas FOR DELETE
USING (is_admin());

COMMIT;