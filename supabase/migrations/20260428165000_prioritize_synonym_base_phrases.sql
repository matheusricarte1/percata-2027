-- Prioriza frases equivalentes no nome-base sem favorecer termos amplos demais.

INSERT INTO public.catalogo_search_synonyms (term_norm, expansion_norm)
VALUES
  ('ar condicionado', 'ar condicionado|condicionador de ar|equipamento condicionador|refrigeracao|climatizacao|climatizador'),
  ('condicionador', 'ar condicionado|condicionador de ar|equipamento condicionador|refrigeracao|climatizacao|climatizador'),
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
  phrase_parts AS (
    SELECT public.catalogo_normalize_text(regexp_split_to_table(expansion_norm, '\s*\|\s*')) AS part
    FROM matched_synonyms
  ),
  parts AS (
    SELECT part
    FROM phrase_parts
    UNION ALL
    SELECT regexp_split_to_table(part, '\s+') AS part
    FROM phrase_parts
    UNION ALL
    SELECT regexp_split_to_table((SELECT q FROM normalized), '\s+') AS part
  )
  SELECT coalesce(array_agg(DISTINCT part), ARRAY[]::TEXT[])
  FROM parts
  WHERE length(part) >= 3
    AND NOT part = ANY(public.catalogo_search_stopwords());
$$;

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
  normalized_query TEXT := public.catalogo_normalize_text(query_text);
  normalized_category TEXT := public.catalogo_normalize_text(categoria_filtro);
  code_query TEXT := regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9]', '', 'g');
  is_code_query BOOLEAN;
  returned_rows INTEGER := 0;
  terms tsquery;
  inferred_tipo TEXT := NULL;
  query_parts TEXT[] := ARRAY[]::TEXT[];
  expansion_parts TEXT[] := ARRAY[]::TEXT[];
  expansion_text TEXT := '';
