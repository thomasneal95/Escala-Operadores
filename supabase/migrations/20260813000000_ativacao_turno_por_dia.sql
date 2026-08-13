-- ============================================================================
-- Escala Operadores — Migration: ativação de turno por dia da semana
--
-- Permite desativar um turno especificamente no sábado ou no domingo (ex.:
-- a operação não funciona domingo de manhã), sem precisar desativar o
-- turno por completo (que ainda pode funcionar normalmente no outro dia).
--
-- Por padrão, ambos ficam true (comportamento atual preservado).
-- ============================================================================

BEGIN;

ALTER TABLE turnos
  ADD COLUMN ativo_sabado boolean NOT NULL DEFAULT true,
  ADD COLUMN ativo_domingo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN turnos.ativo_sabado IS
  'Se false, este turno não é oferecido no sábado (data_inicio do período), mesmo estando ativo=true.';
COMMENT ON COLUMN turnos.ativo_domingo IS
  'Se false, este turno não é oferecido no domingo (data_fim do período), mesmo estando ativo=true.';

COMMIT;