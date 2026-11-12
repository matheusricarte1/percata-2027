ALTER TABLE public.dfd_collective_contributions
  DROP CONSTRAINT IF EXISTS dfd_collective_contributions_status_check;

ALTER TABLE public.dfd_collective_contributions
  ADD CONSTRAINT dfd_collective_contributions_status_check
  CHECK (status IN ('aberta', 'devolvida', 'consolidada', 'arquivada'));

CREATE INDEX IF NOT EXISTS idx_dfd_collective_contributions_returned
  ON public.dfd_collective_contributions (room_id, user_id, status)
  WHERE status = 'devolvida';

NOTIFY pgrst, 'reload schema';
