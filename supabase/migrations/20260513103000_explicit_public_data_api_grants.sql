-- Supabase Data API hardening.
-- Public schema objects must declare explicit privileges before Supabase's
-- new default grant behavior reaches existing projects in 2026.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

DO $$
DECLARE
  table_name TEXT;
  write_tables TEXT[] := ARRAY[
    'profiles',
    'dfds',
    'dfd_items',
    'historico_demandas',
    'catalogo_favoritos',
    'notifications',
    'dfd_logs',
    'kits',
    'kit_items',
    'user_units',
    'email_alert_queue',
    'admin_user_audit_logs',
    'user_settings',
    'auth_login_events',
    'dfd_collective_contributions',
    'dfd_collective_rooms',
    'dfd_collective_room_dfds',
    'dfd_collective_room_events',
    'app_system_settings',
    'governanca_ciclos'
  ];
  read_tables TEXT[] := ARRAY[
    'catalogo',
    'catalogo_efisco',
    'catalogo_item_naturezas',
    'catalogo_search_synonyms',
    'campi',
    'departamentos',
    'laboratorios',
    'periodos_ciclo',
    'legacy_pa_demandas',
    'legacy_pa_itens',
    'legacy_user_directory',
    'legacy_demand_user_links',
    'legacy_user_profile_links'
  ];
BEGIN
  FOREACH table_name IN ARRAY write_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;

  FOREACH table_name IN ARRAY read_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.app_system_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_system_settings TO authenticated;

DO $$
DECLARE
  view_name TEXT;
  authenticated_views TEXT[] := ARRAY[
    'legacy_pa_fiscal_codigos_efisco',
    'legacy_pa_minhas_demandas_ano_anterior',
    'legacy_pa_minhas_demandas_v2',
    'legacy_user_links_pending_v1',
    'vw_admin_kpis',
    'vw_consolidacao_pca'
  ];
  service_views TEXT[] := ARRAY[
    'legacy_user_links_validation_v1',
    'security_rls_status',
    'security_rls_pending_tables',
    'security_role_policy_matrix'
  ];
BEGIN
  FOREACH view_name IN ARRAY authenticated_views LOOP
    IF to_regclass(format('public.%I', view_name)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', view_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', view_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', view_name);
    END IF;
  END LOOP;

  FOREACH view_name IN ARRAY service_views LOOP
    IF to_regclass(format('public.%I', view_name)) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', view_name);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', view_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  function_identity TEXT;
BEGIN
  FOR function_identity IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'buscar_catalogo_inteligente'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', function_identity);
  END LOOP;
END $$;
