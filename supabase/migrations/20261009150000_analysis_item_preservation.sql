-- Revision hashes must describe editable business data, not added score metadata.
CREATE TEMP TABLE analysis_revision_repair AS
 SELECT a.dfd_id,a.actor_id,a.base_revision old_revision,
   private.dfd_analysis_revision(a.dfd_id) previous_revision
 FROM public.dfd_analysis_drafts a;

ALTER TABLE public.dfd_items ADD COLUMN IF NOT EXISTS analysis_default_score numeric
 CHECK (analysis_default_score IS NULL OR analysis_default_score=10);

CREATE OR REPLACE FUNCTION private.dfd_analysis_revision(p_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT md5(jsonb_build_object('dfd',to_jsonb(d)-'analysis_default_score','items',
   coalesce((SELECT jsonb_agg(to_jsonb(i)-'analysis_default_score' ORDER BY i.id)
     FROM dfd_items i WHERE i.dfd_id=d.id),'[]'::jsonb))::text)
 FROM dfds d WHERE d.id=p_id;
$$;
-- Only repair drafts that matched the exact business snapshot before the
-- metadata-only schema change. Actual stale drafts remain stale.
WITH repaired AS (
 UPDATE public.dfd_analysis_drafts a SET base_revision=private.dfd_analysis_revision(a.dfd_id)
 FROM analysis_revision_repair r WHERE a.dfd_id=r.dfd_id AND a.actor_id=r.actor_id
 AND a.base_revision=r.previous_revision AND a.base_revision<>private.dfd_analysis_revision(a.dfd_id)
 RETURNING a.dfd_id,a.actor_id,r.old_revision,a.base_revision
) INSERT INTO public.dfd_logs(dfd_id,user_id,action,details)
 SELECT dfd_id,actor_id,'compatibilidade_revisao_avaliacao',jsonb_build_object(
   'oldRevision',old_revision,'newRevision',base_revision,'reason','Metadados de pontuação excluídos da revisão; itens e avaliação preservados')::text FROM repaired;
DROP TABLE analysis_revision_repair;

CREATE OR REPLACE FUNCTION private.analysis_reference_draft(p_dfd uuid)
RETURNS SETOF public.dfd_analysis_drafts LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT a.* FROM dfd_analysis_drafts a JOIN profiles p ON p.id=a.actor_id
 WHERE a.dfd_id=p_dfd AND private.dfd_analysis_allowed(a.actor_id,p_dfd)
 ORDER BY (p.role='chefia') DESC,a.updated_at DESC,a.actor_id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.analysis_reference_draft(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.dfd_analysis_reference_evaluation(p_actor uuid,p_dfd uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a dfd_analysis_drafts%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='superadmin' AND is_active=true)
   OR NOT private.dfd_analysis_allowed(p_actor,p_dfd) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO a FROM private.analysis_reference_draft(p_dfd);
 IF a.actor_id IS NULL OR a.base_revision IS DISTINCT FROM private.dfd_analysis_revision(p_dfd) THEN RETURN NULL; END IF;
 RETURN (SELECT jsonb_build_object('actorId',a.actor_id,'name',p.full_name,'avatarUrl',p.avatar_url,
   'updatedAt',a.updated_at,'baseRevision',a.base_revision,'items',a.payload->'items') FROM profiles p WHERE p.id=a.actor_id);
END $$;
REVOKE ALL ON FUNCTION public.dfd_analysis_reference_evaluation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_reference_evaluation(uuid,uuid) TO service_role;

DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.dfd_analysis_group_progress(uuid)'::regprocedure);
 IF position('SELECT * FROM dfd_analysis_drafts WHERE dfd_id=d.id ORDER BY updated_at DESC,actor_id LIMIT 1' in definition)=0 THEN RAISE EXCEPTION 'Group progress changed'; END IF;
 definition:=replace(definition,'SELECT * FROM dfd_analysis_drafts WHERE dfd_id=d.id ORDER BY updated_at DESC,actor_id LIMIT 1','SELECT * FROM private.analysis_reference_draft(d.id)');
 definition:=replace(definition,'count(*) FILTER(WHERE coalesce(x->''remove'',''false''::jsonb)<>''true''::jsonb AND coalesce(x->>''criticidade'','''')='''')::int missing_impact,',
   'count(*) FILTER(WHERE coalesce(x->''remove'',''false''::jsonb)<>''true''::jsonb AND (coalesce(x->>''criticidade'','''')='''' OR coalesce(x->>''moscow_categoria'','''')=''''))::int missing_items, count(*) FILTER(WHERE coalesce(x->''remove'',''false''::jsonb)<>''true''::jsonb AND coalesce(x->>''criticidade'','''')='''')::int missing_impact,');
 definition:=replace(definition,'coalesce(counts.missing_impact,0) missing_impact,','coalesce(counts.missing_items,0) missing_items,coalesce(counts.missing_impact,0) missing_impact,');
 definition:=replace(definition,'sum(retained_count)::int items,','sum(missing_items)::int pending_items,sum(retained_count)::int items,');
 definition:=replace(definition,'''missingImpact'',missing_impact,','''pendingItems'',missing_items,''missingImpact'',missing_impact,');
 definition:=replace(definition,'''readyIds'',ready_ids,','''pendingItems'',pending_items,''evaluatedItems'',items-pending_items,''readyIds'',ready_ids,');
 EXECUTE definition;
END $$;

-- Score defaults are persisted per item so one missing decision never replaces
-- an entire DFD's completed evaluation.
DO $$ DECLARE definition text; old_part text; new_part text; BEGIN
 definition:=pg_get_functiondef('private.dfd_analysis_administrative_operation(uuid,uuid,text,uuid,jsonb)'::regprocedure);
 definition:=replace(definition,'IF p_action<>''approve'' AND NOT private.app_cycle_chefia_edit_open()', 'IF false');
 old_part:='IF p_payload->>''forwardingMode''=''administrative_median'' THEN UPDATE dfds SET analysis_default_score=10 WHERE id=p_dfd_id; END IF;';
 new_part:='IF p_payload->>''forwardingMode'' IN (''administrative_median'',''administrative_partial'') THEN
 UPDATE dfd_items SET analysis_default_score=10 WHERE dfd_id=p_dfd_id AND id::text IN (SELECT jsonb_array_elements_text(coalesce(p_payload->''defaultItemIds'',''[]'')));
 UPDATE dfds SET analysis_default_score=CASE WHEN NOT EXISTS(SELECT 1 FROM dfd_items WHERE dfd_id=p_dfd_id AND analysis_default_score IS DISTINCT FROM 10) THEN 10 ELSE NULL END WHERE id=p_dfd_id; END IF;';
 IF position(old_part in definition)=0 THEN RAISE EXCEPTION 'Administrative score persistence changed'; END IF;
 EXECUTE replace(definition,old_part,new_part);
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_send_median(p_actor uuid,p_request_id uuid,p_dfd_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved dfd_analysis_drafts%ROWTYPE; previous dfd_operations%ROWTYPE;
 state text; payload jsonb; v_result jsonb; old_dfd text; old_sender text; defaults jsonb; evaluator uuid; mode text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='superadmin' AND is_active=true)
 OR NOT private.dfd_analysis_allowed(p_actor,p_dfd_id) THEN RETURN jsonb_build_object('ok',false,'code','FORBIDDEN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO previous FROM dfd_operations WHERE request_id=p_request_id;
 IF FOUND THEN
   IF previous.dfd_id<>p_dfd_id OR previous.action<>'approve' OR previous.request_data->>'forwardedBy' IS DISTINCT FROM p_actor::text
    OR coalesce(previous.request_data->>'forwardingMode','') NOT IN ('administrative_completed','administrative_median','administrative_partial') THEN
     RETURN jsonb_build_object('ok',false,'code','REQUEST_CONFLICT'); END IF;
   RETURN previous.result || CASE WHEN coalesce((previous.result->>'ok')::boolean,false) THEN jsonb_build_object('defaultItemIds',coalesce(previous.request_data->'defaultItemIds','[]')) ELSE '{}'::jsonb END;
 END IF;
 SELECT status INTO state FROM dfds WHERE id=p_dfd_id FOR UPDATE;
 IF state='aprovada' THEN RETURN jsonb_build_object('ok',true,'status',state,'alreadySent',true); END IF;
 IF state IS DISTINCT FROM 'triagem' THEN RETURN jsonb_build_object('ok',false,'code','STATUS_CHANGED'); END IF;
 SELECT * INTO saved FROM private.analysis_reference_draft(p_dfd_id);
 IF saved.actor_id IS NOT NULL AND saved.base_revision IS DISTINCT FROM private.dfd_analysis_revision(p_dfd_id) THEN
   RETURN jsonb_build_object('ok',false,'code','REVISION_CONFLICT'); END IF;
 evaluator:=coalesce(saved.actor_id,p_actor);
 SELECT coalesce(saved.payload,jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'))) INTO payload FROM dfd_items i WHERE dfd_id=p_dfd_id;
 SELECT coalesce(jsonb_agg(x->'id'),'[]') INTO defaults FROM jsonb_array_elements(payload->'items') x
 WHERE NOT coalesce((x->>'remove')::boolean,false) AND (nullif(x->>'criticidade','') IS NULL OR nullif(x->>'moscow_categoria','') IS NULL);
 mode:=CASE WHEN jsonb_array_length(defaults)=0 THEN 'administrative_completed' WHEN saved.actor_id IS NULL THEN 'administrative_median' ELSE 'administrative_partial' END;
 SELECT jsonb_agg(x || CASE WHEN defaults ? (x->>'id') THEN jsonb_build_object(
  'criticidade',coalesce(nullif(x->>'criticidade',''),'media'),
  'moscow_categoria',coalesce(nullif(x->>'moscow_categoria',''),'deveria_ter')) ELSE '{}'::jsonb END ORDER BY x->>'id') INTO payload
 FROM jsonb_array_elements(payload->'items') x;
 payload:=jsonb_build_object('items',payload,'baseRevision',private.dfd_analysis_revision(p_dfd_id),
  'forwardedBy',p_actor,'forwardingMode',mode,'defaultItemIds',defaults,'defaultScore',10,
  'reason','Envio administrativo; avaliações preenchidas preservadas e nota 10 somente nos itens pendentes');
 old_dfd:=current_setting('app.analysis_admin_dfd',true); old_sender:=current_setting('app.analysis_admin_sender',true);
 PERFORM set_config('app.analysis_admin_dfd',p_dfd_id::text,true); PERFORM set_config('app.analysis_admin_sender',p_actor::text,true);
 v_result:=private.dfd_analysis_administrative_operation(evaluator,p_request_id,'approve',p_dfd_id,payload);
 IF coalesce((v_result->>'ok')::boolean,false) THEN
   INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,'envio_administrativo_avaliacao_preservada',
     jsonb_build_object('requestId',p_request_id,'evaluatedBy',saved.actor_id,'defaultItemIds',defaults,'defaultScore',10,'previousEvaluation',to_jsonb(saved),'destination','consolidacao')::text);
   v_result:=v_result || jsonb_build_object('defaultItemIds',defaults);
 END IF;
 PERFORM set_config('app.analysis_admin_dfd',coalesce(old_dfd,''),true); PERFORM set_config('app.analysis_admin_sender',coalesce(old_sender,''),true);
 RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_remove_admin_item(p_actor uuid,p_request_id uuid,p_dfd_id uuid,p_item_id uuid,p_revision text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; old_dfd text; old_sender text; draft dfd_analysis_drafts%ROWTYPE; new_revision text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='superadmin' AND is_active=true)
 OR NOT private.dfd_analysis_allowed(p_actor,p_dfd_id) THEN RETURN jsonb_build_object('ok',false,'code','FORBIDDEN'); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 PERFORM 1 FROM dfds WHERE id=p_dfd_id FOR UPDATE;
 old_dfd:=current_setting('app.analysis_admin_dfd',true); old_sender:=current_setting('app.analysis_admin_sender',true);
 PERFORM set_config('app.analysis_admin_dfd',p_dfd_id::text,true); PERFORM set_config('app.analysis_admin_sender',p_actor::text,true);
 v_result:=private.dfd_analysis_administrative_operation(p_actor,p_request_id,'remove',p_dfd_id,
   jsonb_build_object('itemId',p_item_id,'reason',p_reason,'baseRevision',p_revision));
 IF coalesce((v_result->>'ok')::boolean,false) THEN
   new_revision:=private.dfd_analysis_revision(p_dfd_id);
   FOR draft IN SELECT * FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id AND base_revision=p_revision FOR UPDATE LOOP
     UPDATE dfd_analysis_drafts SET payload=jsonb_set(payload,'{items}',coalesce((SELECT jsonb_agg(x ORDER BY x->>'id') FROM jsonb_array_elements(draft.payload->'items') x WHERE x->>'id'<>p_item_id::text),'[]')),
       base_revision=new_revision,revision=revision+1 WHERE dfd_id=p_dfd_id AND actor_id=draft.actor_id;
     INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,'avaliacao_preservada_apos_retirada',
       jsonb_build_object('requestId',p_request_id,'itemId',p_item_id,'evaluator',draft.actor_id,'before',to_jsonb(draft),'revision',new_revision)::text);
   END LOOP;
 END IF;
 PERFORM set_config('app.analysis_admin_dfd',coalesce(old_dfd,''),true); PERFORM set_config('app.analysis_admin_sender',coalesce(old_sender,''),true);
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.dfd_analysis_remove_admin_item(uuid,uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_remove_admin_item(uuid,uuid,uuid,uuid,text,text) TO service_role;
