-- Separate new submissions from corrections and the chefia review window.
CREATE TABLE public.submission_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.governanca_ciclos(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
  expires_at timestamptz NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id)
);
CREATE INDEX submission_exceptions_lookup ON public.submission_exceptions(cycle_id,user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE public.dfd_correction_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.governanca_ciclos(id),
  dfd_id uuid NOT NULL REFERENCES public.dfds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 2000),
  expires_at timestamptz NOT NULL,
  granted_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id)
);
CREATE INDEX dfd_correction_permissions_lookup ON public.dfd_correction_permissions(dfd_id,user_id,expires_at) WHERE revoked_at IS NULL;
CREATE TABLE public.submission_permission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id uuid NOT NULL,
  cycle_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  user_id uuid NOT NULL,
  dfd_id uuid,
  action text NOT NULL CHECK (action IN ('exception_granted','exception_revoked','correction_granted','correction_revoked','correction_completed')),
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.submission_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dfd_correction_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_permission_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.submission_exceptions,public.dfd_correction_permissions,public.submission_permission_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.submission_exceptions TO authenticated;
GRANT SELECT ON public.dfd_correction_permissions TO authenticated;
GRANT ALL ON public.submission_exceptions TO service_role;
GRANT ALL ON public.dfd_correction_permissions TO service_role;
GRANT ALL ON public.submission_permission_events TO service_role;
CREATE POLICY submission_permission_events_no_client ON public.submission_permission_events FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY submission_exceptions_read ON public.submission_exceptions FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) OR private.app_is_superadmin());
CREATE POLICY dfd_correction_permissions_read ON public.dfd_correction_permissions FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) OR private.dfd_analysis_allowed(auth.uid(),dfd_id));
CREATE TRIGGER submission_permission_events_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON public.submission_permission_events
  FOR EACH STATEMENT EXECUTE FUNCTION private.prevent_dfd_history_mutation();

CREATE OR REPLACE FUNCTION private.submission_open(p_at timestamptz DEFAULT clock_timestamp()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM governanca_ciclos WHERE ativo IS TRUE AND status='aberto'
    AND p_at>=janela_inicio AND p_at<janela_fim);
$$;
CREATE OR REPLACE FUNCTION private.can_submit_new(p_actor uuid,p_at timestamptz DEFAULT clock_timestamp()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM profiles p JOIN governanca_ciclos c ON c.ativo IS TRUE
    WHERE p.id=p_actor AND p.is_active IS TRUE AND c.status='aberto' AND (
      (p_at>=c.janela_inicio AND p_at<c.janela_fim) OR EXISTS(
        SELECT 1 FROM submission_exceptions e WHERE e.cycle_id=c.id AND e.user_id=p_actor
          AND e.revoked_at IS NULL AND p_at<e.expires_at)));
$$;
CREATE OR REPLACE FUNCTION private.has_dfd_correction(p_actor uuid,p_dfd uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM dfd_correction_permissions e JOIN governanca_ciclos c ON c.id=e.cycle_id AND c.ativo IS TRUE
    WHERE e.dfd_id=p_dfd AND e.user_id=p_actor AND e.revoked_at IS NULL AND clock_timestamp()<e.expires_at);
$$;
CREATE OR REPLACE FUNCTION private.requester_can_edit_dfd(p_actor uuid,p_dfd uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM dfds d JOIN profiles p ON p.id=p_actor AND p.is_active IS TRUE
    WHERE d.id=p_dfd AND d.solicitante_id=p_actor AND (
      d.status='devolvida' OR (d.status='rascunho' AND private.can_submit_new(p_actor)) OR
      (d.status='triagem' AND private.has_dfd_correction(p_actor,p_dfd))));
