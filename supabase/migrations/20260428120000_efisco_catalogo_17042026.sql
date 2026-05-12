-- Suporte ao catalogo e-Fisco 17/04/2026.
-- Mantem as colunas legadas usadas pelo app e acrescenta o snapshot fiscal
-- necessario para DFDs e consolidacao.

ALTER TABLE public.catalogo
  ADD COLUMN IF NOT EXISTS tipo_objeto TEXT,
  ADD COLUMN IF NOT EXISTS codigo_grupo TEXT,
  ADD COLUMN IF NOT EXISTS nome_grupo TEXT,
  ADD COLUMN IF NOT EXISTS descricao_grupo TEXT,
  ADD COLUMN IF NOT EXISTS situacao_grupo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_classe TEXT,
  ADD COLUMN IF NOT EXISTS nome_classe TEXT,
  ADD COLUMN IF NOT EXISTS descricao_classe TEXT,
  ADD COLUMN IF NOT EXISTS situacao_classe TEXT,
  ADD COLUMN IF NOT EXISTS codigo_material_servico TEXT,
  ADD COLUMN IF NOT EXISTS nome_material_servico TEXT,
  ADD COLUMN IF NOT EXISTS situacao_material_servico TEXT,
  ADD COLUMN IF NOT EXISTS data_inclusao_item TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS situacao_item TEXT,
  ADD COLUMN IF NOT EXISTS codigo_natureza_preferencial TEXT,
  ADD COLUMN IF NOT EXISTS gnd_preferencial TEXT,
  ADD COLUMN IF NOT EXISTS natureza_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidade_medida TEXT;

CREATE TABLE IF NOT EXISTS public.catalogo_item_naturezas (
  id BIGSERIAL PRIMARY KEY,
  catalogo_id BIGINT REFERENCES public.catalogo(id) ON DELETE CASCADE,
  codigo_item TEXT NOT NULL,
  codigo_natureza_despesa TEXT,
  natureza_key TEXT NOT NULL,
  gnd TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codigo_item, natureza_key)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_item_naturezas_codigo_item
  ON public.catalogo_item_naturezas (codigo_item);

CREATE INDEX IF NOT EXISTS idx_catalogo_item_naturezas_catalogo_id
  ON public.catalogo_item_naturezas (catalogo_id);

CREATE INDEX IF NOT EXISTS idx_catalogo_item_naturezas_natureza
  ON public.catalogo_item_naturezas (codigo_natureza_despesa);

ALTER TABLE public.catalogo_item_naturezas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_item_naturezas_select_authenticated
  ON public.catalogo_item_naturezas;

CREATE POLICY catalogo_item_naturezas_select_authenticated
ON public.catalogo_item_naturezas
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_catalogo_tipo_objeto
  ON public.catalogo (tipo_objeto);

CREATE INDEX IF NOT EXISTS idx_catalogo_codigo_classe
  ON public.catalogo (codigo_classe);

ALTER TABLE public.dfd_items
  ADD COLUMN IF NOT EXISTS codigo_item_efisco TEXT,
  ADD COLUMN IF NOT EXISTS tipo_objeto TEXT,
  ADD COLUMN IF NOT EXISTS codigo_grupo TEXT,
  ADD COLUMN IF NOT EXISTS nome_grupo TEXT,
  ADD COLUMN IF NOT EXISTS codigo_classe TEXT,
  ADD COLUMN IF NOT EXISTS nome_classe TEXT,
  ADD COLUMN IF NOT EXISTS codigo_material_servico TEXT,
  ADD COLUMN IF NOT EXISTS nome_material_servico TEXT,
  ADD COLUMN IF NOT EXISTS codigo_natureza_despesa TEXT,
  ADD COLUMN IF NOT EXISTS gnd_derivado TEXT;

