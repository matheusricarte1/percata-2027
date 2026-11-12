-- Optimize e-Fisco governance operational queues.
-- The previous public queue views joined/aggregated large normalized tables at
-- request time. Admin governance now reads from the precomputed search document
-- table, so these indexes keep the first page stable under PostgREST timeout.

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_missing_id
  ON efisco_search.catalogo_documents (has_missing_natureza, id)
  WHERE has_missing_natureza;

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_mixed_natureza_id
  ON efisco_search.catalogo_documents (
    has_mixed_expense_classes,
    natureza_count DESC,
    id
  )
  WHERE has_mixed_expense_classes;

CREATE OR REPLACE VIEW public.catalogo_efisco_v2 AS
SELECT
  d.id,
  d.codigo_item AS codigo_efisco,
  d.nome_item AS descricao,
  CASE WHEN d.tipo_objeto = 'SERVIÇO' THEN 'Serviço' ELSE 'Material' END AS tipo,
  CASE WHEN d.tipo_objeto = 'SERVIÇO' THEN 'Serviço' ELSE 'Material' END AS categoria,
  d.nome_grupo AS grupo,
  d.nome_classe AS classe,
  d.tipo_objeto,
  d.codigo_grupo,
  d.nome_grupo,
  d.codigo_classe,
  d.nome_classe,
  d.codigo_material_servico,
  d.nome_material_servico,
  d.naturezas[1] AS codigo_natureza_preferencial,
  d.gnds[1] AS gnd_preferencial,
  d.natureza_count,
  'UN'::TEXT AS unidade_medida,
  d.has_mixed_expense_classes,
  d.has_missing_natureza,
  d.gnds,
  d.naturezas
FROM efisco_search.catalogo_documents d;

ALTER VIEW public.catalogo_efisco_v2 SET (security_invoker = true);

GRANT SELECT ON public.catalogo_efisco_v2 TO authenticated, service_role;
