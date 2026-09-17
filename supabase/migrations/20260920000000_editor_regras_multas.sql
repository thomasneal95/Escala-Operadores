-- ============================================================================
-- Escala Operadores — Migration: regras de multas viram conteudo estruturado
-- editavel pelo admin
--
-- A coluna "regras" (texto solto) nao servia mais desde que o dashboard
-- passou a usar categorias fixas no codigo. Agora guardamos a estrutura de
-- verdade no banco (categorias com icone + lista de regras, e o texto do
-- alerta), editavel pelo admin, mantendo o mesmo conteudo que ja estava no
-- ar como valor inicial.
-- ============================================================================

BEGIN;

ALTER TABLE configuracao_multas
  DROP COLUMN regras,
  ADD COLUMN categorias jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN alerta_titulo text NOT NULL DEFAULT 'Multa por descumprimento',
  ADD COLUMN alerta_texto text NOT NULL DEFAULT '';

COMMENT ON COLUMN configuracao_multas.categorias IS
  'Array de categorias de regras: [{"id": string, "titulo": string, "icone": string, "regras": string[]}]. "icone" referencia uma chave fixa do mapa de icones no frontend (ver src/lib/iconesMultas.tsx).';
COMMENT ON COLUMN configuracao_multas.alerta_texto IS
  'Texto (um parágrafo por linha, separado por \n\n) da caixa de alerta de multa por descumprimento, exibida em destaque no dashboard de regras.';

UPDATE configuracao_multas
SET
  categorias = '[
    {
      "id": "cozinha",
      "titulo": "Cozinha",
      "icone": "cozinha",
      "regras": [
        "Utilizou qualquer louça? Lave imediatamente após o uso.",
        "Caso faça suas refeições na bancada, limpe o local ao finalizar.",
        "Passe uma vassoura se sujou para manter a cozinha limpa.",
        "Para evitar acúmulo de louça na pia, seque a louça assim que lavar."
      ]
    },
    {
      "id": "banheiro",
      "titulo": "Banheiro",
      "icone": "banheiro",
      "regras": [
        "Mantenha o vaso sanitário limpo após cada utilização."
      ]
    },
    {
      "id": "mesa",
      "titulo": "Mesa de trabalho",
      "icone": "mesa",
      "regras": [
        "Mantenha sua mesa sempre limpa, organizada e livre de objetos desnecessários."
      ]
    },
    {
      "id": "mochilas",
      "titulo": "Mochilas",
      "icone": "mochila",
      "regras": [
        "Todas as mochilas devem estar em local que não atrapalhe a movimentação de qualquer pessoa."
      ]
    }
  ]'::jsonb,
  alerta_titulo = 'Multa por descumprimento',
  alerta_texto = 'Para garantir o cumprimento das regras e a boa convivência entre todos, o descumprimento de qualquer regra acima estará sujeito a multa de **R$ 20,00** por ocorrência.

As multas valem para todos os dias e serão cobradas toda segunda-feira. Se a semana virar sem o pagamento, o valor da multa pendente passa a ter juros de **50%**.

Agradecemos a compreensão e a colaboração de todos. Pequenas atitudes fazem toda a diferença para mantermos um ambiente de trabalho mais organizado, produtivo e agradável.'
WHERE id = true;

COMMIT;