UPDATE public.dfd_items
SET codigo_item_efisco = COALESCE(codigo_item_efisco, codigo_tce)
WHERE codigo_item_efisco IS NULL;

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
  tipo_objeto TEXT,
  codigo_grupo TEXT,
  nome_grupo TEXT,
  codigo_classe TEXT,
  nome_classe TEXT,
  codigo_material_servico TEXT,
  nome_material_servico TEXT,
  codigo_natureza_preferencial TEXT,
  gnd_preferencial TEXT,
  natureza_count INTEGER,
  unidade_medida TEXT,
  rank REAL
) AS $$
DECLARE
  normalized_query TEXT := trim(lower(coalesce(query_text, '')));
  normalized_category TEXT := trim(lower(coalesce(categoria_filtro, 'all')));
  is_code_query BOOLEAN;
  query_terms TSQUERY;
BEGIN
  normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
  normalized_category := CASE
    WHEN normalized_category IN ('produto', 'produtos', 'material', 'materiais') THEN 'material'
    WHEN normalized_category IN ('servico', 'servicos', 'serviço', 'serviços') THEN 'servico'
    ELSE normalized_category
  END;
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
      c.tipo_objeto,
      c.codigo_grupo,
      c.nome_grupo,
      c.codigo_classe,
      c.nome_classe,
      c.codigo_material_servico,
      c.nome_material_servico,
      c.codigo_natureza_preferencial,
      c.gnd_preferencial,
      c.natureza_count,
      c.unidade_medida,
      0::REAL AS rank
    FROM public.catalogo c
    WHERE
      normalized_category = 'all'
      OR CASE
        WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('serviço', 'servico') THEN 'servico'
        WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('material', 'produto') THEN 'material'
        ELSE lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, ''))
      END = normalized_category
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
      CASE WHEN lower(coalesce(c.codigo_efisco, '')) = normalized_query THEN 1 ELSE 0 END AS exact_code,
      CASE WHEN lower(coalesce(c.codigo_efisco, '')) LIKE normalized_query || '%' THEN 1 ELSE 0 END AS prefix_code,
      CASE WHEN lower(coalesce(c.descricao, '')) LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS phrase_desc,
      CASE
        WHEN lower(coalesce(c.classe, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(c.nome_classe, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(c.grupo, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(c.nome_grupo, '')) LIKE '%' || normalized_query || '%'
          OR lower(coalesce(c.categoria, '')) LIKE '%' || normalized_query || '%'
        THEN 1
        ELSE 0
      END AS taxonomy_match,
      ts_rank_cd(to_tsvector('portuguese', coalesce(c.descricao, '')), query_terms) AS ts_rank
    FROM public.catalogo c
    WHERE
      (
        normalized_category = 'all'
        OR CASE
          WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('serviço', 'servico') THEN 'servico'
          WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('material', 'produto') THEN 'material'
          ELSE lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, ''))
        END = normalized_category
      )
      AND (
        (
          is_code_query
          AND (
            lower(coalesce(c.codigo_efisco, '')) LIKE '%' || normalized_query || '%'
            OR ts_rank_cd(to_tsvector('portuguese', coalesce(c.descricao, '')), query_terms) > 0
          )
        )
        OR (
          NOT is_code_query
          AND (
            ts_rank_cd(to_tsvector('portuguese', coalesce(c.descricao, '')), query_terms) > 0
            OR lower(coalesce(c.descricao, '')) LIKE '%' || normalized_query || '%'
            OR lower(coalesce(c.classe, '')) LIKE '%' || normalized_query || '%'
            OR lower(coalesce(c.nome_classe, '')) LIKE '%' || normalized_query || '%'
            OR lower(coalesce(c.grupo, '')) LIKE '%' || normalized_query || '%'
            OR lower(coalesce(c.nome_grupo, '')) LIKE '%' || normalized_query || '%'
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
    s.tipo_objeto,
    s.codigo_grupo,
    s.nome_grupo,
    s.codigo_classe,
    s.nome_classe,
    s.codigo_material_servico,
    s.nome_material_servico,
    s.codigo_natureza_preferencial,
    s.gnd_preferencial,
    s.natureza_count,
    s.unidade_medida,
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

NOTIFY pgrst, 'reload schema';
