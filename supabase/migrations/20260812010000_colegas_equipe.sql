-- ============================================================================
-- Escala Operadores — Migration: colegas de equipe
--
-- Permite que um colaborador veja os demais colaboradores da mesma equipe
-- (nome e telefone), além do próprio registro. Não libera nenhum outro
-- dado (disponibilidade, escala, etc. de terceiros continuam restritos
-- pelas policies já existentes).
--
-- Usa uma função SECURITY DEFINER para descobrir a equipe do usuário
-- logado sem recursão nas policies de RLS.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION minha_equipe_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT equipe_id FROM colaboradores WHERE perfil_id = auth.uid();
$$;

COMMENT ON FUNCTION minha_equipe_id() IS
  'Retorna o equipe_id do colaborador correspondente ao usuário autenticado, ou NULL. SECURITY DEFINER para evitar recursão de RLS.';

-- colaboradores: além do próprio registro, também os colegas da mesma equipe.
CREATE POLICY "Colaborador ve colegas de equipe"
ON colaboradores FOR SELECT
USING (
    equipe_id IS NOT NULL
    AND equipe_id = minha_equipe_id()
);

-- perfis: nome dos colegas de equipe (necessário para exibir a lista).
CREATE POLICY "Colaborador ve perfis de colegas de equipe"
ON perfis FOR SELECT
USING (
    id IN (
        SELECT perfil_id FROM colaboradores
        WHERE equipe_id IS NOT NULL AND equipe_id = minha_equipe_id()
    )
);

COMMIT;