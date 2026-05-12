-- Migration: 20260424013000_legacy_profile_mapping_safe_rollout.sql
-- Description: Safe rollout for legacy users as active users (mapping + unified views + pending validation)
-- Author: Codex
-- Date: 2026-04-24

CREATE TABLE IF NOT EXISTS public.legacy_user_profile_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_user_id UUID NULL REFERENCES public.legacy_user_directory(id) ON DELETE SET NULL,
  legacy_email TEXT NOT NULL UNIQUE,
  profile_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  profile_email TEXT NULL,
  link_source TEXT NOT NULL DEFAULT 'email_exact'
    CHECK (link_source IN ('email_exact', 'manual', 'pending_review', 'demand_link_only')),
  link_state TEXT NOT NULL DEFAULT 'active'
    CHECK (link_state IN ('active', 'inactive')),
  notes TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT legacy_user_profile_links_legacy_email_lower_chk
    CHECK (legacy_email = lower(trim(legacy_email))),
  CONSTRAINT legacy_user_profile_links_profile_email_lower_chk
    CHECK (profile_email IS NULL OR profile_email = lower(trim(profile_email)))
);

CREATE INDEX IF NOT EXISTS idx_legacy_user_profile_links_profile_id
  ON public.legacy_user_profile_links (profile_id);

CREATE INDEX IF NOT EXISTS idx_legacy_user_profile_links_legacy_user_id
  ON public.legacy_user_profile_links (legacy_user_id);

CREATE OR REPLACE FUNCTION public.set_legacy_user_profile_links_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_legacy_user_profile_links_updated_at
ON public.legacy_user_profile_links;

CREATE TRIGGER trg_legacy_user_profile_links_updated_at
BEFORE UPDATE ON public.legacy_user_profile_links
FOR EACH ROW
EXECUTE FUNCTION public.set_legacy_user_profile_links_updated_at();

ALTER TABLE public.legacy_user_profile_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legacy_user_profile_links_select_policy
ON public.legacy_user_profile_links;
CREATE POLICY legacy_user_profile_links_select_policy
ON public.legacy_user_profile_links
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR profile_id = auth.uid()
  OR legacy_email = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS legacy_user_profile_links_insert_policy
ON public.legacy_user_profile_links;
CREATE POLICY legacy_user_profile_links_insert_policy
ON public.legacy_user_profile_links
FOR INSERT
WITH CHECK (is_legacy_pa_admin());

DROP POLICY IF EXISTS legacy_user_profile_links_update_policy
ON public.legacy_user_profile_links;
CREATE POLICY legacy_user_profile_links_update_policy
ON public.legacy_user_profile_links
FOR UPDATE
USING (is_legacy_pa_admin())
WITH CHECK (is_legacy_pa_admin());

DROP POLICY IF EXISTS legacy_user_profile_links_delete_policy
ON public.legacy_user_profile_links;
CREATE POLICY legacy_user_profile_links_delete_policy
ON public.legacy_user_profile_links
FOR DELETE
USING (is_legacy_pa_admin());

-- Backfill mapping from legacy user directory (email-exact, idempotent).
WITH profile_email_stats AS (
  SELECT
    lower(trim(p.email)) AS email_norm,
    min(p.id::text)::uuid AS profile_id,
    min(p.email) AS profile_email,
    count(*) AS profile_count
  FROM public.profiles p
  WHERE p.email IS NOT NULL
    AND trim(p.email) <> ''
  GROUP BY lower(trim(p.email))
)
INSERT INTO public.legacy_user_profile_links (
  legacy_user_id,
  legacy_email,
  profile_id,
  profile_email,
  link_source,
  link_state
)
SELECT
  lud.id,
  lower(trim(lud.email)) AS legacy_email,
  CASE WHEN pes.profile_count = 1 THEN pes.profile_id ELSE NULL END AS profile_id,
  CASE WHEN pes.profile_count = 1 THEN lower(trim(pes.profile_email)) ELSE NULL END AS profile_email,
  CASE WHEN pes.profile_count = 1 THEN 'email_exact' ELSE 'pending_review' END AS link_source,
  'active' AS link_state
FROM public.legacy_user_directory lud
LEFT JOIN profile_email_stats pes
  ON pes.email_norm = lower(trim(lud.email))
WHERE lud.email IS NOT NULL
  AND trim(lud.email) <> ''
ON CONFLICT (legacy_email)
DO UPDATE
SET
  legacy_user_id = COALESCE(EXCLUDED.legacy_user_id, public.legacy_user_profile_links.legacy_user_id),
  profile_id = COALESCE(public.legacy_user_profile_links.profile_id, EXCLUDED.profile_id),
  profile_email = COALESCE(public.legacy_user_profile_links.profile_email, EXCLUDED.profile_email),
  updated_at = now();

