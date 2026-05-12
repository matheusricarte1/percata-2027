-- Harden profile reads and self-service profile updates.
-- Keeps legitimate UI flows working while removing broad authenticated reads.

CREATE OR REPLACE FUNCTION public.app_is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus.ricarte@upe.br';
$$;

CREATE OR REPLACE FUNCTION public.app_current_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.app_is_superadmin() THEN 'superadmin'
    ELSE (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.app_user_campus_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.campus_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_is_superadmin()
    OR coalesce(public.app_current_profile_role(), '') IN ('admin', 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.app_is_chefia_for_unit(target_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_units uu
    WHERE uu.user_id = auth.uid()
      AND uu.role_in_unit = 'chefia'
      AND uu.unit_id = target_unit_id
  );
$$;

CREATE OR REPLACE FUNCTION public.app_can_access_campus(target_campus UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.app_is_superadmin()
    OR (
      target_campus IS NOT NULL
      AND coalesce(public.app_current_profile_role(), '') IN ('admin', 'superadmin')
      AND public.app_user_campus_id() = target_campus
    );
$$;

CREATE OR REPLACE FUNCTION public.app_can_select_profile(
  target_profile_id UUID,
  target_campus_id UUID,
  target_role TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_context AS (
    SELECT
      auth.uid() AS user_id,
      public.app_user_campus_id() AS campus_id
  )
  SELECT coalesce((
    SELECT
      ctx.user_id IS NOT NULL
      AND (
        target_profile_id = ctx.user_id
        OR public.app_is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.dfds d
          WHERE d.solicitante_id = target_profile_id
            AND (
              d.solicitante_id = ctx.user_id
              OR public.app_is_chefia_for_unit(d.unidade_id)
            )
        )
        OR (
          target_campus_id IS NOT NULL
          AND target_campus_id = ctx.campus_id
          AND target_role IN ('chefia', 'admin', 'superadmin')
          AND EXISTS (
            SELECT 1
            FROM public.dfds own_dfd
            WHERE own_dfd.solicitante_id = ctx.user_id
              AND own_dfd.campus_id = target_campus_id
          )
        )
      )
    FROM current_context ctx
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.app_protect_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email TEXT := lower(coalesce(auth.jwt() ->> 'email', ''));
  jwt_role TEXT := coalesce(auth.role(), '');
  is_privileged BOOLEAN := auth.uid() IS NULL OR jwt_role = 'service_role' OR public.app_is_admin();
BEGIN
  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Operacao de perfil nao autorizada.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL AND NEW.role <> 'solicitante' THEN
      RAISE EXCEPTION 'Usuario comum nao pode definir perfil privilegiado.';
    END IF;

    IF NEW.role IS NULL THEN
      NEW.role := 'solicitante';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Usuario comum nao pode alterar o proprio papel.';
    END IF;

    IF OLD.campus_id IS NOT NULL AND NEW.campus_id IS DISTINCT FROM OLD.campus_id THEN
      RAISE EXCEPTION 'Alteracao de campus deve ser feita por administrador.';
    END IF;

    IF NEW.signature_hash IS DISTINCT FROM OLD.signature_hash THEN
      RAISE EXCEPTION 'Usuario comum nao pode alterar assinatura institucional.';
    END IF;
  END IF;

  IF NEW.email IS NOT NULL AND jwt_email <> '' AND lower(NEW.email) <> jwt_email THEN
    RAISE EXCEPTION 'E-mail do perfil deve corresponder ao usuario autenticado.';
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS profiles_select_policy ON public.profiles;

CREATE POLICY profiles_select_policy
ON public.profiles
FOR SELECT
USING (
  public.app_can_select_profile(id, campus_id, role)
);

DROP TRIGGER IF EXISTS protect_profile_self_update ON public.profiles;

CREATE TRIGGER protect_profile_self_update
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.app_protect_profile_self_update();

REVOKE ALL ON FUNCTION public.app_can_select_profile(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_select_profile(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_can_select_profile(UUID, UUID, TEXT) TO service_role;
