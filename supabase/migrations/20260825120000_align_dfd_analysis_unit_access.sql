-- Keep direct DFD access aligned with the unit selected for analysis.
-- This does not grant campus-wide access to every profile with role=chefia.
ALTER POLICY dfds_select_policy ON public.dfds
USING (
  private.app_can_access_campus(campus_id)
  OR solicitante_id = (SELECT auth.uid())
  OR private.app_is_chefia_for_unit(COALESCE(analysis_unidade_id, unidade_id))
);

ALTER POLICY dfd_items_select_policy ON public.dfd_items
USING (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR d.solicitante_id = (SELECT auth.uid())
        OR private.app_is_chefia_for_unit(COALESCE(d.analysis_unidade_id, d.unidade_id))
      )
  )
);

ALTER POLICY dfd_logs_select_policy ON public.dfd_logs
USING (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_logs.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR d.solicitante_id = (SELECT auth.uid())
        OR private.app_is_chefia_for_unit(COALESCE(d.analysis_unidade_id, d.unidade_id))
      )
  )
);

