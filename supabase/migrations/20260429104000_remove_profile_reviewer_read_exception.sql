-- After moving DFD triage notifications to a server-side route, clients no
-- longer need to read reviewer profiles for their campus.

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
    SELECT auth.uid() AS user_id
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
      )
    FROM current_context ctx
  ), false);
$$;

