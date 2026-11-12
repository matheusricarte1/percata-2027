-- Presentation enrichment only. Scope and authorization remain enforced by the existing analysis functions.
CREATE OR REPLACE FUNCTION public.dfd_analysis_queue_display(
  p_actor uuid, p_page integer DEFAULT 1, p_search text DEFAULT '',
  p_all boolean DEFAULT false, p_filter text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH base AS (
    SELECT public.dfd_analysis_queue(p_actor, p_page, p_search, p_all, p_filter) AS payload
  ), enriched AS (
    SELECT jsonb_set(
      payload,
      '{people}',
      COALESCE((
        SELECT jsonb_agg(
          person || jsonb_build_object('avatarUrl', profile.avatar_url)
          ORDER BY person_index
        )
        FROM jsonb_array_elements(payload->'people') WITH ORDINALITY AS people(person, person_index)
        LEFT JOIN profiles profile
          ON profile.id = NULLIF(person->>'id', '')::uuid
      ), '[]'::jsonb),
      true
    ) AS payload
    FROM base
  )
  SELECT payload FROM enriched;
$$;

CREATE OR REPLACE FUNCTION public.dfd_analysis_detail_display(
  p_actor uuid, p_dfd_id uuid
) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH base AS (
    SELECT public.dfd_analysis_detail(p_actor, p_dfd_id) AS payload
  )
  SELECT CASE
    WHEN payload IS NULL THEN NULL
    ELSE jsonb_set(
      payload,
      '{dfd}',
      (payload->'dfd') || jsonb_build_object('requesterAvatarUrl', profile.avatar_url),
      true
    )
  END
  FROM base
  LEFT JOIN profiles profile
    ON profile.id = NULLIF(base.payload->'dfd'->>'requesterId', '')::uuid;
$$;

REVOKE ALL ON FUNCTION public.dfd_analysis_queue_display(uuid,integer,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_queue_display(uuid,integer,text,boolean,text) TO service_role;
REVOKE ALL ON FUNCTION public.dfd_analysis_detail_display(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dfd_analysis_detail_display(uuid,uuid) TO service_role;
