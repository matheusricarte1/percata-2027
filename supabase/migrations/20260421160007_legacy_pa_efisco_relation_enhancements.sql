-- Migration: 0007_legacy_pa_efisco_relation_enhancements.sql
-- Description: Track e-Fisco code provenance from column B/C and add fiscal-code relation view
-- Author: Codex
-- Date: 2026-04-21

ALTER TABLE legacy_pa_itens
  ADD COLUMN IF NOT EXISTS efisco_code_col_b TEXT NULL,
  ADD COLUMN IF NOT EXISTS efisco_code_col_c TEXT NULL,
  ADD COLUMN IF NOT EXISTS efisco_code_source TEXT NULL
    CHECK (efisco_code_source IN ('col_c_parentheses', 'col_b', 'none'));

CREATE INDEX IF NOT EXISTS idx_legacy_pa_itens_efisco_code_col_b
  ON legacy_pa_itens (efisco_code_col_b);

CREATE INDEX IF NOT EXISTS idx_legacy_pa_itens_efisco_code_col_c
  ON legacy_pa_itens (efisco_code_col_c);

CREATE OR REPLACE VIEW legacy_pa_fiscal_codigos_efisco AS
SELECT
  i.legacy_year,
  lower(coalesce(i.fiscal_email, '')) AS fiscal_email,
  i.fiscal_name,
  i.efisco_code,
  count(*) AS items_count,
  count(DISTINCT i.demand_code) AS demandas_count,
  array_agg(DISTINCT i.demand_code) FILTER (WHERE i.demand_code IS NOT NULL) AS demand_codes
FROM legacy_pa_itens i
GROUP BY
  i.legacy_year,
  lower(coalesce(i.fiscal_email, '')),
  i.fiscal_name,
  i.efisco_code;
