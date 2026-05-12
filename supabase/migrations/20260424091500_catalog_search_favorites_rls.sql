-- Catalogo: busca relevante e favoritos por usuario
-- Data: 2026-04-24

CREATE TABLE IF NOT EXISTS public.catalogo_favoritos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES public.catalogo(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_favoritos_user_created
  ON public.catalogo_favoritos (user_id, created_at DESC);

ALTER TABLE public.catalogo_favoritos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_favoritos_select_own ON public.catalogo_favoritos;
DROP POLICY IF EXISTS catalogo_favoritos_insert_own ON public.catalogo_favoritos;
DROP POLICY IF EXISTS catalogo_favoritos_delete_own ON public.catalogo_favoritos;

CREATE POLICY catalogo_favoritos_select_own
ON public.catalogo_favoritos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY catalogo_favoritos_insert_own
ON public.catalogo_favoritos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY catalogo_favoritos_delete_own
ON public.catalogo_favoritos
FOR DELETE
USING (auth.uid() = user_id);

DROP FUNCTION IF EXISTS public.buscar_catalogo_inteligente(TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.buscar_catalogo_inteligente(
  query_text TEXT,
  categoria_filtro TEXT DEFAULT 'all',
  limit_val INT DEFAULT 30,
  offset_val INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  codigo_efisco TEXT,
  descricao TEXT,
  tipo TEXT,
  categoria TEXT,
  grupo TEXT,
  classe TEXT,
  rank REAL
) AS $$
DECLARE
  normalized_query TEXT := trim(lower(coalesce(query_text, '')));
  normalized_category TEXT := trim(lower(coalesce(categoria_filtro, 'all')));
  is_code_query BOOLEAN;
  query_terms TSQUERY;
BEGIN
  normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
  is_code_query := normalized_query ~ '^[a-z0-9.\-_/]+$' AND position(' ' in normalized_query) = 0;

  IF normalized_query = '' THEN
    RETURN QUERY
    SELECT
      c.id,
      c.codigo_efisco,
      c.descricao,
      c.tipo,
      c.categoria,
      c.grupo,
      c.classe,
      0::REAL AS rank
    FROM public.catalogo c
    WHERE
      normalized_category = 'all'
      OR lower(coalesce(c.tipo, '')) = normalized_category
      OR lower(coalesce(c.categoria, '')) = normalized_category
    ORDER BY c.id ASC
    LIMIT limit_val
    OFFSET offset_val;

    RETURN;
  END IF;

  query_terms := plainto_tsquery('portuguese', normalized_query);

  RETURN QUERY
  WITH scored AS (
    SELECT
      c.*,
      CASE
        WHEN lower(coalesce(c.codigo_efisco, '')) = normalized_query THEN 1
        ELSE 0
      END AS exact_code,
      CASE
        WHEN lower(coalesce(c.codigo_efisco, '')) LIKE normalized_query || '%' THEN 1
        ELSE 0
      END AS prefix_code,
      CASE
        WHEN lower(coalesce(c.descricao, '')) LIKE '%' || normalized_query || '%' THEN 1
        ELSE 0
      END AS phrase_desc,
      CASE
        WHEN lower(coalesce(c.classe, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(c.grupo, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(c.categoria, '')) LIKE '%' || normalized_query || '%'
        THEN 1
        ELSE 0
      END AS taxonomy_match,
      ts_rank_cd(
        to_tsvector('portuguese', coalesce(c.descricao, '')),
        query_terms
      ) AS ts_rank
    FROM public.catalogo c
    WHERE
      (
        normalized_category = 'all'
        OR lower(coalesce(c.tipo, '')) = normalized_category
        OR lower(coalesce(c.categoria, '')) = normalized_category
      )
      AND (
        (
          is_code_query
          AND (
            lower(coalesce(c.codigo_efisco, '')) LIKE '%' || normalized_query || '%'
            OR ts_rank_cd(
              to_tsvector('portuguese', coalesce(c.descricao, '')),
              query_terms
            ) > 0
          )
        )
        OR (
          NOT is_code_query
          AND (
            ts_rank_cd(
              to_tsvector('portuguese', coalesce(c.descricao, '')),
              query_terms
            ) > 0
            OR lower(coalesce(c.descricao, '')) LIKE '%' || normalized_query || '%'
            OR lower(coalesce(c.classe, '')) LIKE '%' || normalized_query || '%'
            OR lower(coalesce(c.grupo, '')) LIKE '%' || normalized_query || '%'
          )
        )
      )
  )
  SELECT
    s.id,
    s.codigo_efisco,
    s.descricao,
    s.tipo,
    s.categoria,
    s.grupo,
    s.classe,
    (
      (s.exact_code * 1.6)
      + (s.prefix_code * 0.8)
      + (s.phrase_desc * 0.35)
      + (s.taxonomy_match * 0.2)
      + (s.ts_rank * 0.55)
    )::REAL AS rank
  FROM scored s
  ORDER BY
    s.exact_code DESC,
    s.prefix_code DESC,
    s.phrase_desc DESC,
    s.ts_rank DESC,
    s.id ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;
