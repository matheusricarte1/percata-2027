-- The queue already has the campus id in each DFD, but its display payload
-- omitted the campus label.  Keep scope in the underlying queue and enrich
-- only its presentation data here.
CREATE OR REPLACE FUNCTION public.dfd_analysis_queue_display(
  p_actor uuid, p_page integer DEFAULT 1, p_search text DEFAULT '',
  p_all boolean DEFAULT false, p_filter text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH base AS (
    SELECT public.dfd_analysis_queue(p_actor, p_page, p_search, p_all, p_filter) AS payload
  )
  SELECT jsonb_set(
    payload,
    '{people}',
    COALESCE((
      SELECT jsonb_agg(
        person || jsonb_build_object(
          'avatarUrl', profile.avatar_url,
          'campus', campus_label.campus,
          'dfds', person_dfds.dfds
        )
        ORDER BY person_index
      )
      FROM jsonb_array_elements(payload->'people') WITH ORDINALITY AS people(person, person_index)
      LEFT JOIN profiles profile ON profile.id = NULLIF(person->>'id', '')::uuid
      LEFT JOIN LATERAL (
        SELECT COALESCE(c.nome, c.sigla, 'Campus não informado') AS campus
        FROM jsonb_array_elements(person->'dfds') AS entries(dfd)
        JOIN dfds d ON d.id = NULLIF(entries.dfd->>'id', '')::uuid
        LEFT JOIN campi c ON c.id = d.campus_id
        ORDER BY d.created_at, d.id
        LIMIT 1
      ) campus_label ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(
          entries.dfd || jsonb_build_object('campus', COALESCE(c.nome, c.sigla, 'Campus não informado'))
          ORDER BY entries.ordinality
        ), '[]'::jsonb) AS dfds
        FROM jsonb_array_elements(person->'dfds') WITH ORDINALITY AS entries(dfd, ordinality)
        LEFT JOIN dfds d ON d.id = NULLIF(entries.dfd->>'id', '')::uuid
        LEFT JOIN campi c ON c.id = d.campus_id
      ) person_dfds ON true
    ), '[]'::jsonb),
    true
  )
  FROM base;
$$;

REVOKE ALL ON FUNCTION public.dfd_analysis_queue_display(uuid,integer,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_queue_display(uuid,integer,text,boolean,text) TO service_role;
NOTIFY pgrst,'reload schema';
