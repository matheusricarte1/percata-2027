-- Migration: 0008_legacy_pa_status_em_pactuacao.sql
-- Description: Treat legacy PA as read-only consultation data with fixed status
-- Author: Codex
-- Date: 2026-04-21

ALTER TABLE legacy_pa_demandas
  ALTER COLUMN status SET DEFAULT 'Em pactuação';

CREATE OR REPLACE FUNCTION enforce_legacy_pa_status_em_pactuacao()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := 'Em pactuação';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_legacy_pa_status_em_pactuacao ON legacy_pa_demandas;
CREATE TRIGGER trg_legacy_pa_status_em_pactuacao
BEFORE INSERT OR UPDATE ON legacy_pa_demandas
FOR EACH ROW
EXECUTE FUNCTION enforce_legacy_pa_status_em_pactuacao();

UPDATE legacy_pa_demandas
SET
  status = 'Em pactuação',
  updated_at = now()
WHERE status IS DISTINCT FROM 'Em pactuação';