$$;
-- Adjustments and returns remain available throughout the chefia window.
CREATE OR REPLACE FUNCTION private.app_cycle_chefia_edit_open() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT private.app_cycle_chefia_open();
$$;
CREATE OR REPLACE FUNCTION private.chefia_can_edit_dfd(p_actor uuid,p_dfd uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM dfds d WHERE d.id=p_dfd AND d.status='triagem'
    AND private.app_cycle_chefia_open() AND private.dfd_analysis_allowed(p_actor,p_dfd)
    AND NOT EXISTS(SELECT 1 FROM dfd_correction_permissions e WHERE e.dfd_id=p_dfd AND e.revoked_at IS NULL AND clock_timestamp()<e.expires_at));
$$;

-- Replace overly broad campus write permissions; read policies stay intact.
ALTER POLICY dfds_insert_policy ON public.dfds WITH CHECK (
  solicitante_id=(SELECT auth.uid()) AND private.can_submit_new(auth.uid())
  AND status='rascunho' AND (campus_id IS NULL OR campus_id=private.app_user_campus_id() OR private.app_is_superadmin())
);
ALTER POLICY dfds_update_policy ON public.dfds USING (
  private.requester_can_edit_dfd(auth.uid(),id) OR private.chefia_can_edit_dfd(auth.uid(),id)
) WITH CHECK (
  solicitante_id=(SELECT auth.uid()) OR private.dfd_analysis_allowed(auth.uid(),id)
);
ALTER POLICY dfds_delete_policy ON public.dfds USING (
  private.app_is_superadmin() OR (solicitante_id=(SELECT auth.uid()) AND status='rascunho' AND private.can_submit_new(auth.uid()))
);
ALTER POLICY dfd_items_insert_policy ON public.dfd_items WITH CHECK (
  private.requester_can_edit_dfd(auth.uid(),dfd_id) OR private.chefia_can_edit_dfd(auth.uid(),dfd_id)
);
ALTER POLICY dfd_items_update_policy ON public.dfd_items USING (
  private.requester_can_edit_dfd(auth.uid(),dfd_id) OR private.chefia_can_edit_dfd(auth.uid(),dfd_id)
) WITH CHECK (private.requester_can_edit_dfd(auth.uid(),dfd_id) OR private.chefia_can_edit_dfd(auth.uid(),dfd_id));
ALTER POLICY dfd_items_delete_policy ON public.dfd_items USING (
  private.requester_can_edit_dfd(auth.uid(),dfd_id) OR private.chefia_can_edit_dfd(auth.uid(),dfd_id)
);

CREATE OR REPLACE FUNCTION private.guard_submission_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=coalesce(auth.uid(),nullif(current_setting('app.dfd_actor',true),'')::uuid); d dfds%ROWTYPE;
BEGIN
  -- Service routes authenticate their actor. Legacy background maintenance has
  -- no user context; browser writes always carry auth.uid and cannot bypass this.
  IF TG_TABLE_NAME='dfds' THEN
    IF TG_OP='INSERT' THEN
      IF actor IS NULL THEN
        -- Collective conversion by the scoped chefia is not a new personal request.
        IF NEW.origin_type='collective' THEN RETURN NEW; END IF;
        actor:=NEW.solicitante_id;
      END IF;
      IF NEW.solicitante_id IS DISTINCT FROM actor OR NOT private.can_submit_new(actor)
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
$$;
CREATE TRIGGER enforce_submission_dfds BEFORE INSERT OR UPDATE ON public.dfds FOR EACH ROW EXECUTE FUNCTION private.guard_submission_write();
CREATE TRIGGER enforce_submission_items BEFORE INSERT OR UPDATE OR DELETE ON public.dfd_items FOR EACH ROW EXECUTE FUNCTION private.guard_submission_write();

