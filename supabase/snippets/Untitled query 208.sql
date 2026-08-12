SELECT
    p.id,
    p.papel,
    p.nome_completo,
    p.ativo,
    u.email
FROM perfis p
LEFT JOIN auth.users u
    ON u.id = p.id
ORDER BY p.created_at;