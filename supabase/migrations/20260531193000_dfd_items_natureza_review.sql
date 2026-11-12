-- Marks DFD items that intentionally have no natureza at submission time.
-- These items must be generated in a separate DFD and reviewed/saneado later.

ALTER TABLE public.dfd_items
  ADD COLUMN IF NOT EXISTS requires_natureza_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_dfd_items_requires_natureza_review
  ON public.dfd_items (requires_natureza_review)
  WHERE requires_natureza_review;

NOTIFY pgrst, 'reload schema';
