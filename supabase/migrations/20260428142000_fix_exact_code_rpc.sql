-- Separa codigo exato de prefixo para garantir uso de indice e evitar timeout.

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
  returned_rows INTEGER := 0;
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
      c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
      c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
      c.codigo_material_servico, c.nome_material_servico,
      c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count,
      c.unidade_medida, 0::REAL AS rank
    FROM public.catalogo c
    WHERE
      normalized_category = 'all'
      OR CASE
        WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('serviço', 'servico') THEN 'servico'
        WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('material', 'produto') THEN 'material'
        ELSE lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, ''))
      END = normalized_category
    ORDER BY CASE WHEN c.codigo_efisco ~ '^[0-9]+-[0-9]+$' THEN 0 ELSE 1 END, c.id ASC
    LIMIT limit_val
    OFFSET offset_val;
    RETURN;
  END IF;

  IF is_code_query THEN
    RETURN QUERY
    SELECT
      c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
      c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
      c.codigo_material_servico, c.nome_material_servico,
      c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count,
      c.unidade_medida, 1.6::REAL AS rank
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) = normalized_query
      AND (
        normalized_category = 'all'
        OR CASE
          WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('serviço', 'servico') THEN 'servico'
          WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('material', 'produto') THEN 'material'
          ELSE lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, ''))
        END = normalized_category
      )
    LIMIT limit_val
    OFFSET offset_val;

    GET DIAGNOSTICS returned_rows = ROW_COUNT;
    IF returned_rows > 0 THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
      c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
      c.codigo_material_servico, c.nome_material_servico,
      c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count,
      c.unidade_medida, 0.8::REAL AS rank
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) LIKE normalized_query || '%'
      AND (
        normalized_category = 'all'
        OR CASE
          WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('serviço', 'servico') THEN 'servico'
          WHEN lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, '')) IN ('material', 'produto') THEN 'material'
          ELSE lower(coalesce(c.tipo_objeto, c.tipo, c.categoria, ''))
        END = normalized_category
      )
    ORDER BY c.codigo_efisco ASC
    LIMIT limit_val
    OFFSET offset_val;
    RETURN;
  END IF;

  query_terms := plainto_tsquery('portuguese', normalized_query);

  RETURN QUERY
  WITH scored AS (
    SELECT
      c.*,
      CASE WHEN lower(c.descricao) LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS phrase_desc,
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
        to_tsvector('portuguese', coalesce(c.descricao, '')) @@ query_terms
        OR lower(c.descricao) LIKE '%' || normalized_query || '%'
      )
  )
  SELECT
    s.id, s.codigo_efisco, s.descricao, s.tipo, s.categoria, s.grupo, s.classe,
    s.tipo_objeto, s.codigo_grupo, s.nome_grupo, s.codigo_classe, s.nome_classe,
    s.codigo_material_servico, s.nome_material_servico,
    s.codigo_natureza_preferencial, s.gnd_preferencial, s.natureza_count,
    s.unidade_medida, ((s.phrase_desc * 0.35) + (s.ts_rank * 0.55))::REAL AS rank
  FROM scored s
  ORDER BY s.phrase_desc DESC, s.ts_rank DESC, s.id ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
