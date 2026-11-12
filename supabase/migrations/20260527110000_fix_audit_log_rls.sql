-- Fix Supabase advisor finding: public.audit_log without RLS in exposed schema.
DO $$
DECLARE
  superadmin_predicate TEXT;
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE NOTICE 'public.audit_log not found; skipping RLS hardening.';
    RETURN;
  END IF;

  IF to_regprocedure('private.app_is_superadmin()') IS NOT NULL THEN
    superadmin_predicate := '(SELECT private.app_is_superadmin())';
  ELSIF to_regprocedure('public.app_is_superadmin()') IS NOT NULL THEN
    superadmin_predicate := '(SELECT public.app_is_superadmin())';
  ELSE
    superadmin_predicate := 'false';
  END IF;

  EXECUTE 'ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY';

  EXECUTE 'REVOKE ALL ON TABLE public.audit_log FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated';
  EXECUTE 'GRANT ALL PRIVILEGES ON TABLE public.audit_log TO service_role';
  EXECUTE 'GRANT SELECT ON TABLE public.audit_log TO authenticated';

  EXECUTE 'DROP POLICY IF EXISTS audit_log_select_superadmin ON public.audit_log';
  EXECUTE format(
    'CREATE POLICY audit_log_select_superadmin
     ON public.audit_log
     FOR SELECT
     USING (%s)',
    superadmin_predicate
  );
END
$$;
