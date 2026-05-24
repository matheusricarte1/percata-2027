ALTER TABLE public.dfds
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS collective_origin_room_id UUID REFERENCES public.dfd_collective_rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collective_origin_room_title TEXT,
  ADD COLUMN IF NOT EXISTS collective_origin_expense_class TEXT;

ALTER TABLE public.dfds
  DROP CONSTRAINT IF EXISTS dfds_origin_type_check;

ALTER TABLE public.dfds
  ADD CONSTRAINT dfds_origin_type_check
  CHECK (origin_type IN ('individual', 'collective'));

CREATE TABLE IF NOT EXISTS public.dfd_collective_dfd_authors (
  dfd_id UUID NOT NULL REFERENCES public.dfds(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.dfd_collective_rooms(id) ON DELETE CASCADE,
  contribution_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name_snapshot TEXT,
  author_email_snapshot TEXT,
  item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
  quantidade_total INTEGER NOT NULL DEFAULT 0 CHECK (quantidade_total >= 0),
  valor_total_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
  contribution_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (dfd_id, contribution_user_id)
);

CREATE INDEX IF NOT EXISTS idx_dfd_collective_dfd_authors_room
  ON public.dfd_collective_dfd_authors (room_id, dfd_id);

ALTER TABLE public.dfd_collective_dfd_authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dfd_collective_dfd_authors_select_policy
  ON public.dfd_collective_dfd_authors;
DROP POLICY IF EXISTS dfd_collective_dfd_authors_insert_policy
  ON public.dfd_collective_dfd_authors;

CREATE POLICY dfd_collective_dfd_authors_select_policy
ON public.dfd_collective_dfd_authors
FOR SELECT
USING (
  private.app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_collective_dfd_authors.dfd_id
      AND (
        d.solicitante_id = auth.uid()
        OR private.app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

CREATE POLICY dfd_collective_dfd_authors_insert_policy
ON public.dfd_collective_dfd_authors
FOR INSERT
WITH CHECK (private.app_is_admin());

GRANT SELECT, INSERT ON public.dfd_collective_dfd_authors TO authenticated, service_role;
