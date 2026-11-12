-- A delivery worker can stop after the provider accepts a request but before the
-- queue update is persisted. Keep a lease timestamp so that such rows are not
-- stranded forever, while allowing the provider idempotency key to prevent a
-- duplicate delivery when it is retried.

ALTER TABLE public.email_alert_queue
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_email_alert_queue_reclaim
  ON public.email_alert_queue (status, locked_at, created_at);

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
    WHERE q.attempts < 5
      AND (
        q.status IN ('pending', 'failed')
        OR (
          q.status = 'processing'
          AND q.locked_at < now() - interval '20 minutes'
        )
      )
    ORDER BY q.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(coalesce(batch_size, 20), 100))
  )
  UPDATE public.email_alert_queue q
  SET
    status = 'processing',
    attempts = q.attempts + 1,
    locked_at = now(),
    last_error = NULL
  FROM picked
  WHERE q.id = picked.id
  RETURNING q.id, q.email_to, q.subject, q.body, q.attempts, q.status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_email_alert_queue(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_alert_queue(INTEGER) TO service_role;