-- Ensure demand-link emails are represented in mapping table too.
INSERT INTO public.legacy_user_profile_links (
  legacy_email,
  link_source,
  link_state
)
SELECT DISTINCT
  lower(trim(l.user_email)) AS legacy_email,
  'demand_link_only' AS link_source,
  'active' AS link_state
FROM public.legacy_demand_user_links l
WHERE l.user_email IS NOT NULL
  AND trim(l.user_email) <> ''
ON CONFLICT (legacy_email) DO NOTHING;

-- Auto-complete mapping where there is a single matching profile and no profile linked yet.
WITH profile_email_stats AS (
  SELECT
    lower(trim(p.email)) AS email_norm,
    min(p.id::text)::uuid AS profile_id,
    min(p.email) AS profile_email,
    count(*) AS profile_count
  FROM public.profiles p
  WHERE p.email IS NOT NULL
    AND trim(p.email) <> ''
  GROUP BY lower(trim(p.email))
)
UPDATE public.legacy_user_profile_links lup
SET
  profile_id = pes.profile_id,
  profile_email = lower(trim(pes.profile_email)),
  link_source = CASE
    WHEN lup.link_source = 'demand_link_only' THEN 'email_exact'
    ELSE lup.link_source
  END,
  updated_at = now()
FROM profile_email_stats pes
WHERE lup.profile_id IS NULL
  AND lup.legacy_email = pes.email_norm
  AND pes.profile_count = 1;

-- Harden legacy visibility rules to support mapped legacy e-mails.
DROP POLICY IF EXISTS legacy_user_directory_select_policy ON public.legacy_user_directory;
CREATE POLICY legacy_user_directory_select_policy
ON public.legacy_user_directory
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup
    WHERE lup.link_state = 'active'
      AND lup.profile_id = auth.uid()
      AND lup.legacy_email = lower(public.legacy_user_directory.email)
  )
);

DROP POLICY IF EXISTS legacy_demand_user_links_select_policy ON public.legacy_demand_user_links;
CREATE POLICY legacy_demand_user_links_select_policy
ON public.legacy_demand_user_links
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup
    WHERE lup.link_state = 'active'
      AND lup.profile_id = auth.uid()
      AND lup.legacy_email = lower(public.legacy_demand_user_links.user_email)
  )
);

