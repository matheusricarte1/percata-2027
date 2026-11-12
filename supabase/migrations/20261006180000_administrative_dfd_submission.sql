-- Scoped administrative creation: requester and executing superadmin stay distinct.
CREATE OR REPLACE FUNCTION private.admin_submission_scope(p_actor uuid,p_dfd uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.role()='service_role' AND p_dfd::text=coalesce(current_setting('app.admin_submission_dfd',true),'')
 AND p_actor::text=coalesce(current_setting('app.dfd_actor',true),'')
 AND EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE AND role='superadmin');
$$;
REVOKE ALL ON FUNCTION private.admin_submission_scope(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.create_and_submit_dfd_administratively(p_actor uuid,p_requester uuid,p_request_id uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE requester profiles%ROWTYPE; existing dfds%ROWTYPE; v_unit_id uuid; unit_name text; campus_name text; item jsonb; protocol text; total numeric:=0; reason text; catalog catalogo_efisco_v2%ROWTYPE; nature catalogo_item_naturezas_v2%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR (auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_actor)
 OR NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE AND role='superadmin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_request_id IS NULL OR NOT private.can_submit_new(p_actor) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED'; END IF;
 SELECT * INTO requester FROM profiles WHERE id=p_requester AND is_active IS TRUE;
 IF requester.id IS NULL THEN RAISE EXCEPTION 'USER_INACTIVE'; END IF;
 reason:=trim(coalesce(p_payload->>'administrativeReason',''));
 IF length(reason)<3 OR length(trim(coalesce(p_payload->>'object','')))<3 OR length(trim(coalesce(p_payload->>'justification','')))<3
 OR length(trim(coalesce(p_payload->>'quantityBasis','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 v_unit_id:=(p_payload->>'unitId')::uuid;
 SELECT nome INTO unit_name FROM departamentos WHERE id=v_unit_id AND campus_id=requester.campus_id;
 IF unit_name IS NULL OR NOT EXISTS(SELECT 1 FROM user_units WHERE user_id=p_requester AND unit_id=v_unit_id AND unit_type='departamento') THEN RAISE EXCEPTION 'INVALID_ROUTING'; END IF;
 SELECT nome INTO campus_name FROM campi WHERE id=requester.campus_id;
 IF campus_name IS NULL OR (p_payload->>'expectedDate')::date<'2027-01-01' OR nullif(p_payload->>'expectedDate','') IS NULL THEN RAISE EXCEPTION 'INVALID_DATE'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO existing FROM dfds WHERE id=p_request_id;
 IF existing.id IS NOT NULL THEN
  IF existing.solicitante_id=p_requester AND existing.status='triagem' AND EXISTS(SELECT 1 FROM dfd_logs WHERE dfd_id=p_request_id AND user_id=p_actor AND action='criacao_e_envio_administrativo' AND (details::jsonb)->>'payloadHash'=md5(p_payload::text)) THEN
   RETURN jsonb_build_object('ok',true,'id',existing.id,'protocol',existing.numero_protocolo,'status',existing.status,'total',existing.valor_total_estimado,'alreadySent',true);
  END IF;
  RAISE EXCEPTION 'REVISION_CONFLICT';
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
  IF length(trim(coalesce(item->>'description','')))<3
  OR coalesce((item->>'quantity')::integer,0)<1 OR coalesce((item->>'unitPrice')::numeric,0)<=0
  OR coalesce((item->>'unitPrice')::numeric,0)>1e12 OR length(trim(coalesce(item->>'justification','')))<3 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
  SELECT * INTO catalog FROM catalogo_efisco_v2 WHERE id=(item->>'catalogId')::bigint;
  SELECT * INTO nature FROM catalogo_item_naturezas_v2 WHERE efisco_item_id=catalog.id AND codigo_natureza_despesa=item->>'naturezaCode';
  IF catalog.id IS NULL OR nature.efisco_item_natureza_id IS NULL THEN RAISE EXCEPTION 'INVALID_CATALOG_NATURE'; END IF;
  total:=total+(item->>'quantity')::integer*(item->>'unitPrice')::numeric;
 END LOOP;
 PERFORM set_config('app.dfd_actor',p_actor::text,true);
 PERFORM set_config('app.admin_submission_dfd',p_request_id::text,true);
 protocol:='DFD-'||to_char(clock_timestamp(),'YYYY-MMDDHH24MISS')||'-'||upper(substr(replace(p_request_id::text,'-',''),1,4));
 INSERT INTO dfds(id,numero_protocolo,solicitante_id,campus,campus_id,unidade_id,tipo_unidade,analysis_unidade_id,analysis_tipo_unidade,analysis_routing_reason,objeto_contratacao,justificativa_contratacao,justificativa_quantidade,previsao_recebimento,status,valor_total_estimado,planning_subsidies)
 VALUES(p_request_id,protocol,p_requester,campus_name,requester.campus_id,v_unit_id,'departamento',v_unit_id,'departamento','Envio administrativo à unidade vinculada à solicitante',p_payload->>'object',p_payload->>'justification',p_payload->>'quantityBasis',(p_payload->>'expectedDate')::date,'rascunho',total,coalesce(p_payload->'planningSubsidies','{}'::jsonb));
 FOR item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
  SELECT * INTO catalog FROM catalogo_efisco_v2 WHERE id=(item->>'catalogId')::bigint;
  SELECT * INTO nature FROM catalogo_item_naturezas_v2 WHERE efisco_item_id=catalog.id AND codigo_natureza_despesa=item->>'naturezaCode';
  INSERT INTO dfd_items(dfd_id,codigo_tce,codigo_item_efisco,descricao,unidade_medida,quantidade,valor_unitario_estimado,justificativa_quantidade,justificativa_item,local_uso,link_referencia,gnd,gnd_derivado,codigo_natureza_despesa,efisco_item_id,efisco_item_natureza_id,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,requires_natureza_review)
  VALUES(p_request_id,catalog.codigo_efisco,catalog.codigo_efisco,catalog.descricao||' — Especificação da demanda: '||(item->>'description'),'UN',(item->>'quantity')::integer,(item->>'unitPrice')::numeric,p_payload->>'quantityBasis',item->>'justification',unit_name,item->>'referenceUrl',nature.gnd,nature.gnd,nature.codigo_natureza_despesa,catalog.id,nature.efisco_item_natureza_id,catalog.tipo_objeto,catalog.codigo_grupo,catalog.nome_grupo,catalog.codigo_classe,catalog.nome_classe,catalog.codigo_material_servico,catalog.nome_material_servico,false);
 END LOOP;
 PERFORM public.submit_dfd_with_deadline(p_actor,p_request_id,reason);
 INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_request_id,p_actor,'criacao_e_envio_administrativo',jsonb_build_object('reason',reason,'requesterId',p_requester,'executingActorId',p_actor,'payloadHash',md5(p_payload::text),'catalogCodesValidated',true,'priceMethod','Estimativa preliminar de planejamento; não é média de cotações comparáveis')::text);
 INSERT INTO notifications(user_id,title,message,type)
 SELECT DISTINCT u.user_id,'Nova DFD na fila de análise',jsonb_build_object('kind','rich_notification','template_key','dfd_submitted','heading','DFD '||protocol||' encaminhada para análise','context_label','Análise da chefia','status_label','Encaminhada','status_tone','info','body','Solicitação de '||requester.full_name||' cadastrada e enviada administrativamente pelo superadmin para análise.','cta_label','Analisar DFD','cta_url','https://percata.vercel.app/dfd/'||p_request_id::text,'facts',jsonb_build_array(jsonb_build_object('label','Protocolo','value',protocol)))::text,'info'
 FROM user_units u JOIN profiles p ON p.id=u.user_id AND p.is_active IS TRUE
 WHERE u.unit_id=v_unit_id AND u.role_in_unit='chefia' AND u.user_id<>p_requester;
 PERFORM set_config('app.admin_submission_dfd','',true);
 RETURN jsonb_build_object('ok',true,'id',p_request_id,'protocol',protocol,'status','triagem','total',total,'alreadySent',false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_and_submit_dfd_administratively(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_and_submit_dfd_administratively(uuid,uuid,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION private.guard_submission_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE actor uuid:=coalesce(auth.uid(),nullif(current_setting('app.dfd_actor',true),'')::uuid); d dfds%ROWTYPE;
BEGIN


  IF auth.role()='service_role' AND actor IS NOT NULL THEN
    IF TG_TABLE_NAME='dfds' AND TG_OP='UPDATE' THEN
      IF current_setting('app.dfd_admin_correction',true)=OLD.id::text AND private.admin_can_correct_dfd(actor,OLD.id) THEN
        IF (to_jsonb(NEW)-ARRAY['objeto_contratacao','justificativa_contratacao','valor_total_estimado','versao']) IS DISTINCT FROM
           (to_jsonb(OLD)-ARRAY['objeto_contratacao','justificativa_contratacao','valor_total_estimado','versao']) THEN RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED'; END IF;
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME='dfd_items' THEN
      IF current_setting('app.dfd_admin_correction',true)=coalesce(NEW.dfd_id,OLD.dfd_id)::text
        AND private.admin_can_correct_dfd(actor,coalesce(NEW.dfd_id,OLD.dfd_id)) THEN
        IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.dfd_id IS DISTINCT FROM OLD.dfd_id) THEN RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED'; END IF;
        RETURN coalesce(NEW,OLD);
      END IF;
    END IF;
  END IF;
  -- Service routes authenticate their actor. Legacy background maintenance has
  -- no user context; browser writes always carry auth.uid and cannot bypass this.
  IF TG_TABLE_NAME='dfds' THEN
    IF TG_OP='INSERT' THEN
      IF actor IS NULL THEN
        -- Collective conversion by the scoped chefia is not a new personal request.
        IF NEW.origin_type='collective' THEN RETURN NEW; END IF;
        actor:=NEW.solicitante_id;
      END IF;
      IF (NEW.solicitante_id IS DISTINCT FROM actor AND NOT private.admin_submission_scope(actor,NEW.id)) OR NOT private.can_submit_new(actor)
        OR NEW.status<>'rascunho' THEN
        RAISE EXCEPTION 'SUBMISSION_CLOSED: Novas solicitações estão encerradas. Solicite liberação ao superadmin.';
      END IF;
      RETURN NEW;
    END IF;
    IF actor IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    IF NEW.solicitante_id IS DISTINCT FROM OLD.solicitante_id OR NEW.campus_id IS DISTINCT FROM OLD.campus_id
      OR NEW.origin_type IS DISTINCT FROM OLD.origin_type OR NEW.collective_origin_room_id IS DISTINCT FROM OLD.collective_origin_room_id THEN
      RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED: A titularidade e a origem da DFD são protegidas.';
    END IF;
    IF OLD.origin_type='collective' AND OLD.status='rascunho' AND NEW.status='triagem'
      AND OLD.collective_origin_room_id::text=coalesce(current_setting('app.collective_conversion',true),'') THEN RETURN NEW; END IF;
    IF OLD.status IN ('aprovada','concluida','pactuando') THEN
      RAISE EXCEPTION 'DFD_FINALIZED: A DFD exige reabertura formal antes de alterações.';
    END IF;
    IF private.chefia_can_edit_dfd(actor,OLD.id) THEN RETURN NEW; END IF;
    IF NOT private.requester_can_edit_dfd(actor,OLD.id) THEN
      RAISE EXCEPTION 'SUBMISSION_CLOSED: A edição exige devolução ou autorização da chefia.';
    END IF;
    IF NEW.status NOT IN (OLD.status,'triagem') THEN
      RAISE EXCEPTION 'DFD_STATUS_PROTECTED: Somente a chefia pode decidir esta DFD.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND coalesce(current_setting('app.dfd_submission',true),'')<>'true' THEN
      RAISE EXCEPTION 'DFD_SUBMISSION_REQUIRED: Use o envio formal para registrar a justificativa e o histórico.';
    END IF;
    IF NEW.unidade_id IS DISTINCT FROM OLD.unidade_id OR NEW.tipo_unidade IS DISTINCT FROM OLD.tipo_unidade
      OR NEW.analysis_unidade_id IS DISTINCT FROM OLD.analysis_unidade_id OR NEW.analysis_tipo_unidade IS DISTINCT FROM OLD.analysis_tipo_unidade THEN
      RAISE EXCEPTION 'DFD_ROUTING_PROTECTED: A unidade de análise não pode ser alterada pelo solicitante.';
    END IF;
    RETURN NEW;
  END IF;
  IF actor IS NULL THEN RETURN coalesce(NEW,OLD); END IF;
  SELECT * INTO d FROM dfds WHERE id=coalesce(NEW.dfd_id,OLD.dfd_id) FOR UPDATE;
  IF NOT FOUND THEN RETURN coalesce(NEW,OLD); END IF; -- cascading parent deletion
  IF TG_OP='UPDATE' AND NEW.dfd_id IS DISTINCT FROM OLD.dfd_id THEN
    RAISE EXCEPTION 'DFD_IDENTITY_PROTECTED: Um item não pode mudar de DFD.';
  END IF;
  IF NOT (private.requester_can_edit_dfd(actor,d.id) OR private.chefia_can_edit_dfd(actor,d.id)) THEN
    RAISE EXCEPTION 'SUBMISSION_CLOSED: A edição exige devolução ou autorização da chefia.';
  END IF;
  RETURN coalesce(NEW,OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION private.requester_can_edit_dfd(p_actor uuid, p_dfd uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS(SELECT 1 FROM dfds d JOIN profiles p ON p.id=p_actor AND p.is_active IS TRUE
    WHERE d.id=p_dfd AND (d.solicitante_id=p_actor OR (d.status='rascunho' AND private.admin_submission_scope(p_actor,d.id))) AND (
      d.status='devolvida' OR (d.status='rascunho' AND private.can_submit_new(p_actor)) OR
      (d.status='triagem' AND private.has_dfd_correction(p_actor,p_dfd))));
$function$;

CREATE OR REPLACE FUNCTION public.submit_dfd_with_deadline(p_actor uuid, p_dfd uuid, p_justification text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE d dfds%ROWTYPE; correction boolean; c governanca_ciclos%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
  IF d.id IS NULL OR (d.solicitante_id IS DISTINCT FROM p_actor AND NOT private.admin_submission_scope(p_actor,d.id)) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  correction:=private.has_dfd_correction(p_actor,p_dfd);
  IF d.status='triagem' AND NOT correction THEN RETURN jsonb_build_object('ok',true,'alreadySent',true); END IF;
  IF NOT private.requester_can_edit_dfd(p_actor,p_dfd) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED: O prazo encerrou. Somente devoluções e correções autorizadas podem ser reenviadas.'; END IF;
  IF (d.status='devolvida' OR correction) AND length(trim(coalesce(p_justification,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED: Explique o que foi corrigido antes de reenviar.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dfd_items WHERE dfd_id=p_dfd) THEN RAISE EXCEPTION 'LAST_ITEM'; END IF;
  PERFORM set_config('app.dfd_actor',p_actor::text,true);
  PERFORM set_config('app.dfd_submission','true',true);
  UPDATE dfds SET status='triagem',versao=coalesce(versao,1)+1 WHERE id=p_dfd;
  IF d.status='devolvida' OR correction THEN
    INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,CASE WHEN correction THEN 'correcao_concluida_apos_dialogo' ELSE 'reenviada_apos_devolucao' END,trim(p_justification));
  ELSE
    SELECT * INTO c FROM governanca_ciclos WHERE ativo IS TRUE LIMIT 1;
    INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,CASE WHEN private.submission_open() THEN 'enviada_para_chefia' WHEN EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE AND role='superadmin') THEN 'enviada_por_superadmin_fora_do_prazo' ELSE 'enviada_fora_do_prazo' END,
      CASE WHEN private.submission_open() THEN 'Enviada dentro do prazo.' WHEN EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE AND role='superadmin') THEN jsonb_build_object('authorization','active_superadmin_role','cycleId',c.id,'reason','Envio administrativo sem restrição de prazo')::text ELSE (SELECT jsonb_build_object('exceptionId',e.id,'reason',e.reason,'expiresAt',e.expires_at)::text FROM submission_exceptions e WHERE e.cycle_id=c.id AND e.user_id=p_actor AND e.revoked_at IS NULL AND e.expires_at>clock_timestamp() ORDER BY e.created_at DESC LIMIT 1) END);
  END IF;
  WITH revoked AS (UPDATE dfd_correction_permissions SET revoked_at=clock_timestamp(),revoked_by=p_actor WHERE dfd_id=p_dfd AND revoked_at IS NULL RETURNING id,cycle_id)
  INSERT INTO submission_permission_events(permission_id,cycle_id,actor_id,user_id,dfd_id,action,details)
  SELECT id,cycle_id,p_actor,p_actor,p_dfd,'correction_completed',jsonb_build_object('reason',p_justification) FROM revoked;
  RETURN jsonb_build_object('ok',true,'alreadySent',false);
END;
$function$;
