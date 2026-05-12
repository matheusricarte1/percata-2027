-- Migration: 0009_legacy_user_email_links.sql
-- Description: Legacy user directory + demand-user links by email and filtered views
-- Author: Codex
-- Date: 2026-04-21

CREATE TABLE IF NOT EXISTS legacy_user_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  server_name TEXT NULL,
  birth_date DATE NULL,
  start_date DATE NULL,
  source TEXT NOT NULL DEFAULT 'usuarios_xlsx'
    CHECK (source IN ('usuarios_xlsx', 'legacy_items_only')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legacy_demand_user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_year INTEGER NOT NULL CHECK (legacy_year >= 2000 AND legacy_year <= 2100),
  demand_code TEXT NOT NULL,
  user_email TEXT NOT NULL,
  link_role TEXT NOT NULL DEFAULT 'fiscal'
    CHECK (link_role IN ('fiscal', 'requester')),
  source TEXT NOT NULL DEFAULT 'itens_solicitados_col_n',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (legacy_year, demand_code, user_email, link_role),
  CONSTRAINT fk_legacy_link_demand
    FOREIGN KEY (legacy_year, demand_code)
    REFERENCES legacy_pa_demandas (legacy_year, demand_code)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_legacy_user_directory_email_lower
  ON legacy_user_directory (lower(email));

CREATE INDEX IF NOT EXISTS idx_legacy_demand_user_links_email_lower
  ON legacy_demand_user_links (lower(user_email));

CREATE INDEX IF NOT EXISTS idx_legacy_demand_user_links_year_code
  ON legacy_demand_user_links (legacy_year, demand_code);

CREATE OR REPLACE FUNCTION set_legacy_user_directory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legacy_user_directory_updated_at ON legacy_user_directory;
CREATE TRIGGER trg_legacy_user_directory_updated_at
BEFORE UPDATE ON legacy_user_directory
FOR EACH ROW
EXECUTE FUNCTION set_legacy_user_directory_updated_at();

ALTER TABLE legacy_user_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_demand_user_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legacy_user_directory_select_policy ON legacy_user_directory;
CREATE POLICY legacy_user_directory_select_policy
ON legacy_user_directory
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS legacy_demand_user_links_select_policy ON legacy_demand_user_links;
CREATE POLICY legacy_demand_user_links_select_policy
ON legacy_demand_user_links
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS legacy_pa_itens_select_policy ON legacy_pa_itens;
CREATE POLICY legacy_pa_itens_select_policy
ON legacy_pa_itens
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(coalesce(fiscal_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM legacy_demand_user_links l
    WHERE l.legacy_year = legacy_pa_itens.legacy_year
      AND l.demand_code = legacy_pa_itens.demand_code
      AND l.link_role = 'fiscal'
      AND lower(l.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

CREATE OR REPLACE VIEW legacy_pa_minhas_demandas_v2
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
 AND l.link_role = 'fiscal'
LEFT JOIN legacy_pa_itens i
  ON i.legacy_year = d.legacy_year
 AND i.demand_code = d.demand_code
WHERE lower(l.user_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
GROUP BY
  d.legacy_year,
  d.demand_code,
  d.campus,
  d.status,
  d.object,
  d.total_estimated;
