-- Aggregated taxonomy by GND bucket for lazy expert catalog navigation.
-- The technical catalog tree opens by GND first, so group/class counts must be
-- scoped to the selected GND bucket instead of using the global taxonomy mart.

DROP VIEW IF EXISTS public.efisco_taxonomy_gnd_distribution;
DROP MATERIALIZED VIEW IF EXISTS public.efisco_taxonomy_gnd_distribution;

CREATE MATERIALIZED VIEW public.efisco_taxonomy_gnd_distribution AS
SELECT
  CASE
    WHEN left(coalesce(gnd_value, ''), 1) IN ('3', '4', '5') THEN left(gnd_value, 1)
    ELSE 'sem-gnd'
  END AS gnd_bucket,
  d.codigo_grupo,
  d.nome_grupo,
  d.codigo_classe,
  d.nome_classe,
  count(DISTINCT d.id) AS itens
FROM public.catalogo_efisco_v2 d
LEFT JOIN LATERAL unnest(
  CASE
    WHEN array_length(d.gnds, 1) IS NULL THEN ARRAY[NULL::text]
    ELSE d.gnds
  END
) AS g(gnd_value) ON true
GROUP BY 1, 2, 3, 4, 5;

CREATE INDEX IF NOT EXISTS idx_efisco_taxonomy_gnd_distribution_gnd_itens
  ON public.efisco_taxonomy_gnd_distribution (gnd_bucket, itens DESC);

CREATE INDEX IF NOT EXISTS idx_efisco_taxonomy_gnd_distribution_gnd_group_itens
  ON public.efisco_taxonomy_gnd_distribution (gnd_bucket, codigo_grupo, itens DESC);

GRANT SELECT ON public.efisco_taxonomy_gnd_distribution TO authenticated, service_role;
