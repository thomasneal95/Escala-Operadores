-- ============================================================================
-- Escala Operadores — Migration: e-mail em perfis
--
-- Guarda uma cópia do e-mail de login de cada pessoa na tabela perfis.
-- Necessário para cruzar os leads convertidos (vindos da API externa, que
-- identifica o operador pelo e-mail) com o colaborador correspondente no
-- nosso sistema, sem precisar consultar o sistema de autenticação toda vez.
-- ============================================================================

BEGIN;

ALTER TABLE perfis
  ADD COLUMN email text;

COMMENT ON COLUMN perfis.email IS
  'Cópia do e-mail de login (auth.users.email), usada para cruzar com dados de sistemas externos (ex.: apuração de leads/comissionamento).';

-- Preenche os registros já existentes, copiando do sistema de autenticação.
UPDATE perfis
SET email = auth.users.email
FROM auth.users
WHERE perfis.id = auth.users.id
  AND perfis.email IS NULL;

COMMIT;