-- Legacy status guard must allow the same explicit corrections/exceptions as
-- the new policy, rather than denying every resubmission after janela_fim.
CREATE OR REPLACE FUNCTION private.app_guard_triagem_cycle_window() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=coalesce(auth.uid(),nullif(current_setting('app.dfd_actor',true),'')::uuid); legacy_service boolean:=auth.role()='service_role' AND auth.uid() IS NULL AND nullif(current_setting('app.dfd_actor',true),'') IS NULL;
BEGIN
  IF NEW.status='triagem' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.origin_type='collective' AND OLD.status='rascunho' AND OLD.collective_origin_room_id::text=coalesce(current_setting('app.collective_conversion',true),'') THEN RETURN NEW; END IF;
    -- Keep the authenticated, ownership-checked legacy server route usable
    -- during promotion; browser writes never qualify for this bridge.
    IF legacy_service THEN
      IF OLD.origin_type='collective' AND OLD.status='rascunho' AND private.app_cycle_chefia_open() AND EXISTS(SELECT 1 FROM dfd_collective_rooms r WHERE r.id=OLD.collective_origin_room_id AND r.created_by=OLD.solicitante_id AND r.status IN ('pronta_para_conversao','proposta')) THEN RETURN NEW; END IF;
      actor:=OLD.solicitante_id;
    END IF;
    IF actor IS NULL OR NOT private.requester_can_edit_dfd(actor,OLD.id) OR (NOT coalesce(legacy_service,false) AND coalesce(current_setting('app.dfd_submission',true),'')<>'true') THEN
      RAISE EXCEPTION 'SUBMISSION_CLOSED: Use o envio formal; o prazo encerrou para novas solicitações sem liberação.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.collective_reviewer(p_actor uuid,p_unit uuid,p_type text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM profiles p WHERE p.id=p_actor AND p.is_active IS TRUE AND
    (p.role IN ('admin','superadmin') OR EXISTS(SELECT 1 FROM user_units u WHERE u.user_id=p_actor AND u.unit_id=p_unit AND u.unit_type=p_type AND u.role_in_unit='chefia')));
$$;
REVOKE ALL ON FUNCTION private.collective_reviewer(uuid,uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.guard_collective_submission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=coalesce(auth.uid(),nullif(current_setting('app.dfd_actor',true),'')::uuid);
BEGIN
  IF actor IS NULL THEN
    IF TG_OP='INSERT' AND NOT private.can_submit_new(NEW.user_id) THEN
      RAISE EXCEPTION 'SUBMISSION_CLOSED: Novas contribuições estão encerradas.';
    END IF;
    RETURN coalesce(NEW,OLD);
  END IF;
  IF TG_OP='UPDATE' AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.unit_id IS DISTINCT FROM OLD.unit_id OR NEW.unit_type IS DISTINCT FROM OLD.unit_type OR NEW.room_id IS DISTINCT FROM OLD.room_id) THEN
    RAISE EXCEPTION 'CONTRIBUTION_IDENTITY_PROTECTED';
  END IF;
  IF TG_OP<>'INSERT' AND private.collective_reviewer(actor,OLD.unit_id,OLD.unit_type) THEN RETURN coalesce(NEW,OLD); END IF;
  IF TG_OP<>'INSERT' AND OLD.user_id=actor AND OLD.status='devolvida' THEN RETURN coalesce(NEW,OLD); END IF;
  IF NOT private.can_submit_new(actor) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED: Novas contribuições estão encerradas.'; END IF;
  RETURN coalesce(NEW,OLD);
END;
$$;
CREATE TRIGGER enforce_submission_contributions BEFORE INSERT OR UPDATE OR DELETE ON public.dfd_collective_contributions
  FOR EACH ROW EXECUTE FUNCTION private.guard_collective_submission();

