-- Read-only queue and focused detail. Existing workspace/decision RPCs remain compatible.
CREATE OR REPLACE FUNCTION public.dfd_analysis_queue(
  p_actor uuid, p_page integer DEFAULT 1, p_search text DEFAULT '',
  p_all boolean DEFAULT false, p_filter text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_search text:=lower(trim(coalesce(p_search,''))); v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id=p_actor AND is_active IS TRUE;
  IF v_role IS NULL OR v_role NOT IN ('chefia','superadmin') THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE='42501';
  END IF;
  IF p_page IS NULL OR p_page<1 OR p_page>1000000 OR length(v_search)>200 OR
    p_filter IS NULL OR p_filter NOT IN ('all','pending','changed','removal') THEN
    RAISE EXCEPTION 'Parâmetros da fila inválidos.' USING ERRCODE='22023';
  END IF;

  WITH scoped AS MATERIALIZED (
    SELECT d.id,d.solicitante_id,d.numero_protocolo,d.objeto_contratacao,d.status,
      d.created_at,d.valor_total_estimado,
      coalesce(p.full_name,'Solicitante') AS requester,
      coalesce(d.analysis_tipo_unidade,d.tipo_unidade)::text || ':' ||
        coalesce(d.analysis_unidade_id,d.unidade_id)::text AS sector_id,
      coalesce(CASE WHEN coalesce(d.analysis_tipo_unidade,d.tipo_unidade)='laboratorio'
        THEN lab.nome ELSE dep.nome END,'Sem setor') AS sector,
      dr.dfd_id IS NOT NULL AS has_draft,dr.updated_at AS draft_updated_at,
      CASE WHEN jsonb_typeof(dr.payload->'items')='array' THEN dr.payload->'items'
        ELSE NULL END AS draft_items
    FROM dfds d
    LEFT JOIN profiles p ON p.id=d.solicitante_id
    LEFT JOIN departamentos dep ON dep.id=coalesce(d.analysis_unidade_id,d.unidade_id)
    LEFT JOIN laboratorios lab ON lab.id=coalesce(d.analysis_unidade_id,d.unidade_id)
    LEFT JOIN dfd_analysis_drafts dr ON dr.dfd_id=d.id AND dr.actor_id=p_actor
    WHERE private.dfd_analysis_allowed(p_actor,d.id)
      AND (d.status='triagem' OR (p_all AND v_role='superadmin'))
  ), summaries AS MATERIALIZED (
    SELECT s.*,metrics.*,
      strpos(lower(concat_ws(' ',s.requester,s.sector,s.numero_protocolo,s.objeto_contratacao)),v_search)>0
        OR jsonb_array_length(metrics.matched_item_ids)>0 AS search_match
    FROM scoped s
    CROSS JOIN LATERAL (
      WITH originals AS MATERIALIZED (
        SELECT i.id,to_jsonb(i) AS item FROM dfd_items i WHERE i.dfd_id=s.id
      ), effective AS (
        SELECT x AS item,o.item AS original
        FROM jsonb_array_elements(coalesce(s.draft_items,
          (SELECT jsonb_agg(item ORDER BY id) FROM originals),'[]'::jsonb)) x
        LEFT JOIN originals o ON o.id::text=x->>'id'
      ), classified AS (
        SELECT e.*,coalesce(item->'remove'='true'::jsonb,false) AS removed,
          CASE WHEN jsonb_typeof(item->'quantidade')='number' THEN (item->>'quantidade')::numeric ELSE 0 END AS quantity,
          CASE WHEN jsonb_typeof(item->'valor_unitario_estimado')='number' THEN (item->>'valor_unitario_estimado')::numeric ELSE 0 END AS price,
          v_search<>'' AND (strpos(lower(concat_ws(' ',item->>'descricao',item->>'codigo_tce')),v_search)>0
            OR strpos(lower(concat_ws(' ',original->>'descricao',original->>'codigo_tce')),v_search)>0) AS item_match
        FROM effective e
      )
      SELECT count(*)::integer AS item_count,
        count(*) FILTER(WHERE NOT removed)::integer AS retained_count,
        count(*) FILTER(WHERE NOT removed AND coalesce(item->>'moscow_categoria','') NOT IN
          ('deve_ter','deveria_ter','poderia_ter','nao_tera_agora'))::integer AS missing_priority,
        count(*) FILTER(WHERE NOT removed AND coalesce(item->>'criticidade','') NOT IN
          ('critica','alta','media','baixa'))::integer AS missing_impact,
        count(*) FILTER(WHERE removed)::integer AS removed_count,
        count(*) FILTER(WHERE removed OR original IS NULL OR length(trim(coalesce(item->>'correctionNote','')))>0 OR coalesce(item->>'justificativa_quantidade','') IS DISTINCT FROM coalesce(original->>'justificativa_quantidade','') OR
          jsonb_build_array(item->'quantidade',item->'valor_unitario_estimado',item->'moscow_categoria',item->'criticidade',coalesce(item->'is_highlight_item','false'::jsonb))
          IS DISTINCT FROM jsonb_build_array(original->'quantidade',original->'valor_unitario_estimado',original->'moscow_categoria',original->'criticidade',coalesce(original->'is_highlight_item','false'::jsonb)))::integer AS changed_count,
        coalesce(sum(quantity*price) FILTER(WHERE NOT removed),0) AS proposed_total,
        coalesce(jsonb_agg(item->>'id' ORDER BY item->>'id') FILTER(WHERE item_match AND original IS NOT NULL),'[]'::jsonb) AS matched_item_ids
      FROM classified
    ) metrics
  ), filtered AS MATERIALIZED (
    SELECT * FROM summaries WHERE search_match AND
      (p_filter='all' OR (p_filter='pending' AND (missing_priority>0 OR missing_impact>0))
       OR (p_filter='changed' AND changed_count>0) OR (p_filter='removal' AND removed_count>0))
  ), people AS (
    SELECT solicitante_id,min(requester) AS name FROM filtered GROUP BY solicitante_id
  ), page_people AS (
    SELECT * FROM people ORDER BY lower(name),solicitante_id LIMIT 25 OFFSET ((p_page-1)*25)
  )
  SELECT jsonb_build_object(
    'actorId',p_actor,'role',v_role,
    'calendar',(SELECT jsonb_build_object('open',private.app_cycle_chefia_open(),
      'start',janela_chefia_inicio,'end',janela_chefia_fim) FROM governanca_ciclos WHERE ativo IS TRUE LIMIT 1),
    'page',p_page,'pageSize',25,'totalPeople',(SELECT count(*) FROM people),
    'totalDfds',(SELECT count(*) FROM filtered),
    'totals',(SELECT jsonb_build_object('items',coalesce(sum(item_count),0),
      'retainedItems',coalesce(sum(retained_count),0),'missingPriority',coalesce(sum(missing_priority),0),
      'missingImpact',coalesce(sum(missing_impact),0),'changedItems',coalesce(sum(changed_count),0),
      'removedItems',coalesce(sum(removed_count),0),'proposedTotal',coalesce(sum(proposed_total),0)) FROM filtered),
    'people',coalesce((SELECT jsonb_agg(jsonb_build_object('id',pp.solicitante_id,'name',pp.name,
      'sectors',(SELECT jsonb_agg(sector ORDER BY sector) FROM (SELECT DISTINCT sector FROM filtered f WHERE f.solicitante_id=pp.solicitante_id) sectors),
      'dfds',(SELECT jsonb_agg(jsonb_build_object(
        'id',f.id,'requesterId',f.solicitante_id,'requester',f.requester,
        'sectorId',coalesce(f.sector_id,'unknown:'||f.id::text),'sector',f.sector,
        'numero_protocolo',f.numero_protocolo,'objeto_contratacao',f.objeto_contratacao,
        'status',f.status,'created_at',f.created_at,'valor_total_estimado',f.valor_total_estimado,
        'proposedTotal',f.proposed_total,'itemCount',f.item_count,'retainedCount',f.retained_count,
        'missingPriority',f.missing_priority,'missingImpact',f.missing_impact,
        'changedCount',f.changed_count,'removedCount',f.removed_count,
        'hasDraft',f.has_draft,'draftUpdatedAt',f.draft_updated_at,'matchedItemIds',f.matched_item_ids
      ) ORDER BY f.created_at,f.id) FROM filtered f WHERE f.solicitante_id=pp.solicitante_id)
    ) ORDER BY lower(pp.name),pp.solicitante_id) FROM page_people pp),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_detail(p_actor uuid,p_dfd_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_result jsonb;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id=p_actor AND is_active IS TRUE;
  IF v_role IS NULL OR v_role NOT IN ('chefia','superadmin') THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE='42501';
  END IF;
  SELECT jsonb_build_object('actorId',p_actor,'role',v_role,
    'calendar',(SELECT jsonb_build_object('open',private.app_cycle_chefia_open(),
      'start',janela_chefia_inicio,'end',janela_chefia_fim) FROM governanca_ciclos WHERE ativo IS TRUE LIMIT 1),
    'dfd',to_jsonb(d)||jsonb_build_object(
      'requester',coalesce(p.full_name,'Solicitante'),'requesterId',d.solicitante_id,
      'sectorId',coalesce(coalesce(d.analysis_tipo_unidade,d.tipo_unidade)::text||':'||coalesce(d.analysis_unidade_id,d.unidade_id)::text,'unknown:'||d.id::text),
      'sector',coalesce(CASE WHEN coalesce(d.analysis_tipo_unidade,d.tipo_unidade)='laboratorio' THEN lab.nome ELSE dep.nome END,'Sem setor'),
      'revision',private.dfd_analysis_revision(d.id),
      'items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM dfd_items i WHERE i.dfd_id=d.id),'[]'::jsonb),
      'draft',(SELECT to_jsonb(dr) FROM dfd_analysis_drafts dr WHERE dr.dfd_id=d.id AND dr.actor_id=p_actor)
    )) INTO v_result
  FROM dfds d
  LEFT JOIN profiles p ON p.id=d.solicitante_id
  LEFT JOIN departamentos dep ON dep.id=coalesce(d.analysis_unidade_id,d.unidade_id)
  LEFT JOIN laboratorios lab ON lab.id=coalesce(d.analysis_unidade_id,d.unidade_id)
  WHERE d.id=p_dfd_id AND private.dfd_analysis_allowed(p_actor,d.id)
    AND (d.status='triagem' OR v_role='superadmin');
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.dfd_analysis_queue(uuid,integer,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_queue(uuid,integer,text,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.dfd_analysis_detail(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_detail(uuid,uuid) TO service_role;