BEGIN
  normalized_category := CASE
    WHEN normalized_category IN ('produto', 'produtos', 'material', 'materiais') THEN 'material'
    WHEN normalized_category IN ('servico', 'servicos') THEN 'servico'
    ELSE coalesce(nullif(normalized_category, ''), 'all')
  END;

  is_code_query := code_query <> '' AND code_query ~ '^[0-9]+$';

  SELECT coalesce(array_agg(term), ARRAY[]::TEXT[])
  INTO query_parts
  FROM regexp_split_to_table(normalized_query, '\s+') AS term
  WHERE length(term) >= 3
    AND NOT term = ANY(public.catalogo_search_stopwords());

  expansion_parts := public.catalogo_query_expansion_parts(query_text);
  expansion_text := array_to_string(ARRAY(SELECT unnest(expansion_parts)), ' ');

  IF expansion_text ~
    '(servico|locacao|arrendamento|manutencao|contratacao|assinatura|instalacao|transporte|desinfestacao|desinsetizacao|controle de pragas)'
  THEN
    inferred_tipo := 'SERVIÇO';
  ELSIF expansion_text ~
    '(material|equipamento|consumo|peca|mobiliario|medicamento|computador|notebook|microcomputador|condicionador de ar|equipamento condicionador)'
  THEN
    inferred_tipo := 'MATERIAL';
  END IF;

  IF normalized_query <> '' AND is_code_query THEN
    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
           c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
           c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
           c.gnd_preferencial, c.natureza_count, c.unidade_medida, 100::REAL
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND regexp_replace(lower(coalesce(c.codigo_efisco, '')), '[^a-z0-9]', '', 'g') = code_query
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
    LIMIT limit_val OFFSET offset_val;

    GET DIAGNOSTICS returned_rows = ROW_COUNT;
    IF returned_rows > 0 THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
           c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
           c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
           c.gnd_preferencial, c.natureza_count, c.unidade_medida, 80::REAL
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND regexp_replace(lower(coalesce(c.codigo_efisco, '')), '[^a-z0-9]', '', 'g') LIKE code_query || '%'
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
    ORDER BY c.codigo_efisco ASC
    LIMIT limit_val OFFSET offset_val;
    RETURN;
  END IF;

  IF normalized_query = '' THEN
    IF normalized_category = 'material' THEN
      RETURN QUERY
      SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
             c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
             c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
             c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL
      FROM public.catalogo c
      WHERE c.tipo_objeto = 'MATERIAL'
      ORDER BY c.id ASC
      LIMIT limit_val OFFSET offset_val;
    ELSIF normalized_category = 'servico' THEN
      RETURN QUERY
      SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
             c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
             c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
             c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL
      FROM public.catalogo c
      WHERE c.tipo_objeto = 'SERVIÇO'
      ORDER BY c.id ASC
      LIMIT limit_val OFFSET offset_val;
    ELSE
      RETURN QUERY
      SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
             c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
             c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
             c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL
      FROM public.catalogo c
      WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      ORDER BY c.tipo_objeto ASC, c.id ASC
      LIMIT limit_val OFFSET offset_val;
    END IF;
    RETURN;
  END IF;

  terms := public.catalogo_search_tsquery(query_text);

  IF terms IS NULL OR terms::TEXT = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.*,
      ts_rank_cd(c.search_vector, terms) AS fts_rank,
      CASE WHEN c.normalized_search_text LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS phrase_hit,
      CASE WHEN c.normalized_nome_base LIKE normalized_query || '%' THEN 1 ELSE 0 END AS base_prefix_hit,
      CASE WHEN c.normalized_nome_base LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS base_contains_hit,
      CASE
        WHEN cardinality(query_parts) > 0 AND NOT EXISTS (
          SELECT 1
          FROM unnest(query_parts) AS qp
          WHERE c.normalized_search_text NOT LIKE '%' || qp || '%'
        ) THEN 1
        ELSE 0
      END AS all_query_terms_hit,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(expansion_parts) AS ep
          WHERE length(ep) >= 4
            AND c.normalized_nome_base LIKE '%' || ep || '%'
        ) THEN 1
        ELSE 0
      END AS expansion_base_hit,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(expansion_parts) AS ep
          WHERE length(ep) >= 4
            AND c.normalized_search_text LIKE '%' || ep || '%'
        ) THEN 1
        ELSE 0
      END AS expansion_text_hit,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(expansion_parts) AS ep
          WHERE length(ep) >= 4
            AND position(' ' in ep) > 0
            AND ep <> normalized_query
            AND c.normalized_nome_base LIKE '%' || ep || '%'
        ) THEN 1
        ELSE 0
      END AS synonym_phrase_base_hit,
      CASE WHEN inferred_tipo IS NOT NULL AND c.tipo_objeto = inferred_tipo THEN 1 ELSE 0 END AS inferred_tipo_hit,
      CASE WHEN inferred_tipo IS NOT NULL AND c.tipo_objeto <> inferred_tipo THEN 1 ELSE 0 END AS inferred_tipo_miss
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND c.search_vector @@ terms
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
  )
  SELECT
    c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
    c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
    c.codigo_material_servico, c.nome_material_servico,
    c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count,
    c.unidade_medida,
    (
      (c.fts_rank * 12)
      + (c.phrase_hit * 46)
      + (c.base_prefix_hit * 42)
      + (c.base_contains_hit * 26)
      + (c.all_query_terms_hit * 18)
      + (c.expansion_base_hit * 20)
      + (c.synonym_phrase_base_hit * 98)
      + (c.expansion_text_hit * 8)
      + (c.inferred_tipo_hit * 14)
      - (c.inferred_tipo_miss * 44)
    )::REAL AS rank
  FROM candidates c
  ORDER BY
    (
      (c.fts_rank * 12)
      + (c.phrase_hit * 46)
      + (c.base_prefix_hit * 42)
      + (c.base_contains_hit * 26)
      + (c.all_query_terms_hit * 18)
      + (c.expansion_base_hit * 20)
      + (c.synonym_phrase_base_hit * 98)
      + (c.expansion_text_hit * 8)
      + (c.inferred_tipo_hit * 14)
      - (c.inferred_tipo_miss * 44)
    ) DESC,
    CASE WHEN inferred_tipo IS NOT NULL AND c.tipo_objeto = inferred_tipo THEN 0 ELSE 1 END,
    c.id ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
