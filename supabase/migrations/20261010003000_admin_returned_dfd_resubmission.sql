-- Administrative resubmission preserves requester identity and the official
-- submission history. Its scoped context cannot be entered by browser roles.
CREATE OR REPLACE FUNCTION private.requester_can_edit_dfd(p_actor uuid,p_dfd uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM dfds d JOIN profiles p ON p.id=p_actor AND p.is_active IS TRUE
 WHERE d.id=p_dfd AND (d.solicitante_id=p_actor OR
 (d.status IN ('rascunho','devolvida') AND private.admin_submission_scope(p_actor,d.id))) AND (
 d.status='devolvida' OR (d.status='rascunho' AND private.can_submit_new(p_actor)) OR
 (d.status='triagem' AND private.has_dfd_correction(p_actor,p_dfd))));
$$;

CREATE OR REPLACE FUNCTION public.resubmit_returned_dfd_administratively(p_actor uuid,p_dfd uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE state text; result jsonb; old_scope text; old_actor text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role'
 OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor)
 OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='superadmin' AND is_active IS TRUE)
 THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 SELECT status INTO state FROM dfds WHERE id=p_dfd FOR UPDATE;
 IF state IS DISTINCT FROM 'devolvida' THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
 old_scope:=current_setting('app.admin_submission_dfd',true);
 old_actor:=current_setting('app.dfd_actor',true);
 PERFORM set_config('app.admin_submission_dfd',p_dfd::text,true);
 PERFORM set_config('app.dfd_actor',p_actor::text,true);
 result:=public.submit_dfd_with_deadline(p_actor,p_dfd,p_reason);
 INSERT INTO dfd_logs(dfd_id,user_id,action,details)
 VALUES(p_dfd,p_actor,'reenvio_administrativo_apos_devolucao',
 jsonb_build_object('reason',trim(p_reason),'requesterId',(SELECT solicitante_id FROM dfds WHERE id=p_dfd),'executingActorId',p_actor)::text);
 PERFORM set_config('app.admin_submission_dfd',coalesce(old_scope,''),true);
 PERFORM set_config('app.dfd_actor',coalesce(old_actor,''),true);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.resubmit_returned_dfd_administratively(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resubmit_returned_dfd_administratively(uuid,uuid,text) TO service_role;
