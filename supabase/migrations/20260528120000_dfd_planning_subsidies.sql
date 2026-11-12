ALTER TABLE public.dfds
  ADD COLUMN IF NOT EXISTS planning_subsidies JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.dfd_collective_rooms
  ADD COLUMN IF NOT EXISTS planning_subsidies JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.dfds.planning_subsidies IS
  'Campos preparatorios e reaproveitaveis para ETP/TR, coletados na DFD sem substituir os documentos formais.';

COMMENT ON COLUMN public.dfd_collective_rooms.planning_subsidies IS
  'Campos preparatorios e reaproveitaveis para ETP/TR, coletados na sala coletiva antes da conversao em DFD oficial.';
