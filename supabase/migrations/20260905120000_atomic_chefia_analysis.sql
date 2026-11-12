-- Rascunhos preliminares, decisões atômicas e histórico independente da DFD.
CREATE TABLE public.dfd_analysis_drafts (
  dfd_id uuid NOT NULL REFERENCES public.dfds(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_revision text NOT NULL,
  revision integer NOT NULL DEFAULT 1,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dfd_id, actor_id)
);
CREATE TABLE public.dfd_operations (
  request_id uuid PRIMARY KEY,
  actor_id uuid NOT NULL,
  actor_name text,
  actor_email text,
  actor_role text,
  dfd_id uuid NOT NULL,
  protocol text,
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('started','succeeded','failed')),
  payload_hash text NOT NULL,
  request_data jsonb NOT NULL,
  before_data jsonb,
  after_data jsonb,
  result jsonb,
  error_code text,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX dfd_operations_actor_time ON public.dfd_operations(actor_id,created_at DESC);
CREATE INDEX dfd_operations_dfd_time ON public.dfd_operations(dfd_id,created_at DESC);
ALTER TABLE public.dfd_analysis_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dfd_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dfd_analysis_drafts,public.dfd_operations FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.dfd_analysis_drafts,public.dfd_operations TO service_role;

CREATE OR REPLACE FUNCTION private.dfd_analysis_revision(p_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT md5(jsonb_build_object('dfd',to_jsonb(d),'items',
    coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=d.id),'[]'::jsonb))::text)
  FROM dfds d WHERE d.id=p_id;
$$;

CREATE OR REPLACE FUNCTION private.dfd_analysis_allowed(p_actor uuid,p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM profiles p JOIN dfds d ON d.id=p_id
    WHERE p.id=p_actor AND p.is_active IS TRUE AND (p.role='superadmin' OR
      (p.role='chefia' AND EXISTS(SELECT 1 FROM user_units u
        WHERE u.user_id=p.id AND u.role_in_unit='chefia'
          AND u.unit_id=coalesce(d.analysis_unidade_id,d.unidade_id)
          AND u.unit_type=coalesce(d.analysis_tipo_unidade,d.tipo_unidade)))));
