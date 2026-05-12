CREATE TABLE IF NOT EXISTS public.dfd_collective_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'em_revisao', 'convertida', 'arquivada')),
  unit_id UUID NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('departamento', 'laboratorio')),
  campus_id UUID REFERENCES public.campi(id),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ
);

ALTER TABLE public.dfd_collective_contributions
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.dfd_collective_rooms(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_avatar_url TEXT;

DROP INDEX IF EXISTS public.idx_dfd_collective_contributions_open_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dfd_collective_contributions_room_open_unique
  ON public.dfd_collective_contributions (room_id, user_id, collective_key)
  WHERE status = 'aberta' AND room_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dfd_collective_rooms_unit_status
  ON public.dfd_collective_rooms (unit_type, unit_id, status);

CREATE INDEX IF NOT EXISTS idx_dfd_collective_rooms_created_by
  ON public.dfd_collective_rooms (created_by);

CREATE INDEX IF NOT EXISTS idx_dfd_collective_contributions_room_status
  ON public.dfd_collective_contributions (room_id, status);

CREATE TABLE IF NOT EXISTS public.dfd_collective_room_dfds (
  room_id UUID NOT NULL REFERENCES public.dfd_collective_rooms(id) ON DELETE CASCADE,
  dfd_id UUID NOT NULL REFERENCES public.dfds(id) ON DELETE CASCADE,
  expense_class TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, dfd_id)
);

CREATE TABLE IF NOT EXISTS public.dfd_collective_room_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.dfd_collective_rooms(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dfd_collective_room_events_room_created
  ON public.dfd_collective_room_events (room_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.app_collective_room_visible(
  target_room_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dfd_collective_rooms r
    WHERE r.id = target_room_id
      AND (
        public.app_is_admin()
        OR public.app_is_member_for_unit(r.unit_id, r.unit_type)
        OR public.app_is_chefia_for_unit(r.unit_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.touch_dfd_collective_room_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_dfd_collective_room_updated_at
  ON public.dfd_collective_rooms;

CREATE TRIGGER touch_dfd_collective_room_updated_at
BEFORE UPDATE ON public.dfd_collective_rooms
FOR EACH ROW
EXECUTE FUNCTION public.touch_dfd_collective_room_updated_at();

ALTER TABLE public.dfd_collective_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dfd_collective_room_dfds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dfd_collective_room_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dfd_collective_rooms_select_policy
  ON public.dfd_collective_rooms;
DROP POLICY IF EXISTS dfd_collective_rooms_insert_policy
  ON public.dfd_collective_rooms;
DROP POLICY IF EXISTS dfd_collective_rooms_update_policy
  ON public.dfd_collective_rooms;
DROP POLICY IF EXISTS dfd_collective_room_dfds_select_policy
  ON public.dfd_collective_room_dfds;
DROP POLICY IF EXISTS dfd_collective_room_dfds_insert_policy
  ON public.dfd_collective_room_dfds;
DROP POLICY IF EXISTS dfd_collective_room_events_select_policy
  ON public.dfd_collective_room_events;
DROP POLICY IF EXISTS dfd_collective_room_events_insert_policy
  ON public.dfd_collective_room_events;

CREATE POLICY dfd_collective_rooms_select_policy
ON public.dfd_collective_rooms
FOR SELECT
USING (
  public.app_is_admin()
  OR public.app_is_member_for_unit(unit_id, unit_type)
  OR public.app_is_chefia_for_unit(unit_id)
);

CREATE POLICY dfd_collective_rooms_insert_policy
ON public.dfd_collective_rooms
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND status = 'aberta'
  AND public.app_is_member_for_unit(unit_id, unit_type)
);

CREATE POLICY dfd_collective_rooms_update_policy
ON public.dfd_collective_rooms
FOR UPDATE
USING (
  public.app_is_admin()
  OR public.app_is_chefia_for_unit(unit_id)
)
WITH CHECK (
  public.app_is_admin()
  OR public.app_is_chefia_for_unit(unit_id)
);

CREATE POLICY dfd_collective_room_dfds_select_policy
ON public.dfd_collective_room_dfds
FOR SELECT
USING (public.app_collective_room_visible(room_id));

CREATE POLICY dfd_collective_room_dfds_insert_policy
ON public.dfd_collective_room_dfds
FOR INSERT
WITH CHECK (public.app_collective_room_visible(room_id));

CREATE POLICY dfd_collective_room_events_select_policy
ON public.dfd_collective_room_events
FOR SELECT
USING (public.app_collective_room_visible(room_id));

CREATE POLICY dfd_collective_room_events_insert_policy
ON public.dfd_collective_room_events
FOR INSERT
WITH CHECK (
  actor_id = auth.uid()
  AND public.app_collective_room_visible(room_id)
);

DROP POLICY IF EXISTS dfd_collective_contributions_select_policy
  ON public.dfd_collective_contributions;
DROP POLICY IF EXISTS dfd_collective_contributions_insert_policy
  ON public.dfd_collective_contributions;
DROP POLICY IF EXISTS dfd_collective_contributions_update_policy
  ON public.dfd_collective_contributions;
DROP POLICY IF EXISTS dfd_collective_contributions_delete_policy
  ON public.dfd_collective_contributions;

CREATE POLICY dfd_collective_contributions_select_policy
ON public.dfd_collective_contributions
FOR SELECT
USING (
  public.app_is_admin()
  OR user_id = auth.uid()
  OR public.app_is_chefia_for_unit(unit_id)
  OR public.app_is_member_for_unit(unit_id, unit_type)
);

CREATE POLICY dfd_collective_contributions_insert_policy
ON public.dfd_collective_contributions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND status = 'aberta'
  AND public.app_is_member_for_unit(unit_id, unit_type)
  AND (
    room_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.dfd_collective_rooms r
      WHERE r.id = room_id
        AND r.status = 'aberta'
        AND r.unit_id = unit_id
        AND r.unit_type = unit_type
    )
  )
);

CREATE POLICY dfd_collective_contributions_update_policy
ON public.dfd_collective_contributions
FOR UPDATE
USING (
  public.app_is_admin()
  OR public.app_is_chefia_for_unit(unit_id)
  OR (
    user_id = auth.uid()
    AND status = 'aberta'
    AND (
      room_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.dfd_collective_rooms r
        WHERE r.id = room_id
          AND r.status = 'aberta'
      )
    )
  )
)
WITH CHECK (
  public.app_is_admin()
  OR public.app_is_chefia_for_unit(unit_id)
  OR (
    user_id = auth.uid()
    AND status = 'aberta'
    AND (
      room_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.dfd_collective_rooms r
        WHERE r.id = room_id
          AND r.status = 'aberta'
      )
    )
  )
);

CREATE POLICY dfd_collective_contributions_delete_policy
ON public.dfd_collective_contributions
FOR DELETE
USING (
  public.app_is_admin()
  OR public.app_is_chefia_for_unit(unit_id)
  OR (
    user_id = auth.uid()
    AND status = 'aberta'
    AND (
      room_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.dfd_collective_rooms r
        WHERE r.id = room_id
          AND r.status = 'aberta'
      )
    )
  )
);

GRANT SELECT, INSERT, UPDATE
ON public.dfd_collective_rooms
TO authenticated;

GRANT SELECT, INSERT
ON public.dfd_collective_room_dfds, public.dfd_collective_room_events
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.dfd_collective_contributions
TO authenticated;

GRANT EXECUTE ON FUNCTION public.app_collective_room_visible(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_dfd_collective_room_updated_at() TO authenticated;

NOTIFY pgrst, 'reload schema';
