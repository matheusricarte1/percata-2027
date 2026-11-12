-- A room in construction can become empty; an official DFD must retain an item.
-- Archived contributions remain historical and cannot be edited by this flow.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.admin_apply_correction_items(uuid,uuid,jsonb,boolean)'::regprocedure) INTO definition;
 definition:=replace(definition,
  'IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE NOT coalesce((x->>''remove'')::boolean,false)) THEN',
  'IF NOT p_collective AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE NOT coalesce((x->>''remove'')::boolean,false)) THEN');
 definition:=replace(definition,
  'from %I i where %I=$1'',table_target,parent_field) INTO original USING p_parent;',
  'from %I i where %I=$1%s'',table_target,parent_field,CASE WHEN p_collective THEN '' AND status<>''''arquivada'''''' ELSE '''' END) INTO original USING p_parent;');
 EXECUTE definition;
 SELECT pg_get_functiondef('public.room_admin_correction_snapshot(uuid,uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'FROM dfd_collective_contributions i WHERE i.room_id=p_room)', 'FROM dfd_collective_contributions i WHERE i.room_id=p_room AND i.status<>''arquivada'')');
 EXECUTE definition;
END;
$migration$;
NOTIFY pgrst,'reload schema';