CREATE OR REPLACE FUNCTION public.write_collective_contribution_with_deadline(p_actor uuid,p_id uuid,p_patch jsonb,p_add boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE room dfd_collective_rooms%ROWTYPE; old_row dfd_collective_contributions%ROWTYPE; new_row dfd_collective_contributions%ROWTYPE; reviewer boolean;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_add THEN
    SELECT * INTO room FROM dfd_collective_rooms WHERE id=(p_patch->>'room_id')::uuid FOR UPDATE;
    IF room.id IS NULL OR room.status<>'aberta' THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
    IF NOT private.can_submit_new(p_actor) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED: Novas contribuições estão encerradas.'; END IF;
    IF p_patch->>'user_id' IS DISTINCT FROM p_actor::text OR p_patch->>'unit_id' IS DISTINCT FROM room.unit_id::text OR p_patch->>'unit_type' IS DISTINCT FROM room.unit_type THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF NOT private.collective_reviewer(p_actor,room.unit_id,room.unit_type) AND NOT EXISTS(SELECT 1 FROM user_units WHERE user_id=p_actor AND unit_id=room.unit_id AND unit_type=room.unit_type) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    SELECT * INTO old_row FROM dfd_collective_contributions WHERE room_id=room.id AND user_id=p_actor AND collective_key=p_patch->>'collective_key' AND status='aberta' FOR UPDATE;
    IF old_row.id IS NOT NULL THEN
      new_row:=jsonb_populate_record(old_row,p_patch || jsonb_build_object('quantidade',old_row.quantidade+(p_patch->>'quantidade')::integer));
    ELSE
      new_row:=jsonb_populate_record(NULL::dfd_collective_contributions,
        jsonb_build_object('has_mixed_expense_classes',false,'has_missing_natureza',false,'requires_natureza_review',false,'adjusted_by_chefia',false,'unidade_medida','UN') || p_patch ||
        jsonb_build_object('id',gen_random_uuid(),'created_at',clock_timestamp(),'updated_at',clock_timestamp(),'status','aberta'));
    END IF;
  ELSE
    -- Lock the room before the contribution, matching conversion and additions.
    SELECT r.* INTO room FROM dfd_collective_rooms r JOIN dfd_collective_contributions x ON x.room_id=r.id WHERE x.id=p_id FOR UPDATE OF r;
    SELECT * INTO old_row FROM dfd_collective_contributions WHERE id=p_id FOR UPDATE;
    IF old_row.id IS NULL OR room.id IS NULL OR room.status IN ('proposta','convertida','arquivada') THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
    reviewer:=private.collective_reviewer(p_actor,old_row.unit_id,old_row.unit_type);
    IF NOT reviewer THEN
      IF old_row.user_id IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
      IF old_row.status<>'devolvida' AND (room.status<>'aberta' OR NOT private.can_submit_new(p_actor)) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED: Somente contribuições devolvidas podem ser corrigidas após o prazo.'; END IF;
      IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) key WHERE key NOT IN ('quantidade','valor_unitario_estimado','justificativa_quantidade','justificativa_item','link_referencia','status','updated_at')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
      IF p_patch ? 'status' AND p_patch->>'status'<>'aberta' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) key WHERE key IN ('id','user_id','unit_id','unit_type','room_id','created_at')) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    new_row:=jsonb_populate_record(old_row,p_patch || jsonb_build_object('updated_at',clock_timestamp()));
  END IF;
  PERFORM set_config('app.dfd_actor',p_actor::text,true);
  IF old_row.id IS NULL THEN
    INSERT INTO dfd_collective_contributions SELECT new_row.* RETURNING * INTO new_row;
  ELSE
    UPDATE dfd_collective_contributions SET quantidade=new_row.quantidade,valor_unitario_estimado=new_row.valor_unitario_estimado,
      justificativa_item=new_row.justificativa_item,justificativa_quantidade=new_row.justificativa_quantidade,link_referencia=new_row.link_referencia,
      status=new_row.status,updated_at=clock_timestamp(),codigo_item_efisco=new_row.codigo_item_efisco,codigo_tce=new_row.codigo_tce,
      codigo_natureza_despesa=new_row.codigo_natureza_despesa,gnd=new_row.gnd,gnd_derivado=new_row.gnd_derivado,efisco_item_id=new_row.efisco_item_id,
      efisco_item_natureza_id=new_row.efisco_item_natureza_id,collective_key=new_row.collective_key,adjusted_by_chefia=new_row.adjusted_by_chefia,
      adjusted_by=new_row.adjusted_by,adjusted_at=new_row.adjusted_at,user_avatar_url=new_row.user_avatar_url WHERE id=old_row.id RETURNING * INTO new_row;
  END IF;
  RETURN to_jsonb(new_row);
