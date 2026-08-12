-- ============================================================================
-- Escala Operadores — Seed de dados de teste (ambiente local)
--
-- Executado automaticamente ao final de `supabase db reset`. Popula o
-- banco com um cenario minimo e reproduzivel para desenvolvimento:
--   - 1 administrador de teste
--   - 1 colaborador de teste
--   - 1 equipe
--   - 3 turnos (Manha, Tarde, Noite)
--   - 1 periodo de operacao (aberto)
--   - 1 disponibilidade
--   - 1 escala
--
-- NAO usar em produção. Credenciais de teste, nao seguras.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USUARIOS DE AUTENTICACAO (auth.users)
-- ----------------------------------------------------------------------------
-- perfis.id referencia auth.users.id, entao precisamos criar os usuarios de
-- autenticacao antes de qualquer perfil. Senhas de teste: "senha123456".

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated',
    'admin@teste.com',
    crypt('senha123456', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated',
    'joao@teste.com',
    crypt('senha123456', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', ''
  );

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  (
    gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@teste.com"}',
    'email', now(), now(), now()
  ),
  (
    gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
    '22222222-2222-2222-2222-222222222222',
    '{"sub":"22222222-2222-2222-2222-222222222222","email":"joao@teste.com"}',
    'email', now(), now(), now()
  );

-- ----------------------------------------------------------------------------
-- 2. PERFIS
-- ----------------------------------------------------------------------------

INSERT INTO perfis (id, papel, nome_completo) VALUES
  ('11111111-1111-1111-1111-111111111111', 'administrador', 'Administrador de Teste'),
  ('22222222-2222-2222-2222-222222222222', 'colaborador', 'João da Silva (Teste)');

-- ----------------------------------------------------------------------------
-- 3. EQUIPES
-- ----------------------------------------------------------------------------

INSERT INTO equipes (id, nome) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Equipe A');

-- ----------------------------------------------------------------------------
-- 4. COLABORADORES
-- ----------------------------------------------------------------------------

INSERT INTO colaboradores (id, perfil_id, equipe_id, telefone) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '11999990000'
  );

-- ----------------------------------------------------------------------------
-- 5. TURNOS
-- ----------------------------------------------------------------------------

INSERT INTO turnos (id, nome, hora_inicio, hora_fim, ordem_exibicao) VALUES
  ('55555555-5555-5555-5555-555555555551', 'Manhã', '08:00', '14:00', 1),
  ('55555555-5555-5555-5555-555555555552', 'Tarde', '14:00', '20:00', 2),
  ('55555555-5555-5555-5555-555555555553', 'Noite', '20:00', '02:00', 3);

-- ----------------------------------------------------------------------------
-- 6. PERIODO DE OPERACAO
-- ----------------------------------------------------------------------------
-- Final de semana de 15-16/08/2026, aberto para disponibilidade.

INSERT INTO periodos_operacao (id, data_inicio, data_fim, status, created_by) VALUES
  (
    '66666666-6666-6666-6666-666666666666',
    '2026-08-15', '2026-08-16',
    'aberto',
    '11111111-1111-1111-1111-111111111111'
  );

-- ----------------------------------------------------------------------------
-- 7. DISPONIBILIDADE
-- ----------------------------------------------------------------------------
-- João informou disponibilidade para o turno da Manhã, sábado 15/08.

INSERT INTO disponibilidades (colaborador_id, periodo_id, data, turno_id, disponivel) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    '2026-08-15',
    '55555555-5555-5555-5555-555555555551',
    true
  );

-- ----------------------------------------------------------------------------
-- 8. ESCALA
-- ----------------------------------------------------------------------------
-- Administrador escala João para o turno da Manhã, sábado 15/08.
-- turno_nome_snapshot/turno_hora_*_snapshot sao preenchidos automaticamente
-- pelo trigger trg_snapshot_turno — nao precisam ser informados aqui.

INSERT INTO escalas (colaborador_id, periodo_id, data, turno_id, created_by) VALUES
  (
    '44444444-4444-4444-4444-444444444444',
    '66666666-6666-6666-6666-666666666666',
    '2026-08-15',
    '55555555-5555-5555-5555-555555555551',
    '11111111-1111-1111-1111-111111111111'
  );