DROP POLICY IF EXISTS legacy_pa_demandas_select_policy ON public.legacy_pa_demandas;
CREATE POLICY legacy_pa_demandas_select_policy
ON public.legacy_pa_demandas
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup_req
    WHERE lup_req.link_state = 'active'
      AND lup_req.profile_id = auth.uid()
      AND lup_req.legacy_email = lower(coalesce(public.legacy_pa_demandas.requester_email, ''))
  )
  OR EXISTS (
    SELECT 1
    FROM public.legacy_pa_itens i
    WHERE i.legacy_year = public.legacy_pa_demandas.legacy_year
      AND i.demand_code = public.legacy_pa_demandas.demand_code
      AND (
        lower(coalesce(i.fiscal_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
        OR EXISTS (
          SELECT 1
          FROM public.legacy_user_profile_links lup_item
          WHERE lup_item.link_state = 'active'
            AND lup_item.profile_id = auth.uid()
            AND lup_item.legacy_email = lower(coalesce(i.fiscal_email, ''))
        )
      )
  )
);

DROP POLICY IF EXISTS legacy_pa_itens_select_policy ON public.legacy_pa_itens;
CREATE POLICY legacy_pa_itens_select_policy
ON public.legacy_pa_itens
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(coalesce(fiscal_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup_item
    WHERE lup_item.link_state = 'active'
      AND lup_item.profile_id = auth.uid()
      AND lup_item.legacy_email = lower(coalesce(public.legacy_pa_itens.fiscal_email, ''))
  )
  OR EXISTS (
    SELECT 1
    FROM public.legacy_demand_user_links l
    WHERE l.legacy_year = public.legacy_pa_itens.legacy_year
      AND l.demand_code = public.legacy_pa_itens.demand_code
      AND l.link_role = 'fiscal'
      AND (
        lower(l.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        OR EXISTS (
          SELECT 1
          FROM public.legacy_user_profile_links lup_link
          WHERE lup_link.link_state = 'active'
            AND lup_link.profile_id = auth.uid()
            AND lup_link.legacy_email = lower(l.user_email)
        )
      )
  )
);

-- Compatibility view (same contract as v2) with mapped e-mail access.
CREATE OR REPLACE VIEW public.legacy_pa_minhas_demandas_v2
WITH (security_invoker = true)
AS
SELECT
  d.legacy_year,
  d.demand_code,
  d.campus,
  d.status,
  d.object,
  d.total_estimated,
  count(i.id) AS items_count
FROM public.legacy_pa_demandas d
JOIN public.legacy_demand_user_links l
  ON l.legacy_year = d.legacy_year
 AND l.demand_code = d.demand_code
 AND l.link_role = 'fiscal'
LEFT JOIN public.legacy_pa_itens i
  ON i.legacy_year = d.legacy_year
 AND i.demand_code = d.demand_code
WHERE
  lower(l.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup
    WHERE lup.link_state = 'active'
      AND lup.profile_id = auth.uid()
      AND lup.legacy_email = lower(l.user_email)
  )
GROUP BY
  d.legacy_year,
  d.demand_code,
  d.campus,
  d.status,
  d.object,
  d.total_estimated;

-- Unified audit view for legacy-user mapping.
CREATE OR REPLACE VIEW public.legacy_user_links_validation_v1
WITH (security_invoker = true)
AS
WITH source_emails AS (
  SELECT
    lower(trim(lud.email)) AS legacy_email,
    max(lud.server_name) AS legacy_name,
    true AS from_directory,
    count(*) AS directory_rows,
    0::bigint AS demand_links_count
  FROM public.legacy_user_directory lud
  WHERE lud.email IS NOT NULL
    AND trim(lud.email) <> ''
  GROUP BY lower(trim(lud.email))

  UNION ALL

  SELECT
    lower(trim(l.user_email)) AS legacy_email,
    NULL::text AS legacy_name,
    false AS from_directory,
    0::bigint AS directory_rows,
    count(*) AS demand_links_count
  FROM public.legacy_demand_user_links l
  WHERE l.user_email IS NOT NULL
    AND trim(l.user_email) <> ''
  GROUP BY lower(trim(l.user_email))
),
emails AS (
  SELECT
    s.legacy_email,
    max(s.legacy_name) AS legacy_name,
    bool_or(s.from_directory) AS in_directory,
    sum(s.directory_rows) AS directory_rows,
    sum(s.demand_links_count) AS demand_links_count
  FROM source_emails s
  GROUP BY s.legacy_email
),
profile_candidates AS (
  SELECT
    lower(trim(p.email)) AS email_norm,
    count(*) AS profile_count,
    min(p.id::text)::uuid AS single_profile_id,
    min(p.email) AS single_profile_email
  FROM public.profiles p
  WHERE p.email IS NOT NULL
    AND trim(p.email) <> ''
  GROUP BY lower(trim(p.email))
)
SELECT
  e.legacy_email,
  e.legacy_name,
  e.in_directory,
  e.directory_rows,
  e.demand_links_count,
  lup.legacy_user_id,
  lup.profile_id AS linked_profile_id,
  lup.profile_email AS linked_profile_email,
  lup.link_source,
  lup.link_state,
  coalesce(pc.profile_count, 0) AS profile_candidates_count,
  pc.single_profile_id AS suggested_profile_id,
  pc.single_profile_email AS suggested_profile_email,
  CASE
    WHEN lup.profile_id IS NOT NULL THEN 'vinculado'
    WHEN coalesce(pc.profile_count, 0) = 0 THEN 'sem_conta_no_sistema'
    WHEN pc.profile_count = 1 THEN 'pendente_de_confirmacao'
    ELSE 'email_duplicado_em_profiles'
  END AS validation_status,
  CASE
    WHEN lup.profile_id IS NOT NULL THEN 'Vínculo ativo e pronto para uso.'
    WHEN coalesce(pc.profile_count, 0) = 0 THEN 'Não existe conta ativa com este e-mail.'
    WHEN pc.profile_count = 1 THEN 'Existe uma conta correspondente; confirme o vínculo.'
    ELSE 'Há mais de uma conta com este e-mail; revisar antes de vincular.'
  END AS validation_note
FROM emails e
LEFT JOIN public.legacy_user_profile_links lup
  ON lup.legacy_email = e.legacy_email
 AND lup.link_state = 'active'
LEFT JOIN profile_candidates pc
  ON pc.email_norm = e.legacy_email;

CREATE OR REPLACE VIEW public.legacy_user_links_pending_v1
WITH (security_invoker = true)
AS
SELECT *
FROM public.legacy_user_links_validation_v1
WHERE validation_status <> 'vinculado'
ORDER BY
  CASE validation_status
    WHEN 'email_duplicado_em_profiles' THEN 1
    WHEN 'pendente_de_confirmacao' THEN 2
    WHEN 'sem_conta_no_sistema' THEN 3
    ELSE 9
  END,
  legacy_email;
