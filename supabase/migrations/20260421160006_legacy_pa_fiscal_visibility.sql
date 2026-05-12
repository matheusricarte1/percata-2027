-- Migration: 0006_legacy_pa_fiscal_visibility.sql
-- Description: Legacy PA import tables + RLS to restrict visibility by fiscal email
-- Author: Codex
-- Date: 2026-04-21

CREATE TABLE IF NOT EXISTS legacy_pa_demandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_year INTEGER NOT NULL CHECK (legacy_year >= 2000 AND legacy_year <= 2100),
  demand_code TEXT NOT NULL,
  record_origin TEXT NOT NULL DEFAULT 'demandas_sheet'
    CHECK (record_origin IN ('demandas_sheet', 'item_only')),
  submission_at TIMESTAMPTZ NULL,
  request_area TEXT NULL,
  requester_name TEXT NULL,
  requester_email TEXT NULL,
  object TEXT NULL,
  current_problem TEXT NULL,
  justification_acquisition TEXT NULL,
  justification_quantity TEXT NULL,
  proposed_solution TEXT NULL,
  total_estimated NUMERIC NULL,
  delivery_forecast TIMESTAMPTZ NULL,
  status TEXT NULL,
  campus TEXT NULL,
  priority TEXT NULL,
  planning_owner TEXT NULL,
  demand_type TEXT NULL,
  workflow_status TEXT NULL,
  delivery_status TEXT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (legacy_year, demand_code)
);

CREATE TABLE IF NOT EXISTS legacy_pa_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_year INTEGER NOT NULL CHECK (legacy_year >= 2000 AND legacy_year <= 2100),
  source_row_hash TEXT NOT NULL UNIQUE,
  pedido_codigo TEXT NULL,
  demand_code TEXT NULL,
  efisco_code TEXT NULL,
  efisco_description TEXT NULL,
  quantity_text TEXT NULL,
  quantity_numeric NUMERIC NULL,
  unit TEXT NULL,
  item_justification TEXT NULL,
  item_requirements TEXT NULL,
  local_uso TEXT NULL,
  ref_link_1 TEXT NULL,
  ref_link_2 TEXT NULL,
  ref_link_3 TEXT NULL,
  photo_url TEXT NULL,
  fiscal_name TEXT NULL,
  fiscal_email TEXT NULL,
  item_criticality TEXT NULL,
  item_delivery_deadline TEXT NULL,
  item_price NUMERIC NULL,
  curso TEXT NULL,
  grupo TEXT NULL,
  natureza_despesa TEXT NULL,
  is_reagente TEXT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_pa_demandas_year_code
  ON legacy_pa_demandas (legacy_year, demand_code);

CREATE INDEX IF NOT EXISTS idx_legacy_pa_demandas_requester_email
  ON legacy_pa_demandas (lower(requester_email));

CREATE INDEX IF NOT EXISTS idx_legacy_pa_itens_year_code
  ON legacy_pa_itens (legacy_year, demand_code);

CREATE INDEX IF NOT EXISTS idx_legacy_pa_itens_fiscal_email
  ON legacy_pa_itens (lower(fiscal_email));

CREATE OR REPLACE FUNCTION set_legacy_pa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legacy_pa_demandas_updated_at ON legacy_pa_demandas;
CREATE TRIGGER trg_legacy_pa_demandas_updated_at
BEFORE UPDATE ON legacy_pa_demandas
FOR EACH ROW
EXECUTE FUNCTION set_legacy_pa_updated_at();

CREATE OR REPLACE FUNCTION is_legacy_pa_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    )
    OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus.ricarte@upe.br';
$$;

ALTER TABLE legacy_pa_demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE legacy_pa_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legacy_pa_demandas_select_policy ON legacy_pa_demandas;
CREATE POLICY legacy_pa_demandas_select_policy
ON legacy_pa_demandas
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM legacy_pa_itens i
    WHERE i.legacy_year = legacy_pa_demandas.legacy_year
      AND i.demand_code = legacy_pa_demandas.demand_code
      AND lower(coalesce(i.fiscal_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

DROP POLICY IF EXISTS legacy_pa_itens_select_policy ON legacy_pa_itens;
CREATE POLICY legacy_pa_itens_select_policy
ON legacy_pa_itens
FOR SELECT
USING (
  is_legacy_pa_admin()
  OR lower(coalesce(fiscal_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

CREATE OR REPLACE VIEW legacy_pa_minhas_demandas_ano_anterior AS
SELECT
  d.legacy_year,
  d.demand_code,
  d.campus,
  d.status,
  d.object,
  d.total_estimated,
  d.requester_name,
  d.requester_email,
  count(i.id) AS items_count,
  min(i.fiscal_name) FILTER (WHERE i.fiscal_name IS NOT NULL) AS fiscal_name,
  min(i.fiscal_email) FILTER (WHERE i.fiscal_email IS NOT NULL) AS fiscal_email
FROM legacy_pa_demandas d
LEFT JOIN legacy_pa_itens i
  ON i.legacy_year = d.legacy_year
 AND i.demand_code = d.demand_code
GROUP BY
  d.legacy_year,
  d.demand_code,
  d.campus,
  d.status,
  d.object,
  d.total_estimated,
  d.requester_name,
  d.requester_email;
