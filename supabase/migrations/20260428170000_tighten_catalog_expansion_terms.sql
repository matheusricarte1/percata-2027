-- Evita que expansoes com frases gerem candidatos por palavras soltas amplas.

INSERT INTO public.catalogo_search_synonyms (term_norm, expansion_norm)
VALUES
  ('ar condicionado', 'ar condicionado|condicionador de ar|refrigeracao|climatizacao|climatizador'),
  ('condicionador', 'ar condicionado|condicionador de ar|refrigeracao|climatizacao|climatizador'),
  ('climatizador', 'ar condicionado|condicionador de ar|refrigeracao|climatizacao')
ON CONFLICT (term_norm)
DO UPDATE SET expansion_norm = EXCLUDED.expansion_norm;

CREATE OR REPLACE FUNCTION public.catalogo_query_expansion_parts(input_text TEXT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT public.catalogo_normalize_text(input_text) AS q
  ),
  matched_synonyms AS (
    SELECT s.expansion_norm
    FROM public.catalogo_search_synonyms s, normalized n
    WHERE n.q <> ''
      AND (
        n.q LIKE '%' || public.catalogo_normalize_text(s.term_norm) || '%'
        OR public.catalogo_normalize_text(s.term_norm) LIKE '%' || n.q || '%'
      )
  ),
  parts AS (
    SELECT public.catalogo_normalize_text(regexp_split_to_table(expansion_norm, '\s*\|\s*')) AS part
    FROM matched_synonyms
    UNION ALL
    SELECT regexp_split_to_table((SELECT q FROM normalized), '\s+') AS part
  )
  SELECT coalesce(array_agg(DISTINCT part), ARRAY[]::TEXT[])
  FROM parts
  WHERE length(part) >= 3
    AND NOT part = ANY(public.catalogo_search_stopwords());
$$;

NOTIFY pgrst, 'reload schema';
