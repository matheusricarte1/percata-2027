-- Administrative rectification preserves ownership, routing, fiscal identity and workflow.
CREATE OR REPLACE FUNCTION private.admin_can_correct_dfd(p_actor uuid,p_dfd uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles p JOIN dfds d ON d.id=p_dfd
 WHERE p.id=p_actor AND p.is_active IS TRUE AND
 (p.role='superadmin' OR (p.role='admin' AND p.campus_id=d.campus_id))
 AND d.status IN ('rascunho','triagem','devolvida','homologada','aprovada'));
$$;
REVOKE ALL ON FUNCTION private.admin_can_correct_dfd(uuid,uuid) FROM PUBLIC,anon,authenticated;

-- Add a narrow, service-only UPDATE path without changing any existing submission rule.
DO $migration$
DECLARE definition text; marker text := '  -- Service routes authenticate their actor.'; addition text;
BEGIN
 SELECT pg_get_functiondef('private.guard_submission_write()'::regprocedure) INTO definition;
 IF position('app.dfd_admin_correction' IN definition)=0 THEN
  IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Submission guard changed; review required'; END IF;
  addition := $guard$
  IF TG_OP='UPDATE' AND auth.role()='service_role' AND actor IS NOT NULL THEN
    IF TG_TABLE_NAME='dfds' THEN
     IF current_setting('app.dfd_admin_correction',true)=OLD.id::text
      AND private.admin_can_correct_dfd(actor,OLD.id) THEN
      IF (to_jsonb(NEW)-ARRAY['objeto_contratacao','justificativa_contratacao','valor_total_estimado','versao'])
        IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['objeto_contratacao','justificativa_contratacao','valor_total_estimado','versao'])
      THEN RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED'; END IF;
      RETURN NEW;
    END IF;
    ELSIF TG_TABLE_NAME='dfd_items' THEN
     IF current_setting('app.dfd_admin_correction',true)=OLD.dfd_id::text
      AND private.admin_can_correct_dfd(actor,OLD.dfd_id) THEN
      IF (to_jsonb(NEW)-ARRAY['quantidade','valor_unitario_estimado','justificativa_quantidade','justificativa_item','link_referencia','local_uso'])
        IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['quantidade','valor_unitario_estimado','justificativa_quantidade','justificativa_item','link_referencia','local_uso'])
      THEN RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED'; END IF;
      RETURN NEW;
     END IF;
    END IF;
  END IF;
$guard$;
  EXECUTE replace(definition,marker,addition||marker);
 END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.dfd_admin_correction_snapshot(p_actor uuid,p_dfd uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d dfds%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR NOT private.admin_can_correct_dfd(p_actor,p_dfd) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO d FROM dfds WHERE id=p_dfd FOR SHARE;
 PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd ORDER BY id FOR SHARE;
 RETURN jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM dfd_items i WHERE i.dfd_id=p_dfd),'revision',private.dfd_analysis_revision(p_dfd));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_dfd_admin_correction(p_actor uuid,p_dfd uuid,p_revision text,p_object text,p_justification text,p_reason text,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d dfds%ROWTYPE; item jsonb; before_data jsonb; after_data jsonb; total numeric; previous_actor text; previous_correction text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
 IF NOT private.admin_can_correct_dfd(p_actor,p_dfd) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd ORDER BY id FOR UPDATE;
 IF p_revision IS DISTINCT FROM private.dfd_analysis_revision(p_dfd) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 IF length(trim(coalesce(p_reason,'')))<3 OR length(trim(coalesce(p_object,'')))<3 OR length(trim(coalesce(p_justification,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 IF jsonb_array_length(p_items)=0 OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 IF EXISTS(SELECT 1 FROM dfd_items i WHERE i.dfd_id=p_dfd AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'id'=i.id::text))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE NOT EXISTS(SELECT 1 FROM dfd_items i WHERE i.dfd_id=p_dfd AND i.id::text=x->>'id'))
 OR (SELECT count(*) FROM jsonb_array_elements(p_items))<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x)
 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 before_data:=jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=p_dfd));
 previous_actor:=current_setting('app.dfd_actor',true); previous_correction:=current_setting('app.dfd_admin_correction',true);
 PERFORM set_config('app.dfd_actor',p_actor::text,true);
 PERFORM set_config('app.dfd_admin_correction',p_dfd::text,true);
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  IF jsonb_typeof(item->'quantidade') IS DISTINCT FROM 'number' OR (item->>'quantidade')!~'^[0-9]+$'
   OR (item->>'quantidade')::numeric<1 OR (item->>'quantidade')::numeric>2147483647
   OR jsonb_typeof(item->'valor_unitario_estimado') IS DISTINCT FROM 'number'
   OR coalesce((item->>'valor_unitario_estimado')::numeric,0)<=0 OR (item->>'valor_unitario_estimado')::numeric>1e12
  THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
  IF coalesce(item->>'link_referencia','')<>'' AND item->>'link_referencia' !~* '^https?://' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
  UPDATE dfd_items SET quantidade=(item->>'quantidade')::integer,valor_unitario_estimado=(item->>'valor_unitario_estimado')::numeric,
   justificativa_quantidade=nullif(left(item->>'justificativa_quantidade',4000),''),justificativa_item=nullif(left(item->>'justificativa_item',4000),''),
   link_referencia=nullif(left(item->>'link_referencia',2000),''),local_uso=nullif(left(item->>'local_uso',1000),'')
  WHERE id=(item->>'id')::uuid AND dfd_id=p_dfd;
 END LOOP;
 SELECT sum(quantidade*valor_unitario_estimado) INTO total FROM dfd_items WHERE dfd_id=p_dfd;
 UPDATE dfds SET objeto_contratacao=left(trim(p_object),2000),justificativa_contratacao=left(trim(p_justification),10000),valor_total_estimado=total,versao=coalesce(versao,1)+1 WHERE id=p_dfd;
 SELECT jsonb_build_object('dfd',to_jsonb(x),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=p_dfd)) INTO after_data FROM dfds x WHERE x.id=p_dfd;
 INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,'correcao_administrativa',jsonb_build_object('reason',trim(p_reason),'before',before_data,'after',after_data)::text);
 PERFORM set_config('app.dfd_actor',coalesce(previous_actor,''),true);
 PERFORM set_config('app.dfd_admin_correction',coalesce(previous_correction,''),true);
 RETURN jsonb_build_object('ok',true,'revision',private.dfd_analysis_revision(p_dfd),'total',total);
END;
$$;
REVOKE ALL ON FUNCTION public.dfd_admin_correction_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_dfd_admin_correction(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_admin_correction_snapshot(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_dfd_admin_correction(uuid,uuid,text,text,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
