-- ============================================================================
-- Jornada 360 — Migration: salários do quadro geral viram pagamentos fixos
--
-- Os salários fixos cadastrados só para o Quadro geral (ex.: o do
-- administrador) passam a ser pagamentos fixos da TNT: aparecem na lista do
-- fechamento da TNT e, por ela, no Quadro geral. O mês de início vira a data
-- de início (dia 1 = salário cheio a partir daquele mês).
--
-- Copia as linhas e só então remove a tabela antiga, na mesma transação.
-- ============================================================================

BEGIN;

INSERT INTO pagamentos_fixos (nome, tipo, valor, data_inicio)
SELECT nome, 'salario_fixo', valor, desde
FROM pagamentos_quadro_geral;

DROP TABLE pagamentos_quadro_geral;

COMMIT;
