ALTER TABLE public.kits
  ADD COLUMN IF NOT EXISTS source_dfd_id UUID REFERENCES public.dfds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_protocol TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_kits_source_dfd_id_unique
  ON public.kits(source_dfd_id)
  WHERE source_dfd_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kits_is_active
  ON public.kits(is_active);
