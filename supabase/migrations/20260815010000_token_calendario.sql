-- ============================================================================
-- Escala Operadores — Migration: token de assinatura de calendário
--
-- Cada colaborador ganha um token único e secreto, usado para gerar um
-- link de "assinatura de calendário" (.ics) que ele adiciona uma única vez
-- no Google Calendar/Apple Calendar, e a partir daí os turnos aparecem
-- automaticamente lá, sem precisar adicionar manualmente toda semana.
--
-- Esse token NÃO é a senha da pessoa — é só um identificador aleatório
-- usado por uma função pública (sem exigir login), então precisa ser
-- tratado como algo sensível (quem tiver o link vê a escala daquela
-- pessoa, então não deve ser compartilhado).
-- ============================================================================

BEGIN;

ALTER TABLE colaboradores
  ADD COLUMN calendario_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

COMMENT ON COLUMN colaboradores.calendario_token IS
  'Token secreto usado no link de assinatura de calendário (.ics) deste colaborador. Não é uma senha, mas deve ser tratado como confidencial.';

COMMIT;