$$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_workspace(p_actor uuid,p_all boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_result jsonb;
BEGIN
 SELECT role INTO v_role FROM profiles WHERE id=p_actor AND is_active IS TRUE;
 IF v_role IS NULL OR v_role NOT IN ('chefia','superadmin') THEN
   RAISE EXCEPTION 'Acesso negado.' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object('role',v_role,'actorId',p_actor,
   'calendar', (SELECT jsonb_build_object('open',private.app_cycle_chefia_open(),
      'start',janela_chefia_inicio,'end',janela_chefia_fim) FROM governanca_ciclos WHERE ativo IS TRUE LIMIT 1),
   'dfds',coalesce(jsonb_agg(entry ORDER BY entry->>'created_at'),'[]'::jsonb)) INTO v_result
 FROM (SELECT to_jsonb(d) || jsonb_build_object(
   'requester',coalesce((SELECT full_name FROM profiles WHERE id=d.solicitante_id),'Solicitante'),
   'sector',coalesce(CASE WHEN coalesce(d.analysis_tipo_unidade,d.tipo_unidade)='laboratorio'
      THEN (SELECT nome FROM laboratorios WHERE id=coalesce(d.analysis_unidade_id,d.unidade_id))
      ELSE (SELECT nome FROM departamentos WHERE id=coalesce(d.analysis_unidade_id,d.unidade_id)) END,'Sem setor'),
   'revision',private.dfd_analysis_revision(d.id),
   'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=d.id),'[]'::jsonb),
   'draft',(SELECT to_jsonb(dr) FROM dfd_analysis_drafts dr WHERE dr.dfd_id=d.id AND dr.actor_id=p_actor)
 ) AS entry FROM dfds d WHERE private.dfd_analysis_allowed(p_actor,d.id)
   AND (d.status='triagem' OR (p_all AND v_role='superadmin'))) scoped;
 RETURN v_result;
END;
$$;

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
 -- A UUID is bound to the authenticated actor and exact payload. Retries cannot duplicate a decision.
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
 -- Failure inside this subtransaction rolls back ALL business writes, then persists its own event.
 BEGIN
   SELECT * INTO v_dfd FROM dfds WHERE id=p_dfd_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'DFD_NOT_FOUND'; END IF;
   IF NOT private.dfd_analysis_allowed(p_actor,p_dfd_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
   PERFORM set_config('app.dfd_actor',p_actor::text,true);
   PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd_id ORDER BY id FOR UPDATE;
   SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) INTO v_items FROM dfd_items i WHERE i.dfd_id=p_dfd_id;
   v_revision:=private.dfd_analysis_revision(p_dfd_id);
   v_before:=jsonb_build_object('dfd',to_jsonb(v_dfd),'items',v_items,'reason',p_payload->>'reason');
   UPDATE dfd_operations SET protocol=v_dfd.numero_protocolo WHERE request_id=p_request_id;

   IF p_action='delete' THEN
     IF v_actor.role<>'superadmin' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
     IF nullif(trim(p_payload->>'confirmProtocol'),'') IS DISTINCT FROM v_dfd.numero_protocolo THEN
       RAISE EXCEPTION 'PROTOCOL_MISMATCH';
     END IF;
     -- No status condition: the Superadmin may delete a DFD in every workflow state.
     v_before:=v_before || jsonb_build_object(
       'logs',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM dfd_logs l WHERE dfd_id=p_dfd_id),
       'authors',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM dfd_collective_dfd_authors a WHERE dfd_id=p_dfd_id),
       'rooms',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM dfd_collective_room_dfds r WHERE dfd_id=p_dfd_id),
       'naturezaDecisions',(SELECT coalesce(jsonb_agg(to_jsonb(n)),'[]') FROM efisco_natureza_review_decisions n WHERE dfd_id=p_dfd_id),
       'contributions',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM dfd_collective_contributions c WHERE consolidated_dfd_id=p_dfd_id),
       'kits',(SELECT coalesce(jsonb_agg(to_jsonb(k)),'[]') FROM kits k WHERE source_dfd_id=p_dfd_id),
       'drafts',(SELECT coalesce(jsonb_agg(to_jsonb(dr)),'[]') FROM dfd_analysis_drafts dr WHERE dfd_id=p_dfd_id),
       'reason',left(coalesce(p_payload->>'reason','Exclusão pelo Superadmin'),2000));
     UPDATE kits SET source_dfd_id=null,source_protocol=null WHERE source_dfd_id=p_dfd_id;
     DELETE FROM dfds WHERE id=p_dfd_id;
     v_result:=jsonb_build_object('ok',true,'deleted',to_jsonb(v_dfd));
   ELSE
     IF v_dfd.status IS DISTINCT FROM 'triagem' THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
     IF nullif(p_payload->>'baseRevision','') IS DISTINCT FROM v_revision THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
     IF p_action='save_draft' THEN
       SELECT * INTO v_draft FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id AND actor_id=p_actor FOR UPDATE;
       IF coalesce(v_draft.revision,0)<>coalesce((p_payload->>'draftRevision')::integer,0) THEN RAISE EXCEPTION 'DRAFT_CONFLICT'; END IF;
       IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
       v_before:=jsonb_build_object('baseRevision',v_revision,'draft',to_jsonb(v_draft),'items',coalesce(v_draft.payload->'items',v_items));
       INSERT INTO dfd_analysis_drafts(dfd_id,actor_id,base_revision,revision,payload)
       VALUES(p_dfd_id,p_actor,v_revision,1,p_payload-'baseRevision'-'draftRevision')
       ON CONFLICT(dfd_id,actor_id) DO UPDATE SET payload=excluded.payload,revision=dfd_analysis_drafts.revision+1,updated_at=now(),base_revision=v_revision
       RETURNING * INTO v_draft;
       v_after:=to_jsonb(v_draft);
       v_result:=jsonb_build_object('ok',true,'draft',v_after);
     ELSE
       IF p_action NOT IN ('apply','approve','return','remove') THEN RAISE EXCEPTION 'INVALID_ACTION'; END IF;
       IF NOT private.app_cycle_chefia_open() THEN RAISE EXCEPTION 'CALENDAR_CLOSED'; END IF;
       IF p_action='return' THEN
         IF length(trim(coalesce(p_payload->>'reason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
         UPDATE dfds SET status='devolvida' WHERE id=p_dfd_id;
       ELSE
         v_input:=p_payload->'items';
         IF p_action='remove' THEN
           IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) x WHERE x->>'id'=p_payload->>'itemId') THEN RAISE EXCEPTION 'ITEM_NOT_FOUND'; END IF;
           SELECT jsonb_agg(x || CASE WHEN x->>'id'=p_payload->>'itemId'
             THEN jsonb_build_object('remove',true,'removalReason',p_payload->>'reason') ELSE '{}'::jsonb END)
           INTO v_input FROM jsonb_array_elements(v_items) x;
         END IF;
         IF jsonb_typeof(v_input) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
         v_count:=jsonb_array_length(v_input);
         IF v_count<>jsonb_array_length(v_items) OR
           (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(v_input) x)<>v_count OR
           EXISTS(SELECT 1 FROM jsonb_array_elements(v_input) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_items) y WHERE y->>'id'=x->>'id')) THEN
           RAISE EXCEPTION 'REVISION_CONFLICT';
         END IF;
         SELECT count(*) INTO v_remaining FROM jsonb_array_elements(v_input) x WHERE NOT coalesce((x->>'remove')::boolean,false);
         IF v_remaining<1 THEN RAISE EXCEPTION 'LAST_ITEM'; END IF;
         IF (SELECT count(*) FROM jsonb_array_elements(v_input) x WHERE NOT coalesce((x->>'remove')::boolean,false) AND coalesce((x->>'is_highlight_item')::boolean,false))>greatest(1,ceil(v_remaining*0.2)) THEN
           RAISE EXCEPTION 'HIGHLIGHT_LIMIT';
         END IF;
         FOR v_item IN SELECT value FROM jsonb_array_elements(v_input) LOOP
           IF coalesce((v_item->>'remove')::boolean,false) THEN
             IF length(trim(coalesce(v_item->>'removalReason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
             DELETE FROM dfd_items WHERE dfd_id=p_dfd_id AND id=(v_item->>'id')::uuid;
           ELSE
             IF (v_item->>'quantidade') IS NULL OR (v_item->>'quantidade')!~'^[0-9]+$' OR (v_item->>'quantidade')::numeric<1 OR (v_item->>'quantidade')::numeric>2147483647 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
             IF nullif(v_item->>'criticidade','') IS NOT NULL AND v_item->>'criticidade' NOT IN ('baixa','media','alta','critica') THEN RAISE EXCEPTION 'INVALID_PRIORITY'; END IF;
             IF nullif(v_item->>'moscow_categoria','') IS NOT NULL AND v_item->>'moscow_categoria' NOT IN ('deve_ter','deveria_ter','poderia_ter','nao_tera_agora') THEN RAISE EXCEPTION 'INVALID_PRIORITY'; END IF;
             IF p_action='approve' AND (nullif(v_item->>'criticidade','') IS NULL OR nullif(v_item->>'moscow_categoria','') IS NULL) THEN RAISE EXCEPTION 'PRIORITY_REQUIRED'; END IF;
             UPDATE dfd_items SET quantidade=(v_item->>'quantidade')::integer,
               criticidade=nullif(v_item->>'criticidade',''),moscow_categoria=nullif(v_item->>'moscow_categoria',''),
               is_highlight_item=coalesce((v_item->>'is_highlight_item')::boolean,false),
               justificativa_quantidade=nullif(trim(v_item->>'justificativa_quantidade'),'')
             WHERE id=(v_item->>'id')::uuid AND dfd_id=p_dfd_id;
           END IF;
         END LOOP;
         SELECT sum(quantidade*valor_unitario_estimado) INTO v_total FROM dfd_items WHERE dfd_id=p_dfd_id;
         UPDATE dfds SET valor_total_estimado=v_total,versao=coalesce(versao,1)+1,
           status=CASE WHEN p_action='approve' THEN 'aprovada' ELSE status END WHERE id=p_dfd_id;
       END IF;
       INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd_id,p_actor,
         CASE p_action WHEN 'approve' THEN 'aprovada' WHEN 'return' THEN 'devolvida' WHEN 'remove' THEN 'item_removido_durante_analise' ELSE 'triagem_atualizada' END,
         jsonb_build_object('requestId',p_request_id,'reason',p_payload->>'reason','changes',v_input)::text);
       IF p_action IN ('apply','remove') THEN
         INSERT INTO notifications(user_id,title,message,type) VALUES(v_dfd.solicitante_id,
           'Alterações da chefia: '||v_dfd.numero_protocolo,
           'A chefia ajustou os itens da DFD. Consulte o histórico para conferir quantidades, prioridades e retiradas.','info');
       END IF;
       DELETE FROM dfd_analysis_drafts WHERE dfd_id=p_dfd_id AND actor_id=p_actor;
       SELECT jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=d.id)) INTO v_after FROM dfds d WHERE d.id=p_dfd_id;
       v_result:=jsonb_build_object('ok',true,'id',p_dfd_id,'revision',private.dfd_analysis_revision(p_dfd_id),
         'status',v_after->'dfd'->>'status','total',v_total,'valorTotalEstimado',v_total,'itemId',p_payload->>'itemId',
         'remainingItemCount',jsonb_array_length(v_after->'items'),'items',v_after->'items');
     END IF;
   END IF;
   v_result:=v_result || jsonb_build_object('requestId',p_request_id);
   UPDATE dfd_operations SET status='succeeded',before_data=v_before,after_data=v_after,result=v_result,finished_at=clock_timestamp() WHERE request_id=p_request_id;
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS v_code=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
   v_result:=jsonb_build_object('ok',false,'code',CASE WHEN v_code='P0001' THEN v_message ELSE 'DATABASE_ERROR' END,'requestId',p_request_id);
   UPDATE dfd_operations SET status='failed',protocol=v_dfd.numero_protocolo,before_data=v_before,error_code=v_code,error_detail=left(v_message,2000),result=v_result,finished_at=clock_timestamp() WHERE request_id=p_request_id;
 END;
 RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION private.capture_dfd_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor uuid; v_row jsonb;
BEGIN
 v_actor:=coalesce(auth.uid(),nullif(current_setting('app.dfd_actor',true),'')::uuid);
 v_row:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 INSERT INTO audit_log(actor_id,actor_email,actor_role,table_name,row_id,action,old_data,new_data)
 VALUES(v_actor,(SELECT email FROM profiles WHERE id=v_actor),(SELECT role FROM profiles WHERE id=v_actor),
   TG_TABLE_NAME,v_row->>'id',TG_OP,CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 RETURN coalesce(NEW,OLD);
END;
$$;
CREATE TRIGGER capture_dfd_audit AFTER INSERT OR UPDATE OR DELETE ON public.dfds FOR EACH ROW EXECUTE FUNCTION private.capture_dfd_audit();
CREATE TRIGGER capture_dfd_item_audit AFTER INSERT OR UPDATE OR DELETE ON public.dfd_items FOR EACH ROW EXECUTE FUNCTION private.capture_dfd_audit();
CREATE TRIGGER capture_dfd_log_audit AFTER INSERT OR UPDATE OR DELETE ON public.dfd_logs FOR EACH ROW EXECUTE FUNCTION private.capture_dfd_audit();

CREATE OR REPLACE FUNCTION private.prevent_dfd_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'O histórico de auditoria não pode ser alterado ou excluído.'; END; $$;
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.audit_log FOR EACH STATEMENT EXECUTE FUNCTION private.prevent_dfd_history_mutation();
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.audit_log FROM anon,authenticated;

-- Keep legacy writers consistent with the already deployed read scope after reassignment.
DO $$ DECLARE pol record; v_using text; v_check text; BEGIN
 FOR pol IN SELECT * FROM pg_policies WHERE schemaname='public' AND tablename IN ('dfds','dfd_items') AND cmd='UPDATE' LOOP
   v_using:=replace(replace(pol.qual,'private.app_is_chefia_for_unit(d.unidade_id)','private.app_is_chefia_for_unit(coalesce(d.analysis_unidade_id,d.unidade_id))'),'private.app_is_chefia_for_unit(unidade_id)','private.app_is_chefia_for_unit(coalesce(analysis_unidade_id,unidade_id))');
   v_check:=replace(replace(pol.with_check,'private.app_is_chefia_for_unit(d.unidade_id)','private.app_is_chefia_for_unit(coalesce(d.analysis_unidade_id,d.unidade_id))'),'private.app_is_chefia_for_unit(unidade_id)','private.app_is_chefia_for_unit(coalesce(analysis_unidade_id,unidade_id))');
   EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)',pol.policyname,pol.tablename,v_using,v_check);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.protect_completed_dfd_operation() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN
 IF TG_OP='DELETE' OR OLD.status<>'started' THEN RAISE EXCEPTION 'Uma operação concluída não pode ser alterada ou excluída.'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER dfd_operations_immutable BEFORE UPDATE OR DELETE ON public.dfd_operations FOR EACH ROW EXECUTE FUNCTION private.protect_completed_dfd_operation();
REVOKE DELETE,TRUNCATE ON public.dfd_operations FROM service_role;

CREATE OR REPLACE FUNCTION public.dfd_analysis_health() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT count(*)=3 FROM pg_trigger WHERE tgname IN ('capture_dfd_audit','capture_dfd_item_audit','capture_dfd_log_audit') AND tgenabled='O';
$$;
REVOKE ALL ON FUNCTION public.dfd_analysis_workspace(uuid,boolean),public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb),public.dfd_analysis_health() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_workspace(uuid,boolean),public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb),public.dfd_analysis_health() TO service_role;
REVOKE ALL ON FUNCTION private.dfd_analysis_revision(uuid),private.dfd_analysis_allowed(uuid,uuid),private.capture_dfd_audit(),private.prevent_dfd_history_mutation() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
