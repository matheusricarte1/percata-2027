-- The chefia prepares and may homologate until the closing date.  From the
-- chefia start date onward, only the formal homologation is allowed.
CREATE OR REPLACE FUNCTION private.app_cycle_chefia_open() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.governanca_ciclos c
    WHERE c.ativo IS TRUE
      AND now() < c.janela_chefia_fim
  );
$$;

CREATE OR REPLACE FUNCTION private.app_cycle_chefia_edit_open() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.governanca_ciclos c
    WHERE c.ativo IS TRUE
      AND now() < c.janela_chefia_inicio
  );
$$;

-- Keep server enforcement aligned with the institutional phases.  Approval
-- remains available during both phases, while adjustments, returns, and item
-- removals end when the homologation-only phase begins.
CREATE OR REPLACE FUNCTION public.dfd_analysis_operation(
  p_actor uuid,p_request_id uuid,p_action text,p_dfd_id uuid,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 v_actor profiles%ROWTYPE; v_dfd dfds%ROWTYPE; v_existing dfd_operations%ROWTYPE;
 v_draft dfd_analysis_drafts%ROWTYPE; v_items jsonb; v_input jsonb; v_item jsonb;
 v_before jsonb; v_after jsonb; v_result jsonb; v_revision text;
 v_count integer; v_remaining integer; v_total numeric; v_code text; v_message text;
 v_hash text := md5(jsonb_build_object('action',p_action,'dfd',p_dfd_id,'payload',p_payload)::text);
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO v_existing FROM dfd_operations WHERE request_id=p_request_id;
 IF FOUND THEN
   IF v_existing.actor_id<>p_actor OR v_existing.payload_hash<>v_hash THEN
     RETURN jsonb_build_object('ok',false,'code','REQUEST_CONFLICT','error','Esta tentativa já foi usada para outra alteração.','httpStatus',409);
   END IF;
   RETURN v_existing.result;
 END IF;
 SELECT * INTO v_actor FROM profiles WHERE id=p_actor AND is_active IS TRUE;
 IF NOT FOUND OR v_actor.role NOT IN ('chefia','superadmin') THEN
   RETURN jsonb_build_object('ok',false,'code','FORBIDDEN','error','Acesso negado.','httpStatus',403);
 END IF;
 INSERT INTO dfd_operations(request_id,actor_id,actor_name,actor_email,actor_role,dfd_id,action,status,payload_hash,request_data)
 VALUES(p_request_id,p_actor,v_actor.full_name,v_actor.email,v_actor.role,p_dfd_id,p_action,'started',v_hash,p_payload);
 BEGIN
   SELECT * INTO v_dfd FROM dfds WHERE id=p_dfd_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'DFD_NOT_FOUND'; END IF;
   IF NOT private.dfd_analysis_allowed(p_actor,p_dfd_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   PERFORM set_config('app.dfd_actor',p_actor::text,true);
   PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd_id ORDER BY id FOR UPDATE;
   SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_items FROM dfd_items i WHERE dfd_id=p_dfd_id;
   v_revision:=private.dfd_analysis_revision(p_dfd_id);
   v_before:=jsonb_build_object('dfd',to_jsonb(v_dfd),'items',v_items,'reason',p_payload->>'reason');
   UPDATE dfd_operations SET protocol=v_dfd.numero_protocolo WHERE request_id=p_request_id;
   IF p_action='delete' THEN
     IF v_actor.role<>'superadmin' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
     IF nullif(trim(p_payload->>'confirmProtocol'),'') IS DISTINCT FROM v_dfd.numero_protocolo THEN RAISE EXCEPTION 'PROTOCOL_MISMATCH'; END IF;
     v_before:=v_before || jsonb_build_object('logs',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM dfd_logs l WHERE dfd_id=p_dfd_id),'authors',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM dfd_collective_dfd_authors a WHERE dfd_id=p_dfd_id),'rooms',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM dfd_collective_room_dfds r WHERE dfd_id=p_dfd_id),'naturezaDecisions',(SELECT coalesce(jsonb_agg(to_jsonb(n)),'[]') FROM efisco_natureza_review_decisions n WHERE dfd_id=p_dfd_id),'contributions',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM dfd_collective_contributions c WHERE consolidated_dfd_id=p_dfd_id),'kits',(SELECT coalesce(jsonb_agg(to_jsonb(k)),'[]') FROM kits k WHERE source_dfd_id=p_dfd_id),'drafts',(SELECT coalesce(jsonb_agg(to_jsonb(dr)),'[]') FROM dfd_analysis_drafts dr WHERE dfd_id=p_dfd_id),'reason',left(coalesce(p_payload->>'reason','Exclusão pelo Superadmin'),2000));
     UPDATE kits SET source_dfd_id=null,source_protocol=null WHERE source_dfd_id=p_dfd_id; DELETE FROM dfds WHERE id=p_dfd_id; v_result:=jsonb_build_object('ok',true,'deleted',to_jsonb(v_dfd));
   ELSE
     IF v_dfd.status IS DISTINCT FROM 'triagem' THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
     IF nullif(p_payload->>'baseRevision','') IS DISTINCT FROM v_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
     IF p_action='save_draft' THEN
       SELECT * INTO v_draft FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id AND actor_id=p_actor FOR UPDATE;
       IF coalesce(v_draft.revision,0)<>coalesce((p_payload->>'draftRevision')::integer,0) THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
       IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
       v_before:=jsonb_build_object('baseRevision',v_revision,'draft',to_jsonb(v_draft),'items',coalesce(v_draft.payload->'items',v_items));
       INSERT INTO dfd_analysis_drafts(dfd_id,actor_id,base_revision,revision,payload) VALUES(p_dfd_id,p_actor,v_revision,1,p_payload-'baseRevision'-'draftRevision') ON CONFLICT(dfd_id,actor_id) DO UPDATE SET payload=excluded.payload,revision=dfd_analysis_drafts.revision+1,updated_at=now(),base_revision=v_revision RETURNING * INTO v_draft;
       v_after:=to_jsonb(v_draft); v_result:=jsonb_build_object('ok',true,'draft',v_after);
     ELSE
       IF p_action NOT IN ('apply','approve','return','remove') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
       IF NOT private.app_cycle_chefia_open() THEN RAISE EXCEPTION 'CALENDAR_CLOSED'; END IF;
       IF p_action<>'approve' AND NOT private.app_cycle_chefia_edit_open() THEN RAISE EXCEPTION 'CALENDAR_HOMOLOGATION_ONLY'; END IF;
       IF p_action='return' THEN
         IF length(trim(coalesce(p_payload->>'reason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF; UPDATE dfds SET status='devolvida' WHERE id=p_dfd_id;
       ELSE
         v_input:=p_payload->'items';
         IF p_action='remove' THEN
           IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) x WHERE x->>'id'=p_payload->>'itemId') THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
           SELECT jsonb_agg(x || CASE WHEN x->>'id'=p_payload->>'itemId' THEN jsonb_build_object('remove',true,'removalReason',p_payload->>'reason') ELSE '{}'::jsonb END) INTO v_input FROM jsonb_array_elements(v_items) x;
         END IF;
         IF jsonb_typeof(v_input) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
         v_count:=jsonb_array_length(v_input);
         IF v_count<>jsonb_array_length(v_items) OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(v_input) x)<>v_count OR EXISTS(SELECT 1 FROM jsonb_array_elements(v_input) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) y WHERE y->>'id'=x->>'id')) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
         SELECT count(*) INTO v_remaining FROM jsonb_array_elements(v_input) x WHERE NOT coalesce((x->>'remove')::boolean,false); IF v_remaining<1 THEN RAISE EXCEPTION 'LAST_ITEM'; END IF;
         IF (SELECT count(*) FROM jsonb_array_elements(v_input) x WHERE NOT coalesce((x->>'remove')::boolean,false) AND coalesce((x->>'is_highlight_item')::boolean,false))>greatest(1,ceil(v_remaining*0.2)) THEN RAISE EXCEPTION 'HIGHLIGHT_LIMIT'; END IF;
         FOR v_item IN SELECT value FROM jsonb_array_elements(v_input) LOOP
           IF coalesce((v_item->>'remove')::boolean,false) THEN
             IF length(trim(coalesce(v_item->>'removalReason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF; DELETE FROM dfd_items WHERE dfd_id=p_dfd_id AND id=(v_item->>'id')::uuid;
           ELSE
             IF (v_item->>'quantidade') IS NULL OR (v_item->>'quantidade')!~'^[0-9]+$' OR (v_item->>'quantidade')::numeric<1 OR (v_item->>'quantidade')::numeric>2147483647 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
             IF nullif(v_item->>'criticidade','') IS NOT NULL AND v_item->>'criticidade' NOT IN ('baixa','media','alta','critica') THEN RAISE EXCEPTION 'INVALID_PRIORITY'; END IF;
             IF nullif(v_item->>'moscow_categoria','') IS NOT NULL AND v_item->>'moscow_categoria' NOT IN ('deve_ter','deveria_ter','poderia_ter','nao_tera_agora') THEN RAISE EXCEPTION 'INVALID_PRIORITY'; END IF;
             IF p_action='approve' AND (nullif(v_item->>'criticidade','') IS NULL OR nullif(v_item->>'moscow_categoria','') IS NULL) THEN RAISE EXCEPTION 'PRIORITY_REQUIRED'; END IF;
             UPDATE dfd_items SET quantidade=(v_item->>'quantidade')::integer,criticidade=nullif(v_item->>'criticidade',''),moscow_categoria=nullif(v_item->>'moscow_categoria',''),is_highlight_item=coalesce((v_item->>'is_highlight_item')::boolean,false),justificativa_quantidade=nullif(trim(v_item->>'justificativa_quantidade'),'') WHERE id=(v_item->>'id')::uuid AND dfd_id=p_dfd_id;
           END IF;
         END LOOP;
         SELECT sum(quantidade*valor_unitario_estimado) INTO v_total FROM dfd_items WHERE dfd_id=p_dfd_id;
         UPDATE dfds SET valor_total_estimado=v_total,versao=coalesce(versao,1)+1,status=CASE WHEN p_action='approve' THEN 'aprovada' ELSE status END WHERE id=p_dfd_id;
       END IF;
       INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,CASE p_action WHEN 'approve' THEN 'aprovada' WHEN 'return' THEN 'devolvida' WHEN 'remove' THEN 'item_removido_durante_analise' ELSE 'triagem_atualizada' END,jsonb_build_object('requestId',p_request_id,'reason',p_payload->>'reason','changes',v_input)::text);
       IF p_action IN ('apply','remove') THEN INSERT INTO notifications(user_id,title,message,type) VALUES(v_dfd.solicitante_id,'Alterações da chefia: '||v_dfd.numero_protocolo,'A chefia ajustou os itens da DFD. Consulte o histórico para conferir quantidades, prioridades e retiradas.','info'); END IF;
       DELETE FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id AND actor_id=p_actor;
       SELECT jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=d.id)) INTO v_after FROM dfds d WHERE d.id=p_dfd_id;
       v_result:=jsonb_build_object('ok',true,'id',p_dfd_id,'revision',private.dfd_analysis_revision(p_dfd_id),'status',v_after->'dfd'->>'status','total',v_total,'valorTotalEstimado',v_total,'itemId',p_payload->>'itemId','remainingItemCount',jsonb_array_length(v_after->'items'),'items',v_after->'items');
     END IF;
   END IF;
   v_result:=v_result || jsonb_build_object('requestId',p_request_id); UPDATE dfd_operations SET status='succeeded',before_data=v_before,after_data=v_after,result=v_result,finished_at=clock_timestamp() WHERE request_id=p_request_id;
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_code=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
   v_result:=jsonb_build_object('ok',false,'code',CASE WHEN v_code='P0001' THEN v_message ELSE 'DATABASE_ERROR' END,'requestId',p_request_id);
   UPDATE dfd_operations SET status='failed',protocol=v_dfd.numero_protocolo,before_data=v_before,error_code=v_code,error_detail=left(v_message,2000),result=v_result,finished_at=clock_timestamp() WHERE request_id=p_request_id;
 END;
 RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION private.app_cycle_chefia_edit_open() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
