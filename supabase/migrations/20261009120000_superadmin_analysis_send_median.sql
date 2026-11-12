-- Administrative forwarding retains completed evaluations and explicitly records
-- the default score separately from the ordinary calculated ranking.
ALTER TABLE public.dfds ADD COLUMN IF NOT EXISTS analysis_default_score numeric
  CHECK (analysis_default_score IS NULL OR analysis_default_score = 10);

-- Reuse every validation and audited transition from the installed official
-- operation. Only the calendar restriction is waived for this private entrypoint.
DO $$ DECLARE definition text; BEGIN
  definition:=pg_get_functiondef('public.dfd_analysis_operation_manual(uuid,uuid,text,uuid,jsonb)'::regprocedure);
  IF position('IF NOT private.app_cycle_chefia_open()' in definition)=0 THEN
    RAISE EXCEPTION 'Official calendar guard changed; review administrative forwarding';
  END IF;
  definition:=replace(definition,'public.dfd_analysis_operation_manual(', 'private.dfd_analysis_administrative_operation(');
  definition:=replace(definition,'IF NOT private.app_cycle_chefia_open()', 'IF false');
  IF position('SELECT jsonb_build_object(''dfd'',to_jsonb(d)' in definition)=0 THEN RAISE EXCEPTION 'Official snapshot changed'; END IF;
  definition:=replace(definition,'SELECT jsonb_build_object(''dfd'',to_jsonb(d)',
    'IF p_payload->>''forwardingMode''=''administrative_median'' THEN UPDATE dfds SET analysis_default_score=10 WHERE id=p_dfd_id; END IF; SELECT jsonb_build_object(''dfd'',to_jsonb(d)');
  EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION private.dfd_analysis_administrative_operation(uuid,uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE definition text; addition text; BEGIN
  definition:=pg_get_functiondef('private.guard_submission_write()'::regprocedure);
  addition:=$guard$
  IF auth.role()='service_role'
    AND current_setting('app.analysis_admin_dfd',true)=(CASE WHEN TG_TABLE_NAME='dfds' THEN to_jsonb(OLD)->>'id' ELSE coalesce(to_jsonb(NEW)->>'dfd_id',to_jsonb(OLD)->>'dfd_id') END)
    AND EXISTS(SELECT 1 FROM profiles WHERE id=nullif(current_setting('app.analysis_admin_sender',true),'')::uuid AND role='superadmin' AND is_active IS TRUE) THEN
    IF TG_TABLE_NAME='dfds' AND TG_OP='UPDATE' THEN
      IF (to_jsonb(NEW)-ARRAY['status','valor_total_estimado','versao','updated_at','analysis_default_score']) IS DISTINCT FROM
         (to_jsonb(OLD)-ARRAY['status','valor_total_estimado','versao','updated_at','analysis_default_score']) THEN RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED'; END IF;
      RETURN NEW;
    ELSIF TG_TABLE_NAME='dfd_items' AND TG_OP IN ('UPDATE','DELETE') THEN
      IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.dfd_id IS DISTINCT FROM OLD.dfd_id) THEN RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED'; END IF;
      RETURN coalesce(NEW,OLD);
    END IF;
  END IF;
  $guard$;
  IF position('app.analysis_admin_sender' in definition)=0 THEN
    IF position('BEGIN' in definition)=0 THEN RAISE EXCEPTION 'Submission guard changed'; END IF;
    definition:=overlay(definition placing 'BEGIN'||addition from position('BEGIN' in definition) for 5);
    EXECUTE definition;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_send_median(p_actor uuid,p_request_id uuid,p_dfd_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE saved dfd_analysis_drafts%ROWTYPE; previous dfd_operations%ROWTYPE;
  state text; payload jsonb; v_result jsonb; old_dfd text; old_sender text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='superadmin' AND is_active IS TRUE)
    OR NOT private.dfd_analysis_allowed(p_actor,p_dfd_id) THEN
    RETURN jsonb_build_object('ok',false,'code','FORBIDDEN');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  SELECT * INTO previous FROM dfd_operations WHERE request_id=p_request_id;
  IF FOUND THEN
    IF previous.dfd_id<>p_dfd_id OR previous.action<>'approve'
      OR previous.request_data->>'forwardedBy' IS DISTINCT FROM p_actor::text
      OR coalesce(previous.request_data->>'forwardingMode','') NOT IN ('administrative_completed','administrative_median') THEN
      RETURN jsonb_build_object('ok',false,'code','REQUEST_CONFLICT');
    END IF;
    RETURN CASE WHEN previous.request_data->>'forwardingMode'='administrative_median' AND coalesce((previous.result->>'ok')::boolean,false)
      THEN previous.result || jsonb_build_object('defaultScore',10,'forwardedBy',p_actor) ELSE previous.result END;
  END IF;
  SELECT status INTO state FROM dfds WHERE id=p_dfd_id FOR UPDATE;
  IF state='aprovada' THEN RETURN jsonb_build_object('ok',true,'status',state,'alreadySent',true); END IF;
  IF state IS DISTINCT FROM 'triagem' THEN RETURN jsonb_build_object('ok',false,'code','STATUS_CHANGED'); END IF;
  SELECT * INTO saved FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id ORDER BY updated_at DESC,actor_id LIMIT 1 FOR UPDATE;
  old_dfd:=current_setting('app.analysis_admin_dfd',true); old_sender:=current_setting('app.analysis_admin_sender',true);
  PERFORM set_config('app.analysis_admin_dfd',p_dfd_id::text,true);
  PERFORM set_config('app.analysis_admin_sender',p_actor::text,true);
  IF FOUND AND private.analysis_draft_ready(p_dfd_id,saved.actor_id,saved.base_revision,saved.payload) THEN
    v_result:=private.dfd_analysis_administrative_operation(saved.actor_id,p_request_id,'approve',p_dfd_id,
      saved.payload || jsonb_build_object('baseRevision',saved.base_revision,'forwardedBy',p_actor,'forwardingMode','administrative_completed'));
    IF coalesce((v_result->>'ok')::boolean,false) THEN
      INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,'envio_administrativo_avaliacao_preservada',
        jsonb_build_object('requestId',p_request_id,'evaluatedBy',saved.actor_id,'destination','consolidacao')::text);
    END IF;
    PERFORM set_config('app.analysis_admin_dfd',coalesce(old_dfd,''),true);
    PERFORM set_config('app.analysis_admin_sender',coalesce(old_sender,''),true);
    RETURN v_result;
  END IF;
  -- Incomplete drafts remain intact as evidence; no quantity/removal proposal is
  -- silently adopted. The administrative evaluation uses the current items.
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(i) ||
    jsonb_build_object('criticidade','media','moscow_categoria','deveria_ter','is_highlight_item',false) ORDER BY i.id),'[]'),
    'baseRevision',private.dfd_analysis_revision(p_dfd_id),
    'forwardedBy',p_actor,'forwardingMode','administrative_median','defaultScore',10,
    'reason','Envio administrativo pelo superadmin com nota mediana 10') INTO payload
    FROM dfd_items i WHERE dfd_id=p_dfd_id;
  v_result:=private.dfd_analysis_administrative_operation(p_actor,p_request_id,'approve',p_dfd_id,payload);
  IF coalesce((v_result->>'ok')::boolean,false) THEN
    INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,'envio_administrativo_nota_mediana',
      jsonb_build_object('requestId',p_request_id,'score',10,'destination','consolidacao','previousDraft',to_jsonb(saved))::text);
    v_result:=v_result || jsonb_build_object('defaultScore',10,'forwardedBy',p_actor);
  END IF;
  PERFORM set_config('app.analysis_admin_dfd',coalesce(old_dfd,''),true);
  PERFORM set_config('app.analysis_admin_sender',coalesce(old_sender,''),true);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.dfd_analysis_send_median(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_send_median(uuid,uuid,uuid) TO service_role;



