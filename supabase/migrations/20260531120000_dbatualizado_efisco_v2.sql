-- DBAtualizado.csv normalized e-Fisco catalog v2.
-- Generated from projeto_dbatualizado_efisco/sql after profiling DBAtualizado.csv.
-- Supabase CLI is not available in this environment, so this migration was created as a checked-in SQL file.


-- ============================================================
-- Source: projeto_dbatualizado_efisco/sql/001_foundation_schema.sql
-- ============================================================
-- Foundation schema for DBAtualizado.csv.
-- Apply in local/staging first. This file creates isolated schemas and does
-- not drop the current public.catalogo implementation.

CREATE SCHEMA IF NOT EXISTS efisco_raw;
CREATE SCHEMA IF NOT EXISTS efisco_core;

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS efisco_raw.ingestion_batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_file_name TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL,
  loaded_by UUID,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS efisco_raw.db_atualizado_rows (
  batch_id BIGINT NOT NULL REFERENCES efisco_raw.ingestion_batches(id) ON DELETE CASCADE,
  source_line_no INTEGER NOT NULL,
  row_hash TEXT NOT NULL,
  codigo_grupo TEXT,
  nome_grupo TEXT,
  descricao_grupo TEXT,
  situacao_grupo TEXT,
  codigo_classe TEXT,
  nome_classe TEXT,
  descricao_classe TEXT,
  situacao_classe TEXT,
  codigo_material_servico TEXT,
  nome_material_servico TEXT,
  situacao_material_servico TEXT,
  tipo_objeto TEXT,
  codigo_item TEXT,
  nome_item TEXT,
  data_inclusao_item_text TEXT,
  situacao_item TEXT,
  codigo_natureza_despesa TEXT,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, source_line_no),
  UNIQUE (batch_id, row_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_db_atualizado_codigo_item
  ON efisco_raw.db_atualizado_rows (codigo_item);

CREATE INDEX IF NOT EXISTS idx_raw_db_atualizado_natureza
  ON efisco_raw.db_atualizado_rows (codigo_natureza_despesa);

CREATE TABLE IF NOT EXISTS efisco_core.grupos (
  codigo_grupo TEXT PRIMARY KEY,
  nome_grupo TEXT NOT NULL,
  descricao_grupo TEXT,
  situacao_grupo TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (codigo_grupo ~ '^[0-9]{2}$')
);

CREATE TABLE IF NOT EXISTS efisco_core.classes (
  codigo_classe TEXT PRIMARY KEY,
  codigo_grupo TEXT NOT NULL REFERENCES efisco_core.grupos(codigo_grupo),
  nome_classe TEXT NOT NULL,
  descricao_classe TEXT,
  situacao_classe TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (codigo_classe ~ '^[0-9]{4}$')
);

CREATE TABLE IF NOT EXISTS efisco_core.materiais_servicos (
  codigo_material_servico TEXT PRIMARY KEY,
  codigo_classe TEXT NOT NULL REFERENCES efisco_core.classes(codigo_classe),
  nome_material_servico TEXT NOT NULL,
  situacao_material_servico TEXT,
  tipo_objeto TEXT NOT NULL CHECK (tipo_objeto IN ('MATERIAL', 'SERVIÇO')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS efisco_core.itens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_item TEXT NOT NULL UNIQUE,
  codigo_material_servico TEXT NOT NULL REFERENCES efisco_core.materiais_servicos(codigo_material_servico),
  nome_item TEXT NOT NULL,
  nome_item_base TEXT,
  especificacao_item TEXT,
  tipo_objeto TEXT NOT NULL CHECK (tipo_objeto IN ('MATERIAL', 'SERVIÇO')),
  data_inclusao_item TIMESTAMPTZ,
  situacao_item TEXT,
  natureza_count INTEGER NOT NULL DEFAULT 0,
  has_mixed_expense_classes BOOLEAN NOT NULL DEFAULT false,
  has_missing_natureza BOOLEAN NOT NULL DEFAULT false,
  source_batch_id BIGINT REFERENCES efisco_raw.ingestion_batches(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (codigo_item ~ '^[0-9]+-[0-9]+$')
);

CREATE TABLE IF NOT EXISTS efisco_core.naturezas_despesa (
  codigo_natureza_despesa TEXT PRIMARY KEY,
  gnd TEXT NOT NULL,
  classe_despesa TEXT NOT NULL CHECK (classe_despesa IN ('custeio', 'investimento', 'outra')),
  elemento_despesa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (codigo_natureza_despesa ~ '^[0-9]{8}$')
);

CREATE TABLE IF NOT EXISTS efisco_core.item_naturezas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES efisco_core.itens(id) ON DELETE CASCADE,
  codigo_item TEXT NOT NULL,
  codigo_natureza_despesa TEXT REFERENCES efisco_core.naturezas_despesa(codigo_natureza_despesa),
  natureza_key TEXT NOT NULL,
  gnd TEXT,
  classe_despesa TEXT NOT NULL CHECK (classe_despesa IN ('custeio', 'investimento', 'outra', 'sem_natureza')),
  source_batch_id BIGINT REFERENCES efisco_raw.ingestion_batches(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codigo_item, natureza_key),
  UNIQUE (item_id, natureza_key),
  CHECK (
    codigo_natureza_despesa IS NULL
    OR natureza_key = codigo_natureza_despesa
  )
);

CREATE INDEX IF NOT EXISTS idx_core_classes_grupo
  ON efisco_core.classes (codigo_grupo);

CREATE INDEX IF NOT EXISTS idx_core_materiais_classe
  ON efisco_core.materiais_servicos (codigo_classe);

CREATE INDEX IF NOT EXISTS idx_core_itens_material
  ON efisco_core.itens (codigo_material_servico);

CREATE INDEX IF NOT EXISTS idx_core_itens_tipo_id
  ON efisco_core.itens (tipo_objeto, id);

CREATE INDEX IF NOT EXISTS idx_core_itens_mixed
  ON efisco_core.itens (has_mixed_expense_classes)
  WHERE has_mixed_expense_classes;

CREATE INDEX IF NOT EXISTS idx_core_item_naturezas_item
  ON efisco_core.item_naturezas (item_id);

CREATE INDEX IF NOT EXISTS idx_core_item_naturezas_codigo_item
  ON efisco_core.item_naturezas (codigo_item);

CREATE INDEX IF NOT EXISTS idx_core_item_naturezas_natureza_item
  ON efisco_core.item_naturezas (codigo_natureza_despesa, item_id)
  WHERE codigo_natureza_despesa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_core_item_naturezas_gnd_item
  ON efisco_core.item_naturezas (gnd, item_id)
  WHERE gnd IS NOT NULL;

ALTER TABLE efisco_raw.ingestion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_raw.db_atualizado_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_core.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_core.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_core.materiais_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_core.itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_core.naturezas_despesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE efisco_core.item_naturezas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS efisco_grupos_select_authenticated ON efisco_core.grupos;
CREATE POLICY efisco_grupos_select_authenticated
ON efisco_core.grupos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS efisco_classes_select_authenticated ON efisco_core.classes;
CREATE POLICY efisco_classes_select_authenticated
ON efisco_core.classes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS efisco_materiais_select_authenticated ON efisco_core.materiais_servicos;
CREATE POLICY efisco_materiais_select_authenticated
ON efisco_core.materiais_servicos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS efisco_itens_select_authenticated ON efisco_core.itens;
CREATE POLICY efisco_itens_select_authenticated
ON efisco_core.itens FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS efisco_naturezas_select_authenticated ON efisco_core.naturezas_despesa;
CREATE POLICY efisco_naturezas_select_authenticated
ON efisco_core.naturezas_despesa FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS efisco_item_naturezas_select_authenticated ON efisco_core.item_naturezas;
CREATE POLICY efisco_item_naturezas_select_authenticated
ON efisco_core.item_naturezas FOR SELECT TO authenticated USING (true);

GRANT USAGE ON SCHEMA efisco_raw, efisco_core TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA efisco_core TO authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA efisco_raw, efisco_core TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA efisco_raw, efisco_core TO service_role;

-- ============================================================
-- Source: projeto_dbatualizado_efisco/sql/002_search_layer.sql
-- ============================================================
-- Search layer for efficient catalog queries.

CREATE SCHEMA IF NOT EXISTS efisco_search;

CREATE OR REPLACE FUNCTION efisco_search.normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(unaccent(coalesce(input_text, ''))), '([0-9]),([0-9])', '\1.\2', 'g'),
      '[^a-z0-9.]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

CREATE TABLE IF NOT EXISTS efisco_search.catalogo_documents (
  id BIGINT PRIMARY KEY,
  codigo_item TEXT NOT NULL UNIQUE,
  codigo_material_servico TEXT NOT NULL,
  nome_item TEXT NOT NULL,
  nome_item_base TEXT,
  especificacao_item TEXT,
  tipo_objeto TEXT NOT NULL,
  codigo_grupo TEXT NOT NULL,
  nome_grupo TEXT NOT NULL,
  codigo_classe TEXT NOT NULL,
  nome_classe TEXT NOT NULL,
  nome_material_servico TEXT NOT NULL,
  naturezas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  gnds TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  natureza_count INTEGER NOT NULL DEFAULT 0,
  has_mixed_expense_classes BOOLEAN NOT NULL DEFAULT false,
  has_missing_natureza BOOLEAN NOT NULL DEFAULT false,
  normalized_search_text TEXT NOT NULL,
  search_vector TSVECTOR NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_vector
  ON efisco_search.catalogo_documents USING gin (search_vector);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_trgm
  ON efisco_search.catalogo_documents USING gin (normalized_search_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_tipo_id
  ON efisco_search.catalogo_documents (tipo_objeto, id);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_codigo_item
  ON efisco_search.catalogo_documents (codigo_item);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_natureza_count
  ON efisco_search.catalogo_documents (natureza_count DESC);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_mixed
  ON efisco_search.catalogo_documents (has_mixed_expense_classes)
  WHERE has_mixed_expense_classes;

CREATE OR REPLACE FUNCTION efisco_search.refresh_catalogo_documents()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, efisco_core, efisco_search, pg_temp
AS $$
BEGIN
  INSERT INTO efisco_search.catalogo_documents (
    id,
    codigo_item,
    codigo_material_servico,
    nome_item,
    nome_item_base,
    especificacao_item,
    tipo_objeto,
    codigo_grupo,
    nome_grupo,
    codigo_classe,
    nome_classe,
    nome_material_servico,
    naturezas,
    gnds,
    natureza_count,
    has_mixed_expense_classes,
    has_missing_natureza,
    normalized_search_text,
    search_vector,
    refreshed_at
  )
  SELECT
    i.id,
    i.codigo_item,
    i.codigo_material_servico,
    i.nome_item,
    i.nome_item_base,
    i.especificacao_item,
    i.tipo_objeto,
    g.codigo_grupo,
    g.nome_grupo,
    c.codigo_classe,
    c.nome_classe,
    ms.nome_material_servico,
    coalesce(array_agg(DISTINCT inat.codigo_natureza_despesa) FILTER (WHERE inat.codigo_natureza_despesa IS NOT NULL), ARRAY[]::TEXT[]),
    coalesce(array_agg(DISTINCT inat.gnd) FILTER (WHERE inat.gnd IS NOT NULL), ARRAY[]::TEXT[]),
    i.natureza_count,
    i.has_mixed_expense_classes,
    i.has_missing_natureza,
    efisco_search.normalize_text(concat_ws(' ', i.codigo_item, i.nome_item, ms.nome_material_servico, c.nome_classe, g.nome_grupo, i.tipo_objeto)),
    (
      setweight(to_tsvector('portuguese', efisco_search.normalize_text(i.nome_item)), 'A') ||
      setweight(to_tsvector('portuguese', efisco_search.normalize_text(ms.nome_material_servico)), 'A') ||
      setweight(to_tsvector('portuguese', efisco_search.normalize_text(c.nome_classe)), 'B') ||
      setweight(to_tsvector('portuguese', efisco_search.normalize_text(g.nome_grupo || ' ' || i.tipo_objeto)), 'C')
    ),
    now()
  FROM efisco_core.itens i
  JOIN efisco_core.materiais_servicos ms ON ms.codigo_material_servico = i.codigo_material_servico
  JOIN efisco_core.classes c ON c.codigo_classe = ms.codigo_classe
  JOIN efisco_core.grupos g ON g.codigo_grupo = c.codigo_grupo
  LEFT JOIN efisco_core.item_naturezas inat ON inat.item_id = i.id
  GROUP BY i.id, ms.codigo_material_servico, ms.nome_material_servico, c.codigo_classe, c.nome_classe, g.codigo_grupo, g.nome_grupo
  ON CONFLICT (id) DO UPDATE SET
    nome_item = EXCLUDED.nome_item,
    nome_item_base = EXCLUDED.nome_item_base,
    especificacao_item = EXCLUDED.especificacao_item,
    tipo_objeto = EXCLUDED.tipo_objeto,
    codigo_grupo = EXCLUDED.codigo_grupo,
    nome_grupo = EXCLUDED.nome_grupo,
    codigo_classe = EXCLUDED.codigo_classe,
    nome_classe = EXCLUDED.nome_classe,
    nome_material_servico = EXCLUDED.nome_material_servico,
    naturezas = EXCLUDED.naturezas,
    gnds = EXCLUDED.gnds,
    natureza_count = EXCLUDED.natureza_count,
    has_mixed_expense_classes = EXCLUDED.has_mixed_expense_classes,
    has_missing_natureza = EXCLUDED.has_missing_natureza,
    normalized_search_text = EXCLUDED.normalized_search_text,
    search_vector = EXCLUDED.search_vector,
    refreshed_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION efisco_search.buscar_catalogo_efisco_v2(
  query_text TEXT,
  categoria_filtro TEXT DEFAULT 'all',
  limit_val INTEGER DEFAULT 30,
  after_id BIGINT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  codigo_item TEXT,
  descricao TEXT,
  tipo_objeto TEXT,
  codigo_grupo TEXT,
  nome_grupo TEXT,
  codigo_classe TEXT,
  nome_classe TEXT,
  codigo_material_servico TEXT,
  nome_material_servico TEXT,
  natureza_count INTEGER,
  has_mixed_expense_classes BOOLEAN,
  gnds TEXT[],
  rank REAL
)
LANGUAGE plpgsql
STABLE
SET search_path = public, efisco_search, pg_temp
AS $$
DECLARE
  q TEXT := efisco_search.normalize_text(query_text);
  category TEXT := efisco_search.normalize_text(categoria_filtro);
  tsq TSQUERY;
BEGIN
  category := CASE
    WHEN category IN ('material', 'materiais', 'produto', 'produtos') THEN 'MATERIAL'
    WHEN category IN ('servico', 'servicos', 'serviço', 'serviços') THEN 'SERVIÇO'
    ELSE 'all'
  END;

  IF q = '' THEN
    RETURN QUERY
    SELECT d.id, d.codigo_item, d.nome_item, d.tipo_objeto, d.codigo_grupo, d.nome_grupo,
           d.codigo_classe, d.nome_classe, d.codigo_material_servico, d.nome_material_servico,
           d.natureza_count, d.has_mixed_expense_classes, d.gnds, 0::REAL
    FROM efisco_search.catalogo_documents d
    WHERE d.id > coalesce(after_id, 0)
      AND (category = 'all' OR d.tipo_objeto = category)
    ORDER BY d.id
    LIMIT least(greatest(limit_val, 1), 50);
    RETURN;
  END IF;

  IF q ~ '^[0-9]+[-]?[0-9]*$' THEN
    RETURN QUERY
    SELECT d.id, d.codigo_item, d.nome_item, d.tipo_objeto, d.codigo_grupo, d.nome_grupo,
           d.codigo_classe, d.nome_classe, d.codigo_material_servico, d.nome_material_servico,
           d.natureza_count, d.has_mixed_expense_classes, d.gnds,
           CASE WHEN d.codigo_item = query_text THEN 100 ELSE 80 END::REAL
    FROM efisco_search.catalogo_documents d
    WHERE (d.codigo_item = query_text OR d.codigo_item LIKE query_text || '%')
      AND (category = 'all' OR d.tipo_objeto = category)
    ORDER BY CASE WHEN d.codigo_item = query_text THEN 0 ELSE 1 END, d.codigo_item
    LIMIT least(greatest(limit_val, 1), 50);
    RETURN;
  END IF;

  tsq := websearch_to_tsquery('portuguese', q);

  RETURN QUERY
  SELECT d.id, d.codigo_item, d.nome_item, d.tipo_objeto, d.codigo_grupo, d.nome_grupo,
         d.codigo_classe, d.nome_classe, d.codigo_material_servico, d.nome_material_servico,
         d.natureza_count, d.has_mixed_expense_classes, d.gnds,
         (
           ts_rank_cd(d.search_vector, tsq) * 20
           + CASE WHEN d.normalized_search_text LIKE '%' || q || '%' THEN 30 ELSE 0 END
           + CASE WHEN d.nome_item_base IS NOT NULL AND efisco_search.normalize_text(d.nome_item_base) LIKE q || '%' THEN 20 ELSE 0 END
         )::REAL AS rank
  FROM efisco_search.catalogo_documents d
  WHERE d.search_vector @@ tsq
    AND (category = 'all' OR d.tipo_objeto = category)
  ORDER BY rank DESC, d.id
  LIMIT least(greatest(limit_val, 1), 50);
END;
$$;

ALTER TABLE efisco_search.catalogo_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_documents_select_authenticated
ON efisco_search.catalogo_documents;

CREATE POLICY catalogo_documents_select_authenticated
ON efisco_search.catalogo_documents
FOR SELECT TO authenticated
USING (true);

GRANT USAGE ON SCHEMA efisco_search TO authenticated, service_role;
GRANT SELECT ON efisco_search.catalogo_documents TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION efisco_search.buscar_catalogo_efisco_v2(TEXT, TEXT, INTEGER, BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION efisco_search.refresh_catalogo_documents() TO service_role;

-- ============================================================
-- Source: projeto_dbatualizado_efisco/sql/003_analytics_marts.sql
-- ============================================================
-- Analytics marts for planning and data quality.

CREATE SCHEMA IF NOT EXISTS efisco_analytics;

CREATE MATERIALIZED VIEW IF NOT EXISTS efisco_analytics.mv_efisco_quality_overview AS
SELECT
  count(*) FILTER (WHERE i.has_missing_natureza) AS itens_com_natureza_ausente,
  count(*) FILTER (WHERE i.has_mixed_expense_classes) AS itens_misturam_custeio_investimento,
  count(*) FILTER (WHERE i.natureza_count > 1) AS itens_multiplas_naturezas,
  count(*) FILTER (WHERE length(i.nome_item) > 700) AS itens_nome_muito_longo,
  count(*) AS total_itens,
  now() AS refreshed_at
FROM efisco_core.itens i;

CREATE MATERIALIZED VIEW IF NOT EXISTS efisco_analytics.mv_efisco_gnd_distribution AS
SELECT
  coalesce(inat.gnd, 'sem_gnd') AS gnd,
  inat.classe_despesa,
  count(*) AS vinculos,
  count(DISTINCT inat.item_id) AS itens_distintos
FROM efisco_core.item_naturezas inat
GROUP BY 1, 2;

CREATE MATERIALIZED VIEW IF NOT EXISTS efisco_analytics.mv_efisco_taxonomy_distribution AS
SELECT
  g.codigo_grupo,
  g.nome_grupo,
  c.codigo_classe,
  c.nome_classe,
  ms.codigo_material_servico,
  ms.nome_material_servico,
  ms.tipo_objeto,
  count(DISTINCT i.id) AS itens,
  count(inat.id) AS vinculos_natureza,
  count(DISTINCT inat.codigo_natureza_despesa) FILTER (WHERE inat.codigo_natureza_despesa IS NOT NULL) AS naturezas_distintas,
  count(*) FILTER (WHERE i.has_mixed_expense_classes) AS itens_mistos_linhas,
  count(DISTINCT i.id) FILTER (WHERE i.has_mixed_expense_classes) AS itens_mistos,
  count(DISTINCT i.id) FILTER (WHERE i.has_missing_natureza) AS itens_sem_natureza
FROM efisco_core.grupos g
JOIN efisco_core.classes c ON c.codigo_grupo = g.codigo_grupo
JOIN efisco_core.materiais_servicos ms ON ms.codigo_classe = c.codigo_classe
JOIN efisco_core.itens i ON i.codigo_material_servico = ms.codigo_material_servico
LEFT JOIN efisco_core.item_naturezas inat ON inat.item_id = i.id
GROUP BY 1, 2, 3, 4, 5, 6, 7;

CREATE MATERIALIZED VIEW IF NOT EXISTS efisco_analytics.mv_efisco_item_ambiguity AS
SELECT
  i.id AS item_id,
  i.codigo_item,
  i.nome_item,
  i.tipo_objeto,
  i.natureza_count,
  i.has_mixed_expense_classes,
  i.has_missing_natureza,
  array_agg(DISTINCT inat.gnd) FILTER (WHERE inat.gnd IS NOT NULL) AS gnds,
  array_agg(DISTINCT inat.classe_despesa) AS classes_despesa
FROM efisco_core.itens i
LEFT JOIN efisco_core.item_naturezas inat ON inat.item_id = i.id
GROUP BY i.id;

CREATE MATERIALIZED VIEW IF NOT EXISTS efisco_analytics.mv_efisco_planning_signals AS
SELECT
  i.id AS item_id,
  i.codigo_item,
  i.nome_item,
  i.tipo_objeto,
  g.codigo_grupo,
  g.nome_grupo,
  c.codigo_classe,
  c.nome_classe,
  ms.codigo_material_servico,
  ms.nome_material_servico,
  i.natureza_count,
  i.has_mixed_expense_classes,
  i.has_missing_natureza,
  length(i.nome_item) AS descricao_len,
  CASE
    WHEN i.has_missing_natureza THEN 'saneamento_fiscal'
    WHEN i.has_mixed_expense_classes THEN 'selecionar_natureza_na_dfd'
    WHEN i.natureza_count > 10 THEN 'alta_ambiguidade'
    WHEN length(i.nome_item) > 700 THEN 'descricao_longa'
    ELSE 'ok'
  END AS sinal_planejamento
FROM efisco_core.itens i
JOIN efisco_core.materiais_servicos ms ON ms.codigo_material_servico = i.codigo_material_servico
JOIN efisco_core.classes c ON c.codigo_classe = ms.codigo_classe
JOIN efisco_core.grupos g ON g.codigo_grupo = c.codigo_grupo;

CREATE INDEX IF NOT EXISTS idx_mart_gnd_distribution_gnd
  ON efisco_analytics.mv_efisco_gnd_distribution (gnd);

CREATE INDEX IF NOT EXISTS idx_mart_taxonomy_grupo_classe
  ON efisco_analytics.mv_efisco_taxonomy_distribution (codigo_grupo, codigo_classe);

CREATE INDEX IF NOT EXISTS idx_mart_item_ambiguity_mixed
  ON efisco_analytics.mv_efisco_item_ambiguity (has_mixed_expense_classes, natureza_count DESC);

CREATE INDEX IF NOT EXISTS idx_mart_planning_signals_sinal
  ON efisco_analytics.mv_efisco_planning_signals (sinal_planejamento, codigo_grupo);

CREATE OR REPLACE FUNCTION efisco_analytics.refresh_all()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = efisco_analytics, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW efisco_analytics.mv_efisco_quality_overview;
  REFRESH MATERIALIZED VIEW efisco_analytics.mv_efisco_gnd_distribution;
  REFRESH MATERIALIZED VIEW efisco_analytics.mv_efisco_taxonomy_distribution;
  REFRESH MATERIALIZED VIEW efisco_analytics.mv_efisco_item_ambiguity;
  REFRESH MATERIALIZED VIEW efisco_analytics.mv_efisco_planning_signals;
END;
$$;

GRANT USAGE ON SCHEMA efisco_analytics TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA efisco_analytics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION efisco_analytics.refresh_all() TO service_role;

-- ============================================================
-- Source: projeto_dbatualizado_efisco/sql/004_percata_integration.sql
-- ============================================================
-- Integration layer for the current PERCATA app.
-- This keeps existing public.catalogo intact and exposes v2 views/functions.

ALTER TABLE public.dfd_items
  ADD COLUMN IF NOT EXISTS efisco_item_id BIGINT REFERENCES efisco_core.itens(id),
  ADD COLUMN IF NOT EXISTS efisco_item_natureza_id BIGINT REFERENCES efisco_core.item_naturezas(id);

CREATE INDEX IF NOT EXISTS idx_dfd_items_efisco_item_id
  ON public.dfd_items (efisco_item_id);

CREATE INDEX IF NOT EXISTS idx_dfd_items_efisco_item_natureza_id
  ON public.dfd_items (efisco_item_natureza_id);

DROP VIEW IF EXISTS public.catalogo_item_naturezas_v2 CASCADE;
DROP VIEW IF EXISTS public.catalogo_efisco_v2 CASCADE;

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
  d.has_missing_natureza
FROM efisco_search.catalogo_documents d;

ALTER VIEW public.catalogo_efisco_v2 SET (security_invoker = true);

CREATE OR REPLACE VIEW public.catalogo_item_naturezas_v2 AS
SELECT
  i.id AS efisco_item_id,
  i.codigo_item AS codigo_efisco,
  i.nome_item AS descricao,
  n.id AS efisco_item_natureza_id,
  n.codigo_natureza_despesa,
  n.natureza_key,
  n.gnd,
  n.classe_despesa
FROM efisco_core.itens i
JOIN efisco_core.item_naturezas n ON n.item_id = i.id;

ALTER VIEW public.catalogo_item_naturezas_v2 SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.buscar_catalogo_inteligente_v2(
  query_text TEXT,
  categoria_filtro TEXT DEFAULT 'all',
  limit_val INTEGER DEFAULT 30,
  after_id BIGINT DEFAULT 0
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
  has_mixed_expense_classes BOOLEAN,
  has_missing_natureza BOOLEAN,
  rank REAL
)
LANGUAGE sql
STABLE
SET search_path = public, efisco_search, pg_temp
AS $$
  SELECT
    r.id,
    r.codigo_item AS codigo_efisco,
    r.descricao,
    CASE WHEN r.tipo_objeto = 'SERVIÇO' THEN 'Serviço' ELSE 'Material' END AS tipo,
    CASE WHEN r.tipo_objeto = 'SERVIÇO' THEN 'Serviço' ELSE 'Material' END AS categoria,
    r.nome_grupo AS grupo,
    r.nome_classe AS classe,
    r.tipo_objeto,
    r.codigo_grupo,
    r.nome_grupo,
    r.codigo_classe,
    r.nome_classe,
    r.codigo_material_servico,
    r.nome_material_servico,
    d.naturezas[1] AS codigo_natureza_preferencial,
    r.gnds[1] AS gnd_preferencial,
    r.natureza_count,
    'UN'::TEXT AS unidade_medida,
    r.has_mixed_expense_classes,
    d.has_missing_natureza,
    r.rank
  FROM efisco_search.buscar_catalogo_efisco_v2(query_text, categoria_filtro, limit_val, after_id) r
  JOIN efisco_search.catalogo_documents d ON d.id = r.id;
$$;

GRANT SELECT ON public.catalogo_efisco_v2 TO authenticated, service_role;
GRANT SELECT ON public.catalogo_item_naturezas_v2 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_catalogo_inteligente_v2(TEXT, TEXT, INTEGER, BIGINT) TO authenticated, service_role;
