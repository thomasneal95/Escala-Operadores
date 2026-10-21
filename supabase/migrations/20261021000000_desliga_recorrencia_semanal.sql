-- ============================================================================
-- Escala Operadores — Migration: desliga a recorrência semanal
--
-- A escala do fim de semana passa a ser gerada pelo admin para o mês inteiro
-- de uma vez, pelo histórico (sem formulário de disponibilidade). A rotina
-- que abria um período "aberto" toda semana para receber disponibilidade
-- deixa de ser usada. Só desativa a configuração — nada é apagado, e ela
-- pode ser religada em Configurações.
-- ============================================================================

BEGIN;

UPDATE configuracao_recorrencia SET ativo = false;

COMMIT;
