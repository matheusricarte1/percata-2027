-- Active superadmins may create and submit in the active cycle, regardless of its window/status.
-- Requester ownership, item validation, routing and formal submission audit remain enforced.
CREATE OR REPLACE FUNCTION private.can_submit_new(p_actor uuid,p_at timestamptz DEFAULT clock_timestamp()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM profiles p JOIN governanca_ciclos c ON c.ativo IS TRUE
    WHERE p.id=p_actor AND p.is_active IS TRUE AND (
      p.role='superadmin' OR (c.status='aberto' AND (
        (p_at>=c.janela_inicio AND p_at<c.janela_fim) OR EXISTS(
          SELECT 1 FROM submission_exceptions e WHERE e.cycle_id=c.id AND e.user_id=p_actor
            AND e.revoked_at IS NULL AND p_at<e.expires_at)))));
$$;

CREATE OR REPLACE FUNCTION public.submission_policy_state(p_actor uuid,p_dfd uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c governanca_ciclos%ROWTYPE; e jsonb; correction jsonb;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM governanca_ciclos WHERE ativo IS TRUE ORDER BY created_at DESC LIMIT 1;
  SELECT to_jsonb(x) INTO e FROM submission_exceptions x WHERE x.cycle_id=c.id AND x.user_id=p_actor AND x.revoked_at IS NULL AND x.expires_at>clock_timestamp() ORDER BY x.created_at DESC LIMIT 1;
  SELECT to_jsonb(x) INTO correction FROM dfd_correction_permissions x WHERE x.cycle_id=c.id AND x.dfd_id=p_dfd AND x.revoked_at IS NULL AND x.expires_at>clock_timestamp()
    AND (x.user_id=p_actor OR private.dfd_analysis_allowed(p_actor,p_dfd)) ORDER BY x.created_at DESC LIMIT 1;
  RETURN jsonb_build_object('cycle',CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('id',c.id,'name',c.nome,'startsAt',c.janela_inicio,'closesAt',c.janela_fim,'chefiaClosesAt',c.janela_chefia_fim) END,
    'superadminAccess',EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE AND role='superadmin'),'open',private.submission_open(),'canCreate',private.can_submit_new(p_actor),'exception',e,'correction',correction,
    'canEditDfd',private.requester_can_edit_dfd(p_actor,p_dfd),'serverNow',clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_dfd_with_deadline(p_actor uuid,p_dfd uuid,p_justification text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d dfds%ROWTYPE; correction boolean; c governanca_ciclos%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
  IF d.id IS NULL OR d.solicitante_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
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
$$;
