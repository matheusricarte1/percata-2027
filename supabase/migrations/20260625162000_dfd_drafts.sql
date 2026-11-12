CREATE TABLE IF NOT EXISTS public.dfd_drafts (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  current_step TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '30 days'),
  CONSTRAINT dfd_drafts_schema_version_check CHECK (schema_version > 0)
);

CREATE INDEX IF NOT EXISTS idx_dfd_drafts_expires_at ON public.dfd_drafts (expires_at);

CREATE OR REPLACE FUNCTION public.set_dfd_drafts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dfd_drafts_updated_at ON public.dfd_drafts;
CREATE TRIGGER trg_dfd_drafts_updated_at
BEFORE UPDATE ON public.dfd_drafts
FOR EACH ROW
EXECUTE FUNCTION public.set_dfd_drafts_updated_at();

ALTER TABLE public.dfd_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own DFD drafts." ON public.dfd_drafts;
CREATE POLICY "Users can read their own DFD drafts."
ON public.dfd_drafts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own DFD drafts." ON public.dfd_drafts;
CREATE POLICY "Users can insert their own DFD drafts."
ON public.dfd_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own DFD drafts." ON public.dfd_drafts;
CREATE POLICY "Users can update their own DFD drafts."
ON public.dfd_drafts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own DFD drafts." ON public.dfd_drafts;
CREATE POLICY "Users can delete their own DFD drafts."
ON public.dfd_drafts
FOR DELETE
USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dfd_drafts TO authenticated;
