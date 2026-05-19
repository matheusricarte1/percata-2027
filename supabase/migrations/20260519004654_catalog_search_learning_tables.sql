CREATE TABLE IF NOT EXISTS public.catalog_search_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  query_text TEXT NOT NULL,
  query_norm TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'all',
  context TEXT NOT NULL DEFAULT 'catalogo',
  source TEXT NOT NULL DEFAULT 'supabase',
  offset_val INTEGER NOT NULL DEFAULT 0,
  limit_val INTEGER NOT NULL DEFAULT 30,
  result_count INTEGER NOT NULL DEFAULT 0,
  top_catalog_id BIGINT,
  top_codigo_efisco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.catalog_search_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('add_to_cart', 'add_to_collective_cart', 'add_to_collective_room')),
  query_text TEXT,
  query_norm TEXT,
  category TEXT NOT NULL DEFAULT 'all',
  context TEXT NOT NULL DEFAULT 'catalogo',
  source TEXT NOT NULL DEFAULT 'supabase',
  result_position INTEGER,
  catalog_id BIGINT,
  codigo_efisco TEXT,
  item_descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.catalog_search_overrides (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  query_norm TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'exact' CHECK (match_mode IN ('exact', 'contains')),
  override_type TEXT NOT NULL CHECK (override_type IN ('boost', 'block')),
  catalog_id BIGINT,
  codigo_efisco TEXT,
  weight INTEGER NOT NULL DEFAULT 200,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT catalog_search_overrides_target_check CHECK (
    catalog_id IS NOT NULL OR nullif(trim(coalesce(codigo_efisco, '')), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_search_logs_user_created
  ON public.catalog_search_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_search_logs_query_norm_created
  ON public.catalog_search_logs (query_norm, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_search_clicks_user_created
  ON public.catalog_search_clicks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_search_clicks_query_norm_created
  ON public.catalog_search_clicks (query_norm, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_search_clicks_catalog_id_created
  ON public.catalog_search_clicks (catalog_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catalog_search_overrides_query_active
  ON public.catalog_search_overrides (query_norm, is_active, match_mode);

CREATE INDEX IF NOT EXISTS idx_catalog_search_overrides_code_active
  ON public.catalog_search_overrides (codigo_efisco, is_active);

ALTER TABLE public.catalog_search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_search_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_search_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_search_logs_select_own ON public.catalog_search_logs;
CREATE POLICY catalog_search_logs_select_own
ON public.catalog_search_logs
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS catalog_search_logs_insert_own ON public.catalog_search_logs;
CREATE POLICY catalog_search_logs_insert_own
ON public.catalog_search_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS catalog_search_clicks_select_own ON public.catalog_search_clicks;
CREATE POLICY catalog_search_clicks_select_own
ON public.catalog_search_clicks
FOR SELECT
TO authenticated
USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS catalog_search_clicks_insert_own ON public.catalog_search_clicks;
CREATE POLICY catalog_search_clicks_insert_own
ON public.catalog_search_clicks
FOR INSERT
TO authenticated
WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS catalog_search_overrides_select_superadmin ON public.catalog_search_overrides;
CREATE POLICY catalog_search_overrides_select_superadmin
ON public.catalog_search_overrides
FOR SELECT
TO authenticated
USING (private.app_is_superadmin());

DROP POLICY IF EXISTS catalog_search_overrides_insert_superadmin ON public.catalog_search_overrides;
CREATE POLICY catalog_search_overrides_insert_superadmin
ON public.catalog_search_overrides
FOR INSERT
TO authenticated
WITH CHECK (private.app_is_superadmin());

DROP POLICY IF EXISTS catalog_search_overrides_update_superadmin ON public.catalog_search_overrides;
CREATE POLICY catalog_search_overrides_update_superadmin
ON public.catalog_search_overrides
FOR UPDATE
TO authenticated
USING (private.app_is_superadmin())
WITH CHECK (private.app_is_superadmin());

DROP POLICY IF EXISTS catalog_search_overrides_delete_superadmin ON public.catalog_search_overrides;
CREATE POLICY catalog_search_overrides_delete_superadmin
ON public.catalog_search_overrides
FOR DELETE
TO authenticated
USING (private.app_is_superadmin());

GRANT SELECT, INSERT ON public.catalog_search_logs TO authenticated, service_role;
GRANT SELECT, INSERT ON public.catalog_search_clicks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_search_overrides TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.catalog_search_logs_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.catalog_search_clicks_id_seq TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.catalog_search_overrides_id_seq TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
