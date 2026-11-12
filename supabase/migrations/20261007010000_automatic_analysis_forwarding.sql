-- Complete saved evaluations use the same authorized, audited approval operation.
-- Never restore the former trigger that updated items/status without full validation.
DO $$ BEGIN
  IF to_regprocedure('public.dfd_analysis_operation_manual(uuid,uuid,text,uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb) RENAME TO dfd_analysis_operation_manual;
  END IF;
END $$;

-- Activate only after the frontend understands an approved response to save_draft.
CREATE OR REPLACE FUNCTION private.analysis_auto_forwarding_enabled()
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

CREATE OR REPLACE FUNCTION private.analysis_draft_ready(p_dfd uuid,p_actor uuid,p_base text,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item jsonb; retained integer:=0; stars integer:=0;
BEGIN
  IF NOT private.dfd_analysis_allowed(p_actor,p_dfd)
    OR p_base IS DISTINCT FROM private.dfd_analysis_revision(p_dfd)
    OR NOT EXISTS(SELECT 1 FROM dfds WHERE id=p_dfd AND status='triagem')
    OR EXISTS(SELECT 1 FROM dfd_correction_permissions WHERE dfd_id=p_dfd AND revoked_at IS NULL AND expires_at>now())
    OR jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(p_payload->'items')<>(SELECT count(*) FROM dfd_items WHERE dfd_id=p_dfd)
    OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_payload->'items') x)<>jsonb_array_length(p_payload->'items')
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'items') x WHERE NOT EXISTS(SELECT 1 FROM dfd_items WHERE dfd_id=p_dfd AND id::text=x->>'id')) THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    IF (item ? 'remove' AND jsonb_typeof(item->'remove')<>'boolean') OR (item ? 'is_highlight_item' AND jsonb_typeof(item->'is_highlight_item')<>'boolean') THEN RETURN false; END IF;
    IF coalesce((item->>'remove')::boolean,false) THEN
      IF length(trim(coalesce(item->>'removalReason','')))<3 THEN RETURN false; END IF;
    ELSE
      retained:=retained+1;
      IF coalesce(item->>'criticidade','') NOT IN ('baixa','media','alta','critica')
        OR coalesce(item->>'moscow_categoria','') NOT IN ('deve_ter','deveria_ter','poderia_ter','nao_tera_agora')
        OR coalesce(item->>'quantidade','')!~'^[0-9]+$' THEN RETURN false; END IF;
      IF (item->>'quantidade')::numeric<1 OR (item->>'quantidade')::numeric>2147483647 THEN RETURN false; END IF;
      IF coalesce((item->>'is_highlight_item')::boolean,false) THEN stars:=stars+1; END IF;
    END IF;
  END LOOP;
  RETURN retained>0 AND stars<=greatest(1,ceil(retained*0.2));
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_send_ready(p_actor uuid,p_request_id uuid,p_dfd_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved dfd_analysis_drafts%ROWTYPE; v_result jsonb; state text; previous dfd_operations%ROWTYPE;
BEGIN
  IF NOT private.dfd_analysis_allowed(p_actor,p_dfd_id) THEN RETURN jsonb_build_object('ok',false,'code','FORBIDDEN'); END IF;
  SELECT * INTO previous FROM dfd_operations WHERE request_id=p_request_id;
  IF FOUND THEN
    IF previous.dfd_id<>p_dfd_id OR previous.action<>'approve' OR previous.request_data->>'forwardingMode' IS DISTINCT FROM 'completed_evaluation' OR previous.request_data->>'forwardedBy' IS DISTINCT FROM p_actor::text THEN RETURN jsonb_build_object('ok',false,'code','REQUEST_CONFLICT'); END IF;
    RETURN CASE WHEN coalesce((previous.result->>'ok')::boolean,false) THEN previous.result || jsonb_build_object('autoSubmitted',true,'evaluatedBy',previous.actor_id,'forwardedBy',p_actor) ELSE previous.result END;
  END IF;
  SELECT status INTO state FROM dfds WHERE id=p_dfd_id FOR UPDATE;
  IF state='aprovada' THEN RETURN jsonb_build_object('ok',true,'status',state,'alreadySent',true,'requestId',p_request_id); END IF;
  IF NOT private.app_cycle_chefia_open() THEN RETURN jsonb_build_object('ok',false,'code','CALENDAR_CLOSED'); END IF;
  -- Select the latest saved evaluation. An incomplete/newer draft is never replaced by an older complete one.
  SELECT * INTO saved FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id ORDER BY updated_at DESC,actor_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND OR NOT private.analysis_draft_ready(p_dfd_id,saved.actor_id,saved.base_revision,saved.payload) THEN
    RETURN jsonb_build_object('ok',false,'code','EVALUATION_NOT_READY');
  END IF;
  v_result:=public.dfd_analysis_operation_manual(saved.actor_id,p_request_id,'approve',p_dfd_id,
    saved.payload || jsonb_build_object('baseRevision',saved.base_revision,'forwardedBy',p_actor,'forwardingMode','completed_evaluation'));
  IF (v_result->>'ok')::boolean THEN
    v_result:=v_result || jsonb_build_object('autoSubmitted',true,'evaluatedBy',saved.actor_id,'forwardedBy',p_actor);
    INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,saved.actor_id,'avaliacao_encaminhada_automaticamente',
      jsonb_build_object('requestId',p_request_id,'forwardedBy',p_actor,'evaluationSavedAt',saved.updated_at,'destination','consolidacao')::text);
  END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_operation(p_actor uuid,p_request_id uuid,p_action text,p_dfd_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb; forwarded jsonb; saved dfd_analysis_drafts%ROWTYPE; auto_id uuid;
BEGIN
  v_result:=public.dfd_analysis_operation_manual(p_actor,p_request_id,p_action,p_dfd_id,p_payload);
  IF p_action='save_draft' AND coalesce((v_result->>'ok')::boolean,false) THEN
    auto_id:=md5('auto-analysis:'||p_request_id::text)::uuid;
    -- Compose retries from the two immutable operation records, including after the calendar closes.
    SELECT result INTO forwarded FROM dfd_operations WHERE request_id=auto_id AND actor_id=p_actor AND dfd_id=p_dfd_id AND status='succeeded';
    IF FOUND THEN RETURN forwarded || jsonb_build_object('autoSubmitted',true,'evaluatedBy',p_actor,'approvalRequestId',auto_id,'requestId',p_request_id); END IF;
  END IF;
  IF p_action='save_draft' AND p_payload->'automaticForwarding' IS DISTINCT FROM 'false'::jsonb AND private.analysis_auto_forwarding_enabled() AND coalesce((v_result->>'ok')::boolean,false) AND v_result ? 'draft' AND private.app_cycle_chefia_open() THEN
    SELECT * INTO saved FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id AND actor_id=p_actor;
    IF FOUND AND private.analysis_draft_ready(p_dfd_id,p_actor,saved.base_revision,saved.payload) THEN
      auto_id:=md5('auto-analysis:'||p_request_id::text)::uuid;
      -- The just-saved actor remains the evaluator; never impersonate the initiating superadmin.
      forwarded:=public.dfd_analysis_operation_manual(p_actor,auto_id,'approve',p_dfd_id,
        saved.payload || jsonb_build_object('baseRevision',saved.base_revision,'forwardedBy',p_actor,'forwardingMode','automatic_save'));
      IF coalesce((forwarded->>'ok')::boolean,false) THEN
        v_result:=forwarded || jsonb_build_object('autoSubmitted',true,'evaluatedBy',p_actor,'approvalRequestId',auto_id,'requestId',p_request_id);
        INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,'avaliacao_encaminhada_automaticamente',jsonb_build_object('requestId',auto_id,'savedRequestId',p_request_id,'destination','consolidacao')::text);
      END IF;
    END IF;
  END IF;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_group_progress(p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE AND role IN ('chefia','superadmin')) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  WITH scoped AS (
    SELECT d.*,coalesce(d.analysis_unidade_id,d.unidade_id) unit_id,coalesce(d.analysis_tipo_unidade,d.tipo_unidade) unit_type,
      coalesce(c.nome,c.sigla,'Campus não informado') campus_name
    FROM dfds d LEFT JOIN campi c ON c.id=d.campus_id
    WHERE d.status IN ('triagem','aprovada') AND private.dfd_analysis_allowed(p_actor,d.id)
  ), evaluated AS (
    SELECT d.*,a.actor_id,a.updated_at,a.base_revision,
      CASE WHEN d.status='aprovada' THEN (SELECT finished_at FROM dfd_operations WHERE dfd_id=d.id AND action='approve' AND status='succeeded' ORDER BY created_at DESC,request_id DESC LIMIT 1) ELSE a.updated_at END evaluation_date,
      CASE WHEN d.status='aprovada' THEN coalesce((SELECT actor_id FROM dfd_operations WHERE dfd_id=d.id AND action='approve' AND status='succeeded' ORDER BY created_at DESC,request_id DESC LIMIT 1),(SELECT user_id FROM dfd_logs WHERE dfd_id=d.id AND user_id IS NOT NULL AND action IN ('aprovada','aprovada_automatica') ORDER BY created_at DESC,id DESC LIMIT 1)) ELSE a.actor_id END evaluator_id,
      CASE WHEN d.status='triagem' AND a.base_revision=private.dfd_analysis_revision(d.id) THEN a.payload->'items'
        ELSE (SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]') FROM dfd_items i WHERE i.dfd_id=d.id) END evaluation_items,
      d.status='triagem' AND coalesce(private.analysis_draft_ready(d.id,a.actor_id,a.base_revision,a.payload),false) ready,
      CASE WHEN d.unit_type='laboratorio' THEN (SELECT nome FROM laboratorios WHERE id=d.unit_id) ELSE (SELECT nome FROM departamentos WHERE id=d.unit_id) END sector_name
    FROM scoped d LEFT JOIN LATERAL (SELECT * FROM dfd_analysis_drafts WHERE dfd_id=d.id ORDER BY updated_at DESC,actor_id LIMIT 1) a ON true
  ), facts AS (
    SELECT e.*,coalesce(counts.items,0) retained_count,coalesce(counts.missing,0) missing_fields,
      coalesce(counts.missing_impact,0) missing_impact,coalesce(counts.missing_priority,0) missing_priority,counts.proposed_total,
      evaluator.full_name evaluator_name,evaluator.avatar_url evaluator_avatar
    FROM evaluated e LEFT JOIN profiles evaluator ON evaluator.id=e.evaluator_id LEFT JOIN LATERAL (
      SELECT count(*) FILTER(WHERE coalesce(x->'remove','false'::jsonb)<>'true'::jsonb)::int items,
        count(*) FILTER(WHERE coalesce(x->'remove','false'::jsonb)<>'true'::jsonb AND coalesce(x->>'criticidade','')='')::int missing_impact,
        count(*) FILTER(WHERE coalesce(x->'remove','false'::jsonb)<>'true'::jsonb AND coalesce(x->>'moscow_categoria','')='')::int missing_priority,
        coalesce(sum(CASE WHEN coalesce(x->'remove','false'::jsonb)='true'::jsonb OR coalesce(x->>'quantidade','')!~'^[0-9]+$' THEN 0 ELSE (x->>'quantidade')::numeric*coalesce((SELECT valor_unitario_estimado FROM dfd_items WHERE dfd_id=e.id AND id::text=x->>'id'),0) END),0) proposed_total,
        coalesce(sum(CASE WHEN coalesce(x->'remove','false'::jsonb)='true'::jsonb THEN 0 ELSE
          (CASE WHEN coalesce(x->>'criticidade','')='' THEN 1 ELSE 0 END)+(CASE WHEN coalesce(x->>'moscow_categoria','')='' THEN 1 ELSE 0 END) END),0)::int missing
      FROM jsonb_array_elements(coalesce(e.evaluation_items,'[]')) x
    ) counts ON true
  ), grouped AS (
    SELECT coalesce(unit_type,'unknown')||':'||coalesce(unit_id::text,id::text)||':'||coalesce(campus_id::text,'unknown') key,
      unit_id,unit_type,coalesce(sector_name,'Setor Geral') name,campus_name campus,
      count(*)::int total,count(*) FILTER(WHERE status='aprovada')::int sent,
      count(*) FILTER(WHERE ready)::int ready_count,
      sum(retained_count)::int items,sum(missing_fields)::int missing,
      coalesce(jsonb_agg(id) FILTER(WHERE ready),'[]') ready_ids,
      jsonb_agg(jsonb_build_object('id',id,'protocol',numero_protocolo,'status',status,'missingImpact',missing_impact,'missingPriority',missing_priority,'retainedCount',retained_count,'proposedTotal',proposed_total,
        'evaluator',CASE WHEN evaluator_id IS NOT NULL THEN jsonb_build_object('actorId',evaluator_id,'name',coalesce(evaluator_name,'Avaliador não identificado'),'avatarUrl',evaluator_avatar,'updatedAt',evaluation_date) ELSE null END)) dfd_progress
    FROM facts GROUP BY key,unit_id,unit_type,sector_name,campus_name
  ) SELECT coalesce(jsonb_agg(jsonb_build_object('key',key,'unitId',unit_id,'unitType',unit_type,'name',name,'campus',campus,
    'total',total,'sent',sent,'ready',ready_count,'pending',total-sent-ready_count,'items',items,'missingFields',missing,
    'readyIds',ready_ids,'dfds',dfd_progress,'percent',CASE WHEN sent=total THEN 100 WHEN items>0 THEN round((items*2-missing)::numeric/(items*2)*100) ELSE 0 END) ORDER BY name,campus),'[]') INTO v_result FROM grouped;
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION private.analysis_draft_ready(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.analysis_auto_forwarding_enabled() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dfd_analysis_operation_manual(uuid,uuid,text,uuid,jsonb),public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb),public.dfd_analysis_send_ready(uuid,uuid,uuid),public.dfd_analysis_group_progress(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb),public.dfd_analysis_send_ready(uuid,uuid,uuid),public.dfd_analysis_group_progress(uuid) TO service_role;
NOTIFY pgrst,'reload schema';

