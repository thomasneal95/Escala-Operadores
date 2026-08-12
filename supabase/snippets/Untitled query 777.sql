INSERT INTO perfis (
    id,
    papel,
    nome_completo
)
SELECT
    id,
    'administrador',
    'Administrador de Teste'
FROM auth.users
WHERE email = 'admin.teste@escala.local';

INSERT INTO perfis (
    id,
    papel,
    nome_completo
)
SELECT
    id,
    'colaborador',
    'Colaborador de Teste'
FROM auth.users
WHERE email = 'colaborador.teste@escala.local';