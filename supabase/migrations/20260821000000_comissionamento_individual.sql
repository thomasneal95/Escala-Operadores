-- ============================================================================
-- Escala Operadores — Migration: comissionamento individual
--
-- Alguns colaboradores (ex.: home office, sem equipe) recebem um valor
-- fixo por lead convertido, sem divisão com ninguém e sem distinção entre
-- dia de semana e fim de semana. Esta migration adiciona a sinalização
-- desse modo no cadastro, e o campo correspondente no fechamento salvo.
-- ============================================================================

BEGIN;

ALTER TABLE colaboradores
  ADD COLUMN comissionamento_individual boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN colaboradores.comissionamento_individual IS
  'Se verdadeiro, os leads convertidos dessa pessoa geram um valor fixo por lead, sem divisão de equipe e sem distinção de dia. Usado para colaboradores home office sem equipe.';

ALTER TABLE fechamentos_mensais
  ADD COLUMN comissao_individual numeric(10,2) NOT NULL DEFAULT 0;

COMMIT;