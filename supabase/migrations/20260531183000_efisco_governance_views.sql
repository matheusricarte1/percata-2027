-- Public governance views for the normalized DBAtualizado/e-Fisco catalog.

CREATE OR REPLACE VIEW public.efisco_quality_overview AS
SELECT *
FROM efisco_analytics.mv_efisco_quality_overview;

ALTER VIEW public.efisco_quality_overview SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_gnd_distribution AS
SELECT *
FROM efisco_analytics.mv_efisco_gnd_distribution;

ALTER VIEW public.efisco_gnd_distribution SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_taxonomy_distribution AS
SELECT *
FROM efisco_analytics.mv_efisco_taxonomy_distribution;

ALTER VIEW public.efisco_taxonomy_distribution SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_item_ambiguity AS
SELECT *
FROM efisco_analytics.mv_efisco_item_ambiguity;

ALTER VIEW public.efisco_item_ambiguity SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_planning_signals AS
SELECT *
FROM efisco_analytics.mv_efisco_planning_signals;

ALTER VIEW public.efisco_planning_signals SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_items_missing_natureza AS
SELECT
  i.id AS efisco_item_id,
  i.codigo_item AS codigo_efisco,
  i.nome_item AS descricao,
  i.tipo_objeto,
  i.codigo_material_servico,
  ms.nome_material_servico,
  c.codigo_classe,
  c.nome_classe,
  g.codigo_grupo,
  g.nome_grupo,
  i.natureza_count,
  i.has_missing_natureza,
  i.has_mixed_expense_classes,
  i.updated_at
FROM efisco_core.itens i
JOIN efisco_core.materiais_servicos ms ON ms.codigo_material_servico = i.codigo_material_servico
JOIN efisco_core.classes c ON c.codigo_classe = ms.codigo_classe
JOIN efisco_core.grupos g ON g.codigo_grupo = c.codigo_grupo
WHERE i.has_missing_natureza;

ALTER VIEW public.efisco_items_missing_natureza SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_items_mixed_expense_classes AS
SELECT
  i.id AS efisco_item_id,
  i.codigo_item AS codigo_efisco,
  i.nome_item AS descricao,
  i.tipo_objeto,
  i.codigo_material_servico,
  ms.nome_material_servico,
  c.codigo_classe,
  c.nome_classe,
  g.codigo_grupo,
  g.nome_grupo,
  i.natureza_count,
  array_agg(DISTINCT inat.gnd ORDER BY inat.gnd) FILTER (WHERE inat.gnd IS NOT NULL) AS gnds,
  array_agg(DISTINCT inat.codigo_natureza_despesa ORDER BY inat.codigo_natureza_despesa)
    FILTER (WHERE inat.codigo_natureza_despesa IS NOT NULL) AS naturezas,
  i.updated_at
FROM efisco_core.itens i
JOIN efisco_core.materiais_servicos ms ON ms.codigo_material_servico = i.codigo_material_servico
JOIN efisco_core.classes c ON c.codigo_classe = ms.codigo_classe
JOIN efisco_core.grupos g ON g.codigo_grupo = c.codigo_grupo
LEFT JOIN efisco_core.item_naturezas inat ON inat.item_id = i.id
WHERE i.has_mixed_expense_classes
GROUP BY
  i.id,
  i.codigo_item,
  i.nome_item,
  i.tipo_objeto,
  i.codigo_material_servico,
  ms.nome_material_servico,
  c.codigo_classe,
  c.nome_classe,
  g.codigo_grupo,
  g.nome_grupo,
  i.natureza_count,
  i.updated_at;

ALTER VIEW public.efisco_items_mixed_expense_classes SET (security_invoker = true);

GRANT SELECT ON
  public.efisco_quality_overview,
  public.efisco_gnd_distribution,
  public.efisco_taxonomy_distribution,
  public.efisco_item_ambiguity,
  public.efisco_planning_signals,
  public.efisco_items_missing_natureza,
  public.efisco_items_mixed_expense_classes
TO authenticated, service_role;
