-- Harden legacy public views so they evaluate permissions/RLS as the caller.
ALTER VIEW IF EXISTS public.vw_admin_kpis SET (security_invoker = true);
ALTER VIEW IF EXISTS public.security_rls_status SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_consolidacao_pca SET (security_invoker = true);
ALTER VIEW IF EXISTS public.legacy_pa_minhas_demandas_ano_anterior SET (security_invoker = true);
ALTER VIEW IF EXISTS public.legacy_pa_fiscal_codigos_efisco SET (security_invoker = true);
ALTER VIEW IF EXISTS public.security_role_policy_matrix SET (security_invoker = true);
ALTER VIEW IF EXISTS public.security_rls_pending_tables SET (security_invoker = true);

-- Pin function search_path for legacy functions flagged by the database advisor.
ALTER FUNCTION public.set_governanca_ciclos_updated_at() SET search_path = public;
ALTER FUNCTION public.notify_dfd_status_change() SET search_path = public;
ALTER FUNCTION public.log_dfd_changes() SET search_path = public;
ALTER FUNCTION public.set_legacy_pa_updated_at() SET search_path = public;
ALTER FUNCTION public.is_legacy_pa_admin() SET search_path = public;
ALTER FUNCTION public.enforce_legacy_pa_status_em_pactuacao() SET search_path = public;
ALTER FUNCTION public.set_legacy_user_directory_updated_at() SET search_path = public;
ALTER FUNCTION public.set_user_settings_updated_at() SET search_path = public;
ALTER FUNCTION public.set_legacy_user_profile_links_updated_at() SET search_path = public;
ALTER FUNCTION public.catalogo_search_stopwords() SET search_path = public;
ALTER FUNCTION public.catalogo_build_search_vector(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_set_search_vector() SET search_path = public;
ALTER FUNCTION public.catalogo_normalize_text(TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_build_normalized_search_text(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_build_or_tsquery(TEXT[]) SET search_path = public;
ALTER FUNCTION public.catalogo_search_tsquery(TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_query_expansion_parts(TEXT) SET search_path = public;
ALTER FUNCTION public.touch_dfd_collective_room_updated_at() SET search_path = public;
ALTER FUNCTION public.buscar_catalogo_inteligente(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION public.app_is_member_for_unit(UUID, TEXT) SET search_path = public;

-- Remove redundant permissive SELECT policies while preserving read/write behavior.
DROP POLICY IF EXISTS "Catalogo is viewable by all authenticated users" ON public.catalogo_efisco;

DROP POLICY IF EXISTS kit_items_write_policy ON public.kit_items;
CREATE POLICY kit_items_insert_policy
ON public.kit_items
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin());

CREATE POLICY kit_items_update_policy
ON public.kit_items
FOR UPDATE
TO authenticated
USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY kit_items_delete_policy
ON public.kit_items
FOR DELETE
TO authenticated
USING (public.app_is_admin());

DROP POLICY IF EXISTS kits_write_policy ON public.kits;
CREATE POLICY kits_insert_policy
ON public.kits
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin());

CREATE POLICY kits_update_policy
ON public.kits
FOR UPDATE
TO authenticated
USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY kits_delete_policy
ON public.kits
FOR DELETE
TO authenticated
USING (public.app_is_admin());

-- Keep idx_catalogo_tipo_objeto_id and remove the identical duplicate.
DROP INDEX IF EXISTS public.idx_catalogo_tipo_search_id;
