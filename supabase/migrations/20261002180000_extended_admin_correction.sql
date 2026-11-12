CREATE OR REPLACE FUNCTION private.admin_can_correct_dfd(p_actor uuid,p_dfd uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles p JOIN dfds d ON d.id=p_dfd WHERE p.id=p_actor AND p.is_active IS TRUE
 AND (p.role='superadmin' OR (p.role='admin' AND p.campus_id=d.campus_id))
 AND d.status IN ('rascunho','triagem','devolvida','aprovada','pactuando'));
$$;
CREATE OR REPLACE FUNCTION private.admin_can_correct_room(p_actor uuid,p_room uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM profiles p JOIN dfd_collective_rooms r ON r.id=p_room WHERE p.id=p_actor AND p.is_active IS TRUE
 AND (p.role='superadmin' OR (p.role='admin' AND p.campus_id=r.campus_id))
 AND r.status IN ('proposta','aberta','em_consolidacao_chefia','pronta_para_conversao'));
$$;
REVOKE ALL ON FUNCTION private.admin_can_correct_room(uuid,uuid) FROM PUBLIC,anon,authenticated;

DO $migration$
DECLARE definition text; start_at integer; end_at integer; addition text;
BEGIN
 SELECT pg_get_functiondef('private.guard_submission_write()'::regprocedure) INTO definition;
 start_at:=position('  IF TG_OP=''UPDATE'' AND auth.role()=' IN definition);
 end_at:=position('  -- Service routes authenticate their actor.' IN definition);
 IF start_at=0 OR end_at<=start_at THEN RAISE EXCEPTION 'Submission guard changed; review required'; END IF;
 addition:=$guard$
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
$guard$;
 EXECUTE substring(definition,1,start_at-1)||addition||substring(definition,end_at);
 SELECT pg_get_functiondef('private.guard_collective_submission()'::regprocedure) INTO definition;
 IF position('app.room_admin_correction' IN definition)=0 THEN
  addition:=$guard$
  IF auth.role()='service_role' AND actor IS NOT NULL AND current_setting('app.room_admin_correction',true)=coalesce(NEW.room_id,OLD.room_id)::text
    AND private.admin_can_correct_room(actor,coalesce(NEW.room_id,OLD.room_id)) THEN
    IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
      OR NEW.unit_type IS DISTINCT FROM OLD.unit_type OR NEW.room_id IS DISTINCT FROM OLD.room_id OR NEW.consolidated_dfd_id IS DISTINCT FROM OLD.consolidated_dfd_id)
    THEN RAISE EXCEPTION 'CONTRIBUTION_IDENTITY_PROTECTED'; END IF;
    RETURN coalesce(NEW,OLD);
  END IF;
$guard$;
  EXECUTE replace(definition,E'BEGIN\n',E'BEGIN\n'||addition);
 END IF;
END;
$migration$;

