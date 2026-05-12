-- Migration: 0010_security_reporting_alerts.sql
-- Description: Security hardening (RLS), reporting views and email alert queue
-- Author: Codex
-- Date: 2026-04-21

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus.ricarte@upe.br'
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    );
$$;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfd_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_policy ON notifications;
CREATE POLICY notifications_select_policy
ON notifications
FOR SELECT
USING (app_is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_policy ON notifications;
CREATE POLICY notifications_update_policy
ON notifications
FOR UPDATE
USING (app_is_admin() OR user_id = auth.uid())
WITH CHECK (app_is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS notifications_insert_policy ON notifications;
CREATE POLICY notifications_insert_policy
ON notifications
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS dfd_logs_select_policy ON dfd_logs;
CREATE POLICY dfd_logs_select_policy
ON dfd_logs
FOR SELECT
USING (
  app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_logs.dfd_id
      AND d.solicitante_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'chefia'
  )
);

DROP POLICY IF EXISTS dfd_logs_insert_policy ON dfd_logs;
CREATE POLICY dfd_logs_insert_policy
ON dfd_logs
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS kits_select_policy ON kits;
CREATE POLICY kits_select_policy
ON kits
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS kits_write_policy ON kits;
CREATE POLICY kits_write_policy
ON kits
FOR ALL
USING (app_is_admin())
WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS kit_items_select_policy ON kit_items;
CREATE POLICY kit_items_select_policy
ON kit_items
FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS kit_items_write_policy ON kit_items;
CREATE POLICY kit_items_write_policy
ON kit_items
FOR ALL
USING (app_is_admin())
WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS user_units_select_policy ON user_units;
CREATE POLICY user_units_select_policy
ON user_units
FOR SELECT
USING (app_is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS user_units_insert_policy ON user_units;
CREATE POLICY user_units_insert_policy
ON user_units
FOR INSERT
WITH CHECK (
  app_is_admin()
  OR (
    user_id = auth.uid()
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
);

DROP POLICY IF EXISTS user_units_update_policy ON user_units;
CREATE POLICY user_units_update_policy
ON user_units
FOR UPDATE
USING (
  app_is_admin()
  OR (
    user_id = auth.uid()
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
)
WITH CHECK (
  app_is_admin()
  OR (
    user_id = auth.uid()
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
);

DROP POLICY IF EXISTS user_units_delete_policy ON user_units;
CREATE POLICY user_units_delete_policy
ON user_units
FOR DELETE
USING (
  app_is_admin()
  OR (
    user_id = auth.uid()
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
);

CREATE TABLE IF NOT EXISTS email_alert_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'canceled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_email_alert_queue_status_created
  ON email_alert_queue (status, created_at);

ALTER TABLE email_alert_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_alert_queue_admin_policy ON email_alert_queue;
CREATE POLICY email_alert_queue_admin_policy
ON email_alert_queue
FOR SELECT
USING (app_is_admin());

CREATE OR REPLACE FUNCTION enqueue_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
BEGIN
  SELECT p.email
    INTO target_email
  FROM profiles p
  WHERE p.id = NEW.user_id
  LIMIT 1;

  IF target_email IS NULL OR target_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO email_alert_queue (
    notification_id,
    user_id,
    email_to,
    subject,
    body
  ) VALUES (
    NEW.id,
    NEW.user_id,
    lower(target_email),
    NEW.title,
    NEW.message
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_notification_email ON notifications;
CREATE TRIGGER trg_enqueue_notification_email
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION enqueue_notification_email();

CREATE OR REPLACE VIEW vw_consolidacao_pca AS
SELECT
  i.codigo_tce,
  min(i.descricao) AS descricao,
  sum(i.quantidade) AS quantidade_total,
  sum(i.quantidade * i.valor_unitario_estimado) AS valor_total_estimado,
  count(DISTINCT d.id) AS total_dfds,
  count(DISTINCT d.solicitante_id) AS total_solicitantes,
  bool_or(coalesce(i.is_highlight_item, false)) AS destaque_pareto
FROM dfd_items i
JOIN dfds d
  ON d.id = i.dfd_id
WHERE d.status IN ('aprovada', 'pactuando', 'concluida')
GROUP BY i.codigo_tce;

CREATE OR REPLACE VIEW vw_admin_kpis AS
SELECT
  count(*) FILTER (WHERE d.status = 'rascunho') AS dfds_rascunho,
  count(*) FILTER (WHERE d.status = 'triagem') AS dfds_triagem,
  count(*) FILTER (WHERE d.status = 'aprovada') AS dfds_aprovadas,
  count(*) FILTER (WHERE d.status = 'devolvida') AS dfds_devolvidas,
  count(*) FILTER (WHERE d.status = 'concluida') AS dfds_concluidas,
  coalesce(sum(d.valor_total_estimado) FILTER (WHERE d.status IN ('aprovada', 'pactuando', 'concluida')), 0) AS valor_homologado
FROM dfds d;
