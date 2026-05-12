-- Busca full-text real para o catalogo e-Fisco.

ALTER TABLE public.catalogo
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.catalogo_build_search_vector(
  descricao TEXT,
  classe TEXT,
  nome_classe TEXT,
  grupo TEXT,
  nome_grupo TEXT,
  categoria TEXT,
  nome_material_servico TEXT
)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    setweight(to_tsvector('portuguese', coalesce(descricao, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(nome_material_servico, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(classe, '') || ' ' || coalesce(nome_classe, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(grupo, '') || ' ' || coalesce(nome_grupo, '') || ' ' || coalesce(categoria, '')), 'C');
$$;

CREATE OR REPLACE FUNCTION public.catalogo_set_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector := public.catalogo_build_search_vector(
    NEW.descricao,
    NEW.classe,
    NEW.nome_classe,
    NEW.grupo,
    NEW.nome_grupo,
    NEW.categoria,
    NEW.nome_material_servico
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalogo_search_vector ON public.catalogo;
CREATE TRIGGER trg_catalogo_search_vector
BEFORE INSERT OR UPDATE OF descricao, classe, nome_classe, grupo, nome_grupo, categoria, nome_material_servico
ON public.catalogo
FOR EACH ROW
EXECUTE FUNCTION public.catalogo_set_search_vector();

CREATE INDEX IF NOT EXISTS idx_catalogo_search_vector
  ON public.catalogo USING gin (search_vector);

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
  returned_rows INTEGER := 0;
  terms tsquery;
BEGIN
  normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
  normalized_category := CASE
    WHEN normalized_category IN ('produto', 'produtos', 'material', 'materiais') THEN 'material'
    WHEN normalized_category IN ('servico', 'servicos', 'serviço', 'serviços') THEN 'servico'
    ELSE normalized_category
  END;
  is_code_query := normalized_query ~ '[0-9]' AND normalized_query ~ '^[a-z0-9.\-_/]+$' AND position(' ' in normalized_query) = 0;

  IF normalized_query <> '' AND is_code_query THEN
    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 1.6::REAL
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) = normalized_query
      AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
    LIMIT limit_val OFFSET offset_val;

    GET DIAGNOSTICS returned_rows = ROW_COUNT;
    IF returned_rows > 0 THEN RETURN; END IF;

    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0.8::REAL
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) LIKE normalized_query || '%'
      AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
    ORDER BY c.codigo_efisco ASC
    LIMIT limit_val OFFSET offset_val;
    RETURN;
  END IF;

  IF normalized_query = '' THEN
    IF normalized_category = 'material' THEN
      RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL FROM public.catalogo c WHERE c.tipo_objeto = 'MATERIAL' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
    ELSIF normalized_category = 'servico' THEN
      RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL FROM public.catalogo c WHERE c.tipo_objeto = 'SERVIÇO' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
    ELSE
      RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL FROM public.catalogo c WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO') ORDER BY c.tipo_objeto ASC, c.id ASC LIMIT limit_val OFFSET offset_val;
    END IF;
    RETURN;
  END IF;

  terms := plainto_tsquery('portuguese', normalized_query);

  RETURN QUERY
  SELECT
    c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
    c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
    c.codigo_material_servico, c.nome_material_servico,
    c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count,
    c.unidade_medida,
    ts_rank_cd(c.search_vector, terms)::REAL AS rank
  FROM public.catalogo c
  WHERE c.search_vector @@ terms
    AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
  ORDER BY ts_rank_cd(c.search_vector, terms) DESC, c.id ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