END;
$$;
REVOKE ALL ON FUNCTION public.write_collective_contribution_with_deadline(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_collective_contribution_with_deadline(uuid,uuid,jsonb,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_collective_dfd_conversion(p_actor uuid,p_dfd uuid,p_room uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE room dfd_collective_rooms%ROWTYPE; d dfds%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO room FROM dfd_collective_rooms WHERE id=p_room FOR UPDATE;
  SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
  IF room.id IS NULL OR d.id IS NULL OR NOT private.collective_reviewer(p_actor,room.unit_id,room.unit_type) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF room.status NOT IN ('pronta_para_conversao','proposta') OR d.status<>'rascunho' OR d.origin_type IS DISTINCT FROM 'collective' OR d.collective_origin_room_id IS DISTINCT FROM room.id
    OR d.unidade_id IS DISTINCT FROM room.unit_id OR d.tipo_unidade IS DISTINCT FROM room.unit_type OR d.solicitante_id IS DISTINCT FROM room.created_by THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
  IF NOT private.app_cycle_chefia_open() THEN RAISE EXCEPTION 'CALENDAR_CLOSED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dfd_items WHERE dfd_id=d.id) THEN RAISE EXCEPTION 'LAST_ITEM'; END IF;
  IF EXISTS(SELECT 1 FROM dfd_collective_contributions WHERE room_id=room.id AND status='devolvida') THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
  PERFORM set_config('app.dfd_actor',p_actor::text,true);
  PERFORM set_config('app.collective_conversion',room.id::text,true);
  UPDATE dfds SET status='triagem' WHERE id=d.id;
  INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(d.id,p_actor,'conversao_coletiva_encaminhada',jsonb_build_object('roomId',room.id,'requesterId',d.solicitante_id)::text);
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.finish_collective_dfd_conversion(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_collective_dfd_conversion(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION private.guard_submission_draft() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT private.can_submit_new(NEW.user_id) THEN
    RAISE EXCEPTION 'SUBMISSION_CLOSED: O prazo encerrou. Seu rascunho anterior foi preservado.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_submission_drafts BEFORE INSERT OR UPDATE ON public.dfd_drafts FOR EACH ROW EXECUTE FUNCTION private.guard_submission_draft();

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
    'open',private.submission_open(),'canCreate',private.can_submit_new(p_actor),'exception',e,'correction',correction,
    'canEditDfd',private.requester_can_edit_dfd(p_actor,p_dfd),'serverNow',clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION public.manage_submission_permission(p_actor uuid,p_user uuid,p_dfd uuid,p_revoke boolean,p_reason text,p_expires timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c governanca_ciclos%ROWTYPE; d dfds%ROWTYPE; permission uuid; v_kind text;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND is_active IS TRUE) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO c FROM governanca_ciclos WHERE ativo IS TRUE ORDER BY created_at DESC LIMIT 1 FOR SHARE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'NO_ACTIVE_CYCLE'; END IF;
  IF NOT p_revoke AND NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_user AND is_active IS TRUE) THEN RAISE EXCEPTION 'USER_INACTIVE'; END IF;
  IF p_dfd IS NULL THEN
    IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='superadmin') THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(c.id::text||p_user::text,0));
    v_kind:='exception';
  ELSE
    SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
    IF d.id IS NULL OR d.solicitante_id IS DISTINCT FROM p_user OR NOT private.dfd_analysis_allowed(p_actor,p_dfd) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
    IF d.status<>'triagem' OR NOT private.app_cycle_chefia_open() THEN RAISE EXCEPTION 'STATUS_CHANGED'; END IF;
    v_kind:='correction';
  END IF;
  IF length(trim(coalesce(p_reason,'')))<3 OR length(p_reason)>2000 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF NOT p_revoke AND (p_expires IS NULL OR p_expires<=clock_timestamp() OR p_expires>coalesce(c.janela_chefia_fim,c.janela_fim)) THEN
    RAISE EXCEPTION 'INVALID_EXPIRY: A validade deve estar no futuro e dentro do ciclo de análise.';
  END IF;
  IF p_dfd IS NULL THEN
    WITH revoked AS (UPDATE submission_exceptions SET revoked_at=clock_timestamp(),revoked_by=p_actor WHERE cycle_id=c.id AND user_id=p_user AND revoked_at IS NULL RETURNING id)
    INSERT INTO submission_permission_events(permission_id,cycle_id,actor_id,user_id,action,details)
    SELECT id,c.id,p_actor,p_user,'exception_revoked',jsonb_build_object('reason',p_reason) FROM revoked;
    IF NOT p_revoke THEN
      INSERT INTO submission_exceptions(cycle_id,user_id,reason,expires_at,granted_by) VALUES(c.id,p_user,trim(p_reason),p_expires,p_actor) RETURNING id INTO permission;
    END IF;
  ELSE
    WITH revoked AS (UPDATE dfd_correction_permissions SET revoked_at=clock_timestamp(),revoked_by=p_actor WHERE dfd_id=p_dfd AND revoked_at IS NULL RETURNING id)
    INSERT INTO submission_permission_events(permission_id,cycle_id,actor_id,user_id,dfd_id,action,details)
    SELECT id,c.id,p_actor,p_user,p_dfd,'correction_revoked',jsonb_build_object('reason',p_reason) FROM revoked;
    IF NOT p_revoke THEN
      INSERT INTO dfd_correction_permissions(cycle_id,dfd_id,user_id,reason,expires_at,granted_by) VALUES(c.id,p_dfd,p_user,trim(p_reason),p_expires,p_actor) RETURNING id INTO permission;
    END IF;
    INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,CASE WHEN p_revoke THEN 'correcao_revogada' ELSE 'correcao_autorizada_pela_chefia' END,jsonb_build_object('reason',p_reason,'expiresAt',p_expires,'permissionId',permission)::text);
    INSERT INTO notifications(user_id,title,message,type) VALUES(p_user,(CASE WHEN p_revoke THEN 'Autorização de correção encerrada: ' ELSE 'Correção autorizada pela chefia: ' END)||coalesce(d.numero_protocolo,d.id::text),
      jsonb_build_object('body',trim(p_reason),'cta_label','Abrir DFD','cta_url','/dfd/'||d.id::text,'protocol',d.numero_protocolo,'expiresAt',p_expires)::text,'info');
  END IF;
  IF permission IS NOT NULL THEN
    INSERT INTO submission_permission_events(permission_id,cycle_id,actor_id,user_id,dfd_id,action,details) VALUES(permission,c.id,p_actor,p_user,p_dfd,v_kind||'_granted',jsonb_build_object('reason',p_reason,'expiresAt',p_expires));
  END IF;
  RETURN jsonb_build_object('ok',true,'permissionId',permission);
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
    INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,CASE WHEN private.submission_open() THEN 'enviada_para_chefia' ELSE 'enviada_fora_do_prazo' END,
      CASE WHEN private.submission_open() THEN 'Enviada dentro do prazo.' ELSE (SELECT jsonb_build_object('exceptionId',e.id,'reason',e.reason,'expiresAt',e.expires_at)::text FROM submission_exceptions e WHERE e.cycle_id=c.id AND e.user_id=p_actor AND e.revoked_at IS NULL AND e.expires_at>clock_timestamp() ORDER BY e.created_at DESC LIMIT 1) END);
  END IF;
  WITH revoked AS (UPDATE dfd_correction_permissions SET revoked_at=clock_timestamp(),revoked_by=p_actor WHERE dfd_id=p_dfd AND revoked_at IS NULL RETURNING id,cycle_id)
  INSERT INTO submission_permission_events(permission_id,cycle_id,actor_id,user_id,dfd_id,action,details)
  SELECT id,cycle_id,p_actor,p_actor,p_dfd,'correction_completed',jsonb_build_object('reason',p_justification) FROM revoked;
  RETURN jsonb_build_object('ok',true,'alreadySent',false);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_dfd_requester_correction(p_actor uuid,p_dfd uuid,p_revision text,p_object text,p_reason text,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d dfds%ROWTYPE; item jsonb; before_data jsonb; after_data jsonb; total numeric; item_id uuid;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
  IF NOT private.requester_can_edit_dfd(p_actor,p_dfd) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED: A edição exige devolução ou autorização da chefia.'; END IF;
  PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd ORDER BY id FOR UPDATE;
  IF p_revision IS DISTINCT FROM private.dfd_analysis_revision(p_dfd) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
  IF length(trim(coalesce(p_object,'')))<3 OR length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE NOT coalesce((x->>'remove')::boolean,false)) THEN RAISE EXCEPTION 'LAST_ITEM'; END IF;
  IF EXISTS(SELECT 1 FROM dfd_items i WHERE i.dfd_id=p_dfd AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE x->>'id'=i.id::text))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dfd_items i WHERE i.dfd_id=p_dfd AND i.id::text=x->>'id'))
    OR (SELECT count(*) FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'id','') IS NOT NULL)<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'id','') IS NOT NULL) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
  before_data:=jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=p_dfd));
  PERFORM set_config('app.dfd_actor',p_actor::text,true);
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    item_id:=nullif(item->>'id','')::uuid;
    IF coalesce((item->>'remove')::boolean,false) THEN
      IF item_id IS NULL OR length(trim(coalesce(item->>'removalReason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
      DELETE FROM dfd_items WHERE id=item_id AND dfd_id=p_dfd;
    ELSE
      IF (item->>'quantidade') IS NULL OR (item->>'quantidade')!~'^[0-9]+$' OR (item->>'quantidade')::numeric<1 OR (item->>'quantidade')::numeric>2147483647
        OR coalesce((item->>'valor_unitario_estimado')::numeric,0)<=0
        OR length(trim(coalesce(item->>'justificativa_quantidade','')))<3 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
      IF item_id IS NOT NULL THEN
        UPDATE dfd_items SET quantidade=(item->>'quantidade')::integer,valor_unitario_estimado=(item->>'valor_unitario_estimado')::numeric,
          justificativa_quantidade=left(trim(item->>'justificativa_quantidade'),4000),justificativa_item=left(item->>'justificativa_item',4000),
          link_referencia=left(item->>'link_referencia',2000),local_uso=left(item->>'local_uso',1000) WHERE id=item_id AND dfd_id=p_dfd;
      ELSE
        IF nullif(trim(item->>'codigo_tce'),'') IS NULL OR nullif(trim(item->>'descricao'),'') IS NULL THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
        INSERT INTO dfd_items(dfd_id,codigo_tce,codigo_item_efisco,descricao,unidade_medida,quantidade,valor_unitario_estimado,justificativa_quantidade,justificativa_item,link_referencia,local_uso,
          gnd,gnd_derivado,codigo_natureza_despesa,efisco_item_id,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,requires_natureza_review)
        VALUES(p_dfd,item->>'codigo_tce',item->>'codigo_tce',item->>'descricao',item->>'unidade_medida',(item->>'quantidade')::integer,(item->>'valor_unitario_estimado')::numeric,
          left(trim(item->>'justificativa_quantidade'),4000),left(item->>'justificativa_item',4000),left(item->>'link_referencia',2000),left(item->>'local_uso',1000),
          item->>'gnd',item->>'gnd',item->>'codigo_natureza_despesa',(item->>'efisco_item_id')::bigint,item->>'tipo_objeto',item->>'codigo_grupo',item->>'nome_grupo',item->>'codigo_classe',item->>'nome_classe',coalesce((item->>'requires_natureza_review')::boolean,false));
      END IF;
    END IF;
  END LOOP;
  SELECT sum(quantidade*valor_unitario_estimado) INTO total FROM dfd_items WHERE dfd_id=p_dfd;
  UPDATE dfds SET objeto_contratacao=left(trim(p_object),2000),justificativa_contratacao=left(trim(p_reason),10000),valor_total_estimado=total,versao=coalesce(versao,1)+1 WHERE id=p_dfd;
  SELECT jsonb_build_object('dfd',to_jsonb(x),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=x.id)) INTO after_data FROM dfds x WHERE x.id=p_dfd;
  INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,'correcao_salva_pelo_solicitante',jsonb_build_object('before',before_data,'after',after_data,'removals',(SELECT jsonb_agg(x) FROM jsonb_array_elements(p_items) x WHERE coalesce((x->>'remove')::boolean,false)))::text);
  RETURN jsonb_build_object('ok',true,'revision',private.dfd_analysis_revision(p_dfd));
END;
$$;
REVOKE ALL ON FUNCTION public.save_dfd_requester_correction(uuid,uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_dfd_requester_correction(uuid,uuid,text,text,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.dfd_requester_correction_snapshot(p_actor uuid,p_dfd uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d dfds%ROWTYPE;
BEGIN
  IF auth.role()<>'service_role' AND auth.uid() IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT * INTO d FROM dfds WHERE id=p_dfd FOR SHARE;
  IF NOT private.requester_can_edit_dfd(p_actor,p_dfd) THEN RAISE EXCEPTION 'SUBMISSION_CLOSED: A edição exige devolução ou autorização da chefia.'; END IF;
  PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd ORDER BY id FOR SHARE;
  RETURN jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM dfd_items i WHERE i.dfd_id=p_dfd),'revision',private.dfd_analysis_revision(p_dfd));
END;
$$;
REVOKE ALL ON FUNCTION public.dfd_requester_correction_snapshot(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_requester_correction_snapshot(uuid,uuid) TO service_role;

-- Reserve the DFD for the requester while a dialogue correction is authorized.
-- Modify only the proven operation guard, keeping all existing audit/idempotency.
DO $$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.dfd_analysis_operation(uuid,uuid,text,uuid,jsonb)'::regprocedure) INTO definition;
  IF position('CORRECTION_IN_PROGRESS' IN definition)=0 THEN
    IF position('v_revision:=private.dfd_analysis_revision(p_dfd_id);' IN definition)=0 THEN RAISE EXCEPTION 'ANALYSIS_GUARD_NOT_FOUND'; END IF;
    definition:=replace(definition,'v_revision:=private.dfd_analysis_revision(p_dfd_id);',
      'IF p_action<>''delete'' AND EXISTS(SELECT 1 FROM dfd_correction_permissions WHERE dfd_id=p_dfd_id AND revoked_at IS NULL AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION ''CORRECTION_IN_PROGRESS''; END IF; v_revision:=private.dfd_analysis_revision(p_dfd_id);');
    EXECUTE definition;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submission_policy_state(uuid,uuid),public.manage_submission_permission(uuid,uuid,uuid,boolean,text,timestamptz),public.submit_dfd_with_deadline(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submission_policy_state(uuid,uuid),public.manage_submission_permission(uuid,uuid,uuid,boolean,text,timestamptz),public.submit_dfd_with_deadline(uuid,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION private.submission_open(timestamptz),private.can_submit_new(uuid,timestamptz),private.has_dfd_correction(uuid,uuid),private.requester_can_edit_dfd(uuid,uuid),private.chefia_can_edit_dfd(uuid,uuid),private.guard_submission_write(),private.guard_collective_submission(),private.guard_submission_draft() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.can_submit_new(uuid,timestamptz),private.requester_can_edit_dfd(uuid,uuid),private.chefia_can_edit_dfd(uuid,uuid) TO authenticated,service_role;

-- The approved closing day is inclusive in America/Bahia; SQL uses an exclusive
-- boundary at midnight on 03/10. Target only the confirmed current cycle.
UPDATE public.governanca_ciclos SET janela_fim='2026-10-03 00:00:00-03'
WHERE id='334e8564-5984-4969-bcfd-1fafbbdffb85' AND ativo IS TRUE AND janela_fim='2026-10-02 00:00:00-03';
