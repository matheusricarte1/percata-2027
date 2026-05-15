-- Remove runtime dependency on a hardcoded personal superadmin e-mail.
-- The existing institutional superadmin is preserved as profile data first.

UPDATE public.profiles
SET role = 'superadmin'
WHERE lower(email) = 'matheus.ricarte@upe.br'
  AND role IS DISTINCT FROM 'superadmin';

CREATE OR REPLACE FUNCTION private.app_is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION private.app_current_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION private.app_is_superadmin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_current_profile_role() TO anon, authenticated, service_role;