-- All metadata is resolved from the canonical catalogue inside the transaction.
CREATE OR REPLACE FUNCTION private.admin_apply_correction_items(p_actor uuid,p_parent uuid,p_items jsonb,p_collective boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE table_target text; parent_field text; original jsonb; item jsonb; patch jsonb; catalog jsonb; nature jsonb;
 item_id uuid; columns_sql text; values_sql text; updates_sql text; room dfd_collective_rooms%ROWTYPE; expense_classes integer;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 IF p_collective THEN
  IF NOT private.admin_can_correct_room(p_actor,p_parent) OR current_setting('app.room_admin_correction',true) IS DISTINCT FROM p_parent::text THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  table_target:='dfd_collective_contributions'; parent_field:='room_id'; SELECT * INTO room FROM dfd_collective_rooms WHERE id=p_parent;
 ELSE
  IF NOT private.admin_can_correct_dfd(p_actor,p_parent) OR current_setting('app.dfd_admin_correction',true) IS DISTINCT FROM p_parent::text THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  table_target:='dfd_items'; parent_field:='dfd_id';
 END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 IF jsonb_array_length(p_items)>500 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 EXECUTE format('select coalesce(jsonb_agg(to_jsonb(i)),''[]''::jsonb) from %I i where %I=$1',table_target,parent_field) INTO original USING p_parent;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(original) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) y WHERE y->>'id'=x->>'id'))
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'id','') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original) y WHERE y->>'id'=x->>'id'))
 OR (SELECT count(*) FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'id','') IS NOT NULL)<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_items) x WHERE nullif(x->>'id','') IS NOT NULL)
 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE NOT coalesce((x->>'remove')::boolean,false)) THEN RAISE EXCEPTION 'LAST_ITEM'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  item_id:=nullif(item->>'id','')::uuid;
  IF coalesce((item->>'remove')::boolean,false) THEN
   IF item_id IS NULL OR length(trim(coalesce(item->>'removalReason','')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
   EXECUTE format('delete from %I where id=$1 and %I=$2',table_target,parent_field) USING item_id,p_parent;
   CONTINUE;
  END IF;
  IF jsonb_typeof(item->'quantidade') IS DISTINCT FROM 'number' OR (item->>'quantidade')!~'^[0-9]+$'
   OR (item->>'quantidade')::numeric<1 OR (item->>'quantidade')::numeric>2147483647
   OR jsonb_typeof(item->'valor_unitario_estimado') IS DISTINCT FROM 'number' OR coalesce((item->>'valor_unitario_estimado')::numeric,0)<=0
   OR (item->>'valor_unitario_estimado')::numeric>1e12 THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
  IF coalesce(item->>'link_referencia','')<>'' AND item->>'link_referencia' !~* '^https?://' THEN RAISE EXCEPTION 'INVALID_ITEMS'; END IF;
  patch:=jsonb_build_object('quantidade',(item->>'quantidade')::integer,'valor_unitario_estimado',(item->>'valor_unitario_estimado')::numeric,
   'justificativa_quantidade',nullif(left(item->>'justificativa_quantidade',4000),''),'justificativa_item',nullif(left(item->>'justificativa_item',4000),''),'link_referencia',nullif(left(item->>'link_referencia',2000),''));
  IF NOT p_collective THEN patch:=patch||jsonb_build_object('local_uso',nullif(left(item->>'local_uso',1000),'')); END IF;
  IF nullif(item->>'catalogId','') IS NOT NULL THEN
   SELECT to_jsonb(c) INTO catalog FROM catalogo_efisco_v2 c WHERE c.id=(item->>'catalogId')::bigint;
   IF catalog IS NULL THEN RAISE EXCEPTION 'INVALID_ITEMS: Catálogo não encontrado'; END IF;
   SELECT to_jsonb(n) INTO nature FROM catalogo_item_naturezas_v2 n WHERE n.efisco_item_id=(item->>'catalogId')::bigint
    AND coalesce(n.codigo_natureza_despesa,n.gnd,'SEM_NATUREZA')=item->>'naturezaCode' LIMIT 1;
   IF nature IS NULL AND EXISTS(SELECT 1 FROM catalogo_item_naturezas_v2 n WHERE n.efisco_item_id=(item->>'catalogId')::bigint) THEN RAISE EXCEPTION 'INVALID_ITEMS: Escolha uma natureza vinculada ao código'; END IF;
   patch:=patch||jsonb_build_object('codigo_tce',catalog->>'codigo_efisco','codigo_item_efisco',catalog->>'codigo_efisco','descricao',catalog->>'descricao',
    'unidade_medida',coalesce(nullif(catalog->>'unidade_medida',''),'UN'),'efisco_item_id',(catalog->>'id')::bigint,'efisco_item_natureza_id',(nature->>'efisco_item_natureza_id')::bigint,
    'gnd',coalesce(nature->>'gnd','SEM_NATUREZA'),'gnd_derivado',nature->>'gnd','codigo_natureza_despesa',nature->>'codigo_natureza_despesa',
    'tipo_objeto',catalog->>'tipo_objeto','codigo_grupo',catalog->>'codigo_grupo','nome_grupo',catalog->>'nome_grupo',
    'codigo_classe',catalog->>'codigo_classe','nome_classe',catalog->>'nome_classe','requires_natureza_review',nature IS NULL OR nullif(nature->>'gnd','') IS NULL);
   IF p_collective THEN
    patch:=patch||jsonb_build_object('natureza_count',(catalog->>'natureza_count')::integer,'has_mixed_expense_classes',coalesce((catalog->>'has_mixed_expense_classes')::boolean,false),
      'has_missing_natureza',coalesce((catalog->>'has_missing_natureza')::boolean,false),
      'collective_key',upper(catalog->>'codigo_efisco')||'::'||CASE left(coalesce(nature->>'gnd',''),1) WHEN '3' THEN 'custeio' WHEN '4' THEN 'investimento' ELSE CASE WHEN coalesce(nature->>'gnd','')~'[0-9]' THEN 'outro' ELSE 'sem-gnd' END END||'::'||upper(coalesce(nature->>'gnd','SEM_NATUREZA')));
   ELSE
    patch:=patch||jsonb_build_object('codigo_material_servico',null,'nome_material_servico',null);
   END IF;
  ELSIF item_id IS NULL THEN RAISE EXCEPTION 'INVALID_ITEMS: Escolha o item no catálogo';
  END IF;
  IF p_collective THEN patch:=patch||jsonb_build_object('adjusted_by',p_actor,'adjusted_at',now(),'adjusted_by_chefia',true); END IF;
  IF item_id IS NULL THEN
   patch:=patch||jsonb_build_object('id',gen_random_uuid(),parent_field,p_parent);
   IF p_collective THEN patch:=patch||jsonb_build_object('unit_id',room.unit_id,'unit_type',room.unit_type,'user_id',p_actor,'status','aberta'); END IF;
   SELECT string_agg(format('%I',key),','),string_agg(format('(jsonb_populate_record(NULL::public.%I,$1)).%I',table_target,key),',') INTO columns_sql,values_sql FROM jsonb_object_keys(patch) key;
   EXECUTE format('insert into %I(%s) select %s',table_target,columns_sql,values_sql) USING patch;
  ELSE
   SELECT string_agg(format('%I=(jsonb_populate_record(NULL::public.%I,$1)).%I',key,table_target,key),',') INTO updates_sql FROM jsonb_object_keys(patch) key;
   EXECUTE format('update %I set %s where id=$2 and %I=$3',table_target,updates_sql,parent_field) USING patch,item_id,p_parent;
  END IF;
 END LOOP;
 IF NOT p_collective THEN
  SELECT count(DISTINCT left(gnd,1)) INTO expense_classes FROM dfd_items WHERE dfd_id=p_parent AND left(gnd,1) IN ('3','4');
  IF expense_classes>1 THEN RAISE EXCEPTION 'MIXED_EXPENSE_CLASSES'; END IF;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.admin_apply_correction_items(uuid,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.save_dfd_admin_correction(p_actor uuid,p_dfd uuid,p_revision text,p_object text,p_justification text,p_reason text,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE d dfds%ROWTYPE; before_data jsonb; after_data jsonb; total numeric; old_actor text; old_context text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO d FROM dfds WHERE id=p_dfd FOR UPDATE;
 IF NOT private.admin_can_correct_dfd(p_actor,p_dfd) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM dfd_items WHERE dfd_id=p_dfd ORDER BY id FOR UPDATE;
 IF p_revision IS DISTINCT FROM private.dfd_analysis_revision(p_dfd) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 IF length(trim(coalesce(p_reason,'')))<3 OR length(trim(coalesce(p_object,'')))<3 OR length(trim(coalesce(p_justification,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 before_data:=jsonb_build_object('dfd',to_jsonb(d),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM dfd_items i WHERE i.dfd_id=p_dfd));
 old_actor:=current_setting('app.dfd_actor',true); old_context:=current_setting('app.dfd_admin_correction',true);
 PERFORM set_config('app.dfd_actor',p_actor::text,true); PERFORM set_config('app.dfd_admin_correction',p_dfd::text,true);
 PERFORM private.admin_apply_correction_items(p_actor,p_dfd,p_items,false);
 SELECT sum(quantidade*valor_unitario_estimado) INTO total FROM dfd_items WHERE dfd_id=p_dfd;
 UPDATE dfds SET objeto_contratacao=left(trim(p_object),2000),justificativa_contratacao=left(trim(p_justification),10000),valor_total_estimado=total,versao=coalesce(versao,1)+1 WHERE id=p_dfd;
 SELECT jsonb_build_object('dfd',to_jsonb(x),'items',(SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=p_dfd)) INTO after_data FROM dfds x WHERE x.id=p_dfd;
 INSERT INTO dfd_logs(dfd_id,user_id,action,details) VALUES(p_dfd,p_actor,'correcao_administrativa',jsonb_build_object('reason',trim(p_reason),'before',before_data,'after',after_data,'removals',(SELECT jsonb_agg(x) FROM jsonb_array_elements(p_items) x WHERE coalesce((x->>'remove')::boolean,false)))::text);
 -- Keep the converted room navigation consistent with the official DFD's new expense class.
 UPDATE dfd_collective_room_dfds SET expense_class=CASE WHEN EXISTS(SELECT 1 FROM dfd_items WHERE dfd_id=p_dfd AND left(gnd,1)='4') THEN 'investimento' WHEN EXISTS(SELECT 1 FROM dfd_items WHERE dfd_id=p_dfd AND left(gnd,1)='3') THEN 'custeio' ELSE 'sem-gnd' END WHERE dfd_id=p_dfd;
 PERFORM set_config('app.dfd_actor',coalesce(old_actor,''),true); PERFORM set_config('app.dfd_admin_correction',coalesce(old_context,''),true);
 RETURN jsonb_build_object('ok',true,'revision',private.dfd_analysis_revision(p_dfd),'total',total);
END;
$$;

CREATE OR REPLACE FUNCTION private.admin_room_revision(p_room uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT md5(jsonb_build_object('dfd',to_jsonb(r),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM dfd_collective_contributions i WHERE i.room_id=p_room))::text) FROM dfd_collective_rooms r WHERE r.id=p_room;
$$;
REVOKE ALL ON FUNCTION private.admin_room_revision(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.room_admin_correction_snapshot(p_actor uuid,p_room uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r dfd_collective_rooms%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO r FROM dfd_collective_rooms WHERE id=p_room FOR SHARE;
 IF NOT private.admin_can_correct_room(p_actor,p_room) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM dfd_collective_contributions WHERE room_id=p_room ORDER BY id FOR SHARE;
 RETURN jsonb_build_object('dfd',jsonb_build_object('objeto_contratacao',r.title,'justificativa_contratacao',r.description),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('author_name',(SELECT full_name FROM profiles WHERE id=i.user_id)) ORDER BY i.id),'[]'::jsonb) FROM dfd_collective_contributions i WHERE i.room_id=p_room),'revision',private.admin_room_revision(p_room));
END;
$$;
CREATE OR REPLACE FUNCTION public.save_room_admin_correction(p_actor uuid,p_room uuid,p_revision text,p_object text,p_justification text,p_reason text,p_items jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r dfd_collective_rooms%ROWTYPE; before_data jsonb; after_data jsonb; old_actor text; old_context text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT * INTO r FROM dfd_collective_rooms WHERE id=p_room FOR UPDATE;
 IF NOT private.admin_can_correct_room(p_actor,p_room) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 PERFORM 1 FROM dfd_collective_contributions WHERE room_id=p_room ORDER BY id FOR UPDATE;
 IF p_revision IS DISTINCT FROM private.admin_room_revision(p_room) THEN RAISE EXCEPTION 'REVISION_CONFLICT'; END IF;
 IF length(trim(coalesce(p_reason,'')))<3 OR length(trim(coalesce(p_object,'')))<3 OR length(trim(coalesce(p_justification,'')))<3 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
 before_data:=jsonb_build_object('dfd',to_jsonb(r),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM dfd_collective_contributions i WHERE i.room_id=p_room));
 old_actor:=current_setting('app.dfd_actor',true); old_context:=current_setting('app.room_admin_correction',true);
 PERFORM set_config('app.dfd_actor',p_actor::text,true); PERFORM set_config('app.room_admin_correction',p_room::text,true);
 PERFORM private.admin_apply_correction_items(p_actor,p_room,p_items,true);
 UPDATE dfd_collective_rooms SET title=left(trim(p_object),160),description=left(trim(p_justification),4000),updated_at=now() WHERE id=p_room;
 SELECT jsonb_build_object('dfd',to_jsonb(x),'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]'::jsonb) FROM dfd_collective_contributions i WHERE i.room_id=p_room)) INTO after_data FROM dfd_collective_rooms x WHERE x.id=p_room;
 INSERT INTO dfd_collective_room_events(room_id,actor_id,event_type,message,metadata) VALUES(p_room,p_actor,'correcao_administrativa',
  'Correção administrativa por '||coalesce((SELECT full_name FROM profiles WHERE id=p_actor),p_actor::text)||': '||left(trim(p_reason),2000),
  jsonb_build_object('reason',trim(p_reason),'before',before_data,'after',after_data,'removals',(SELECT jsonb_agg(x) FROM jsonb_array_elements(p_items) x WHERE coalesce((x->>'remove')::boolean,false))));
 PERFORM set_config('app.dfd_actor',coalesce(old_actor,''),true); PERFORM set_config('app.room_admin_correction',coalesce(old_context,''),true);
 RETURN jsonb_build_object('ok',true,'revision',private.admin_room_revision(p_room));
END;
$$;
REVOKE ALL ON FUNCTION public.room_admin_correction_snapshot(uuid,uuid),public.save_room_admin_correction(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.room_admin_correction_snapshot(uuid,uuid),public.save_room_admin_correction(uuid,uuid,text,text,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
