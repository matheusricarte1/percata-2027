ALTER TABLE public.laboratorios
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campi(id);

ALTER TABLE public.dfds
  ADD COLUMN IF NOT EXISTS analysis_unidade_id UUID,
  ADD COLUMN IF NOT EXISTS analysis_tipo_unidade TEXT
    CHECK (analysis_tipo_unidade IS NULL OR analysis_tipo_unidade IN ('departamento', 'laboratorio')),
  ADD COLUMN IF NOT EXISTS analysis_routing_reason TEXT;

UPDATE public.dfds
SET
  analysis_unidade_id = COALESCE(analysis_unidade_id, unidade_id),
  analysis_tipo_unidade = COALESCE(analysis_tipo_unidade, tipo_unidade)
WHERE analysis_unidade_id IS NULL
  AND unidade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dfds_analysis_unidade_id
  ON public.dfds(analysis_unidade_id);

CREATE INDEX IF NOT EXISTS idx_laboratorios_campus_id
  ON public.laboratorios(campus_id);
