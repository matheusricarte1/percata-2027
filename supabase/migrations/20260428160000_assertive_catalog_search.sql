-- Busca assertiva: normalizacao, sinonimos, nome-base e ranking hibrido.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

ALTER TABLE public.catalogo
  ADD COLUMN IF NOT EXISTS normalized_search_text TEXT,
  ADD COLUMN IF NOT EXISTS normalized_nome_base TEXT;

CREATE TABLE IF NOT EXISTS public.catalogo_search_synonyms (
  term_norm TEXT PRIMARY KEY,
  expansion_norm TEXT NOT NULL
);

INSERT INTO public.catalogo_search_synonyms (term_norm, expansion_norm)
VALUES
  ('aluguel', 'locacao'),
  ('alugar', 'locacao'),
  ('imóvel', 'imovel'),
  ('imoveis', 'imovel'),
  ('predial', 'imovel predio'),
  ('notebook', 'computador portatil laptop'),
  ('laptop', 'notebook computador portatil'),
  ('ar condicionado', 'condicionador ar climatizador'),
  ('climatizador', 'ar condicionado condicionador'),
  ('dedetizacao', 'desinsetizacao controle pragas'),
  ('dedetização', 'desinsetizacao controle pragas'),
  ('internet', 'link dados telecomunicacao rede'),
  ('wifi', 'wireless rede internet'),
  ('limpeza', 'higienizacao conservacao asseio'),
  ('manutencao', 'reparo conservacao assistencia tecnica'),
  ('manutenção', 'reparo conservacao assistencia tecnica'),
  ('veiculo', 'automovel carro transporte'),
  ('veículo', 'automovel carro transporte'),
  ('agua', 'agua potavel'),
  ('água', 'agua potavel'),
  ('refeicao', 'alimentacao marmita'),
  ('refeição', 'alimentacao marmita'),
  ('passagem', 'passagem aerea terrestre transporte'),
  ('software', 'licenca sistema aplicativo'),
  ('licença', 'licenca software sistema'),
  ('serviço', 'servico'),
  ('servicos', 'servico'),
  ('materiais', 'material')
ON CONFLICT (term_norm)
DO UPDATE SET expansion_norm = EXCLUDED.expansion_norm;

CREATE OR REPLACE FUNCTION public.catalogo_normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(public.unaccent(coalesce(input_text, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.catalogo_build_normalized_search_text(
  descricao TEXT,
  classe TEXT,
  nome_classe TEXT,
  grupo TEXT,
  nome_grupo TEXT,
  categoria TEXT,
  nome_material_servico TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT public.catalogo_normalize_text(concat_ws(
    ' ',
    descricao,
    descricao,
    nome_material_servico,
    nome_material_servico,
    classe,
    nome_classe,
    grupo,
    nome_grupo,
    categoria
  ));
$$;

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
STABLE
AS $$
  SELECT
    setweight(to_tsvector('portuguese', public.catalogo_normalize_text(coalesce(descricao, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.catalogo_normalize_text(coalesce(nome_material_servico, ''))), 'A') ||
    setweight(to_tsvector('portuguese', public.catalogo_normalize_text(coalesce(classe, '') || ' ' || coalesce(nome_classe, ''))), 'B') ||
    setweight(to_tsvector('portuguese', public.catalogo_normalize_text(coalesce(grupo, '') || ' ' || coalesce(nome_grupo, '') || ' ' || coalesce(categoria, ''))), 'C');
$$;

CREATE OR REPLACE FUNCTION public.catalogo_set_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.normalized_search_text := public.catalogo_build_normalized_search_text(
    NEW.descricao,
    NEW.classe,
    NEW.nome_classe,
    NEW.grupo,
    NEW.nome_grupo,
    NEW.categoria,
    NEW.nome_material_servico
  );
  NEW.normalized_nome_base := public.catalogo_normalize_text(split_part(coalesce(NEW.descricao, ''), '-', 1));
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

CREATE INDEX IF NOT EXISTS idx_catalogo_normalized_nome_base
  ON public.catalogo (normalized_nome_base);

CREATE INDEX IF NOT EXISTS idx_catalogo_tipo_search_id
  ON public.catalogo (tipo_objeto, id);

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
  expanded_query TEXT;
  is_code_query BOOLEAN;
  returned_rows INTEGER := 0;
  terms tsquery;
  inferred_tipo TEXT := NULL;
BEGIN
  normalized_category := CASE
    WHEN normalized_category IN ('produto', 'produtos', 'material', 'materiais') THEN 'material'
    WHEN normalized_category IN ('servico', 'servicos', 'servicos') THEN 'servico'
    ELSE coalesce(nullif(normalized_category, ''), 'all')
  END;
  is_code_query := normalized_query ~ '[0-9]' AND normalized_query ~ '^[a-z0-9.\-_/ ]+$' AND position(' ' in normalized_query) = 0;

  SELECT trim(concat_ws(' ', normalized_query, string_agg(s.expansion_norm, ' ')))
  INTO expanded_query
  FROM public.catalogo_search_synonyms s
  WHERE normalized_query LIKE '%' || public.catalogo_normalize_text(s.term_norm) || '%';
  expanded_query := coalesce(nullif(expanded_query, ''), normalized_query);

  IF expanded_query ~ '(servico|locacao|manutencao|contratacao|assinatura|instalacao|fornecimento|transporte)' THEN
    inferred_tipo := 'SERVIÇO';
  ELSIF expanded_query ~ '(material|equipamento|consumo|peca|mobiliario|medicamento|computador|notebook)' THEN
    inferred_tipo := 'MATERIAL';
  END IF;

  IF normalized_query <> '' AND is_code_query THEN
    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 100::REAL
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) = normalized_query
      AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
    LIMIT limit_val OFFSET offset_val;
    GET DIAGNOSTICS returned_rows = ROW_COUNT;
    IF returned_rows > 0 THEN RETURN; END IF;

    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 80::REAL
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

  terms := websearch_to_tsquery('portuguese', expanded_query);

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.*,
      ts_rank_cd(c.search_vector, terms) AS fts_rank,
      CASE WHEN c.normalized_search_text LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS phrase_hit,
      CASE WHEN c.normalized_nome_base LIKE normalized_query || '%' THEN 1 ELSE 0 END AS base_prefix_hit,
      CASE WHEN c.normalized_nome_base LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS base_contains_hit,
      CASE WHEN inferred_tipo IS NOT NULL AND c.tipo_objeto = inferred_tipo THEN 1 ELSE 0 END AS inferred_tipo_hit
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND c.search_vector @@ terms
      AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
  )
  SELECT
    c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
    c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
    c.codigo_material_servico, c.nome_material_servico,
    c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count,
    c.unidade_medida,
    (
      (c.fts_rank * 12)
      + (c.phrase_hit * 35)
      + (c.base_prefix_hit * 30)
      + (c.base_contains_hit * 16)
      + (c.inferred_tipo_hit * 8)
    )::REAL AS rank
  FROM candidates c
  ORDER BY
    (
      (c.fts_rank * 12)
      + (c.phrase_hit * 35)
      + (c.base_prefix_hit * 30)
      + (c.base_contains_hit * 16)
      + (c.inferred_tipo_hit * 8)
    ) DESC,
    c.id ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
