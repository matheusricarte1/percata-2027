-- Migration: 20260525171000_legacy_history_profile_link_view.sql
-- Description: Legacy history view with fallback mapping by legacy_user_profile_links
-- Author: Codex
-- Date: 2026-05-25

DO $$
BEGIN
  IF to_regclass('public.legacy_user_profile_links') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW legacy_pa_minhas_demandas_v3
      WITH (security_invoker = true)
      AS
      WITH me AS (
        SELECT
          auth.uid() AS uid,
          lower(coalesce(auth.jwt() ->> 'email', '')) AS email
      )
      SELECT
        d.legacy_year,
        d.demand_code,
        d.campus,
        d.status,
        d.object,
        d.total_estimated,
        count(i.id) AS items_count
      FROM legacy_pa_demandas d
      JOIN legacy_demand_user_links l
        ON l.legacy_year = d.legacy_year
       AND l.demand_code = d.demand_code
      CROSS JOIN me
      LEFT JOIN legacy_user_profile_links lup
        ON lower(coalesce(lup.legacy_email, '')) = lower(coalesce(l.user_email, ''))
       AND coalesce(lup.link_state, 'active') = 'active'
      LEFT JOIN legacy_pa_itens i
        ON i.legacy_year = d.legacy_year
       AND i.demand_code = d.demand_code
      WHERE l.link_role IN ('fiscal', 'requester')
        AND (
          lower(coalesce(l.user_email, '')) = me.email
          OR (me.uid IS NOT NULL AND lup.profile_id = me.uid)
          OR lower(coalesce(lup.profile_email, '')) = me.email
        )
      GROUP BY
        d.legacy_year,
        d.demand_code,
        d.campus,
        d.status,
        d.object,
        d.total_estimated;
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE OR REPLACE VIEW legacy_pa_minhas_demandas_v3
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
      FROM legacy_pa_demandas d
      JOIN legacy_demand_user_links l
        ON l.legacy_year = d.legacy_year
       AND l.demand_code = d.demand_code
      LEFT JOIN legacy_pa_itens i
        ON i.legacy_year = d.legacy_year
       AND i.demand_code = d.demand_code
      WHERE l.link_role IN ('fiscal', 'requester')
        AND lower(coalesce(l.user_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      GROUP BY
        d.legacy_year,
        d.demand_code,
        d.campus,
        d.status,
        d.object,
        d.total_estimated;
    $sql$;
  END IF;
END;
$$;

