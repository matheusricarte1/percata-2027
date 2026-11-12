-- A complete item classification is the institutional decision: homologate it
-- atomically as soon as the chefia saves a complete draft.
CREATE OR REPLACE FUNCTION private.auto_homologate_complete_analysis_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_total numeric;
BEGIN
  IF NOT private.app_cycle_chefia_open()
    OR NOT EXISTS (SELECT 1 FROM dfds WHERE id=NEW.dfd_id AND status='triagem')
    OR jsonb_typeof(NEW.payload->'items') IS DISTINCT FROM 'array'
    OR jsonb_array_length(NEW.payload->'items')=0
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.payload->'items') item
      WHERE coalesce((item->>'remove')::boolean,false)
         OR coalesce(item->>'criticidade','') NOT IN ('critica','alta','media','baixa')
         OR coalesce(item->>'moscow_categoria','') NOT IN ('deve_ter','deveria_ter','poderia_ter','nao_tera_agora')
         OR coalesce(item->>'quantidade','') !~ '^[0-9]+$'
         OR (item->>'quantidade')::integer < 1
    ) THEN RETURN NEW; END IF;

  UPDATE dfd_items i SET
    quantidade=(item->>'quantidade')::integer,
    criticidade=item->>'criticidade',
    moscow_categoria=item->>'moscow_categoria',
    is_highlight_item=coalesce((item->>'is_highlight_item')::boolean,false),
    justificativa_quantidade=nullif(trim(item->>'justificativa_quantidade'),'')
  FROM jsonb_array_elements(NEW.payload->'items') item
  WHERE i.dfd_id=NEW.dfd_id AND i.id=(item->>'id')::uuid;

  IF (SELECT count(*) FROM dfd_items WHERE dfd_id=NEW.dfd_id) <> jsonb_array_length(NEW.payload->'items') THEN
    RAISE EXCEPTION 'REVISION_CONFLICT';
  END IF;
  SELECT coalesce(sum(quantidade*valor_unitario_estimado),0) INTO v_total FROM dfd_items WHERE dfd_id=NEW.dfd_id;
  UPDATE dfds SET status='aprovada', valor_total_estimado=v_total, versao=coalesce(versao,1)+1 WHERE id=NEW.dfd_id;
  INSERT INTO dfd_logs(dfd_id,user_id,action,details)
  VALUES(NEW.dfd_id,NEW.actor_id,'aprovada_automatica','Homologação automática após classificação integral de todos os itens.');
  INSERT INTO notifications(user_id,title,message,type)
  SELECT solicitante_id,'DFD homologada automaticamente','A classificação integral da chefia homologou a DFD. Ela seguirá para consolidação institucional.','success'
  FROM dfds WHERE id=NEW.dfd_id;
  DELETE FROM dfd_analysis_drafts WHERE dfd_id=NEW.dfd_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_homologate_complete_analysis_draft ON dfd_analysis_drafts;
CREATE TRIGGER auto_homologate_complete_analysis_draft
AFTER INSERT OR UPDATE OF payload ON dfd_analysis_drafts
FOR EACH ROW EXECUTE FUNCTION private.auto_homologate_complete_analysis_draft();

-- Re-evaluate saved classifications under the same predicate. Incomplete
-- drafts remain untouched; complete ones enter consolidation immediately.
UPDATE dfd_analysis_drafts SET payload=payload WHERE jsonb_typeof(payload->'items')='array';

-- Include campus and the actual sector chefia in the queue presentation.
CREATE OR REPLACE FUNCTION public.dfd_analysis_queue_display(
  p_actor uuid, p_page integer DEFAULT 1, p_search text DEFAULT '', p_all boolean DEFAULT false, p_filter text DEFAULT 'all'
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
WITH base AS (SELECT public.dfd_analysis_queue(p_actor,p_page,p_search,p_all,p_filter) payload)
SELECT jsonb_set(payload,'{people}',coalesce((
  SELECT jsonb_agg(person || jsonb_build_object('avatarUrl',requester.avatar_url,'campus',person_campus.campus,'dfds',person_dfds.dfds) ORDER BY person_index)
  FROM jsonb_array_elements(payload->'people') WITH ORDINALITY people(person,person_index)
  LEFT JOIN profiles requester ON requester.id=NULLIF(person->>'id','')::uuid
  LEFT JOIN LATERAL (SELECT coalesce(c.nome,c.sigla,'Campus não informado') campus FROM jsonb_array_elements(person->'dfds') e(dfd) JOIN dfds d ON d.id=NULLIF(e.dfd->>'id','')::uuid LEFT JOIN campi c ON c.id=d.campus_id ORDER BY d.created_at,d.id LIMIT 1) person_campus ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(jsonb_agg(e.dfd || jsonb_build_object('campus',coalesce(c.nome,c.sigla,'Campus não informado'),'chefiaName',coalesce(chief.full_name,'Chefia não identificada'),'chefiaAvatarUrl',chief.avatar_url) ORDER BY e.ordinality),'[]'::jsonb) dfds
    FROM jsonb_array_elements(person->'dfds') WITH ORDINALITY e(dfd,ordinality)
    JOIN dfds d ON d.id=NULLIF(e.dfd->>'id','')::uuid
    LEFT JOIN campi c ON c.id=d.campus_id
    LEFT JOIN LATERAL (SELECT p.full_name,p.avatar_url FROM user_units uu JOIN profiles p ON p.id=uu.user_id AND p.is_active IS TRUE WHERE uu.role_in_unit='chefia' AND uu.unit_type=coalesce(d.analysis_tipo_unidade,d.tipo_unidade) AND uu.unit_id=coalesce(d.analysis_unidade_id,d.unidade_id) ORDER BY p.full_name LIMIT 1) chief ON true
  ) person_dfds ON true
),'[]'::jsonb),true) FROM base;
$$;
REVOKE ALL ON FUNCTION public.dfd_analysis_queue_display(uuid,integer,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_queue_display(uuid,integer,text,boolean,text) TO service_role;
NOTIFY pgrst,'reload schema';
