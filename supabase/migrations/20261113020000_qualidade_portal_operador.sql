-- ============================================================================
-- Jornada 360 — Migration: qualidade no portal do operador
--
-- Aba "Qualidade" do operador: cada pessoa vê os próprios relatórios de
-- qualidade (nota, resumo e tópicos) — nunca os de colegas — e a média da
-- equipe dela, só como número agregado.
--
-- 1. SELECT nos próprios relatórios e tópicos (o arquivo original continua
--    só para admin: o bucket não muda).
-- 2. media_qualidade_minha_equipe(inicio, fim): média das notas e quantidade
--    de relatórios da equipe de quem chama, no período. SECURITY DEFINER para
--    agregar sem dar acesso às linhas dos colegas.
--
-- Só adiciona políticas e uma função; nenhum dado é alterado.
-- ============================================================================

BEGIN;

CREATE POLICY "Colaborador ve os proprios relatorios de qualidade"
ON relatorios_qualidade FOR SELECT
USING (colaborador_id IS NOT NULL AND colaborador_id = meu_colaborador_id());

CREATE POLICY "Colaborador ve os topicos dos proprios relatorios"
ON relatorio_qualidade_topicos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM relatorios_qualidade r
    WHERE r.id = relatorio_id
      AND r.colaborador_id IS NOT NULL
      AND r.colaborador_id = meu_colaborador_id()
  )
);

CREATE OR REPLACE FUNCTION media_qualidade_minha_equipe(p_inicio date, p_fim date)
RETURNS TABLE (media numeric, relatorios integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT round(avg(r.nota), 2), count(*)::integer
  FROM relatorios_qualidade r
  JOIN colaboradores c ON c.id = r.colaborador_id
  WHERE c.equipe_id = (SELECT equipe_id FROM colaboradores WHERE id = meu_colaborador_id())
    AND r.nota IS NOT NULL
    AND r.data_avaliacao BETWEEN p_inicio AND p_fim;
$$;

COMMENT ON FUNCTION media_qualidade_minha_equipe(date, date) IS
  'Média das notas de qualidade (e quantidade de relatórios) da equipe de quem chama no período. Só o agregado — nenhum relatório de colega é exposto.';

REVOKE ALL ON FUNCTION media_qualidade_minha_equipe(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION media_qualidade_minha_equipe(date, date) TO authenticated;

COMMIT;
