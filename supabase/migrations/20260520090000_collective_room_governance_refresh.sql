ALTER TABLE public.dfd_collective_rooms
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.dfd_collective_contributions
  ADD COLUMN IF NOT EXISTS adjusted_by_chefia BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS adjusted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ;

UPDATE public.dfd_collective_rooms
SET
  status = CASE
    WHEN status = 'em_revisao' THEN 'pronta_para_conversao'
    ELSE status
  END,
  published_at = COALESCE(published_at, created_at)
WHERE status <> 'proposta';

ALTER TABLE public.dfd_collective_rooms
  DROP CONSTRAINT IF EXISTS dfd_collective_rooms_status_check;

ALTER TABLE public.dfd_collective_rooms
  ADD CONSTRAINT dfd_collective_rooms_status_check
  CHECK (
    status IN (
      'proposta',
      'aberta',
      'em_consolidacao_chefia',
      'pronta_para_conversao',
      'convertida',
      'arquivada'
    )
  );

