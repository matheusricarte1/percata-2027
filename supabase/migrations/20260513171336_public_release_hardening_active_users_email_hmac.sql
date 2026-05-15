-- Public release hardening:
-- - explicit "active user" state for profiles
-- - atomic email queue claiming to avoid duplicate dispatch

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE public.profiles
SET is_active = true
WHERE is_active IS DISTINCT FROM true;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active
  ON public.profiles(is_active);

CREATE OR REPLACE FUNCTION public.claim_email_alert_queue(batch_size INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  email_to TEXT,
  subject TEXT,
  body TEXT,
  attempts INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT q.id
    FROM public.email_alert_queue q
    WHERE q.status IN ('pending', 'failed')
      AND q.attempts < 5
    ORDER BY q.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(batch_size, 20), 100))
  )
  UPDATE public.email_alert_queue q
  SET
    status = 'processing',
    attempts = q.attempts + 1
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.id, q.email_to, q.subject, q.body, q.attempts, q.status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_alert_queue(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_alert_queue(INTEGER) TO service_role;
