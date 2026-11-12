-- Shared rate-limit store for Vercel/serverless deployments.

CREATE TABLE IF NOT EXISTS public.app_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_rate_limits_reset_at
  ON public.app_rate_limits (reset_at);

ALTER TABLE public.app_rate_limits ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_rate_limits TO service_role;

DROP POLICY IF EXISTS app_rate_limits_no_client_access ON public.app_rate_limits;
CREATE POLICY app_rate_limits_no_client_access
ON public.app_rate_limits
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);
