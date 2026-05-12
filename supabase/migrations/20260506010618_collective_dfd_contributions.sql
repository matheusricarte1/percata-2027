CREATE TABLE IF NOT EXISTS public.dfd_collective_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('departamento', 'laboratorio')),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  codigo_item_efisco TEXT NOT NULL,
  codigo_tce TEXT,
  descricao TEXT NOT NULL,
  unidade_medida TEXT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  valor_unitario_estimado NUMERIC(14,2) NOT NULL DEFAULT 0,
  justificativa_item TEXT,
  link_referencia TEXT,
  gnd TEXT,
  gnd_derivado TEXT,
  codigo_natureza_despesa TEXT,
  tipo_objeto TEXT,
  codigo_grupo TEXT,
  nome_grupo TEXT,
  codigo_classe TEXT,
  nome_classe TEXT,
  status TEXT NOT NULL DEFAULT 'aberta'
    CHECK (status IN ('aberta', 'consolidada', 'arquivada')),
  collective_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consolidated_dfd_id UUID REFERENCES public.dfds(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dfd_collective_contributions_open_unique
  ON public.dfd_collective_contributions (
    unit_type,
    unit_id,
    user_id,
    collective_key
  )
  WHERE status = 'aberta';

CREATE INDEX IF NOT EXISTS idx_dfd_collective_contributions_unit_status
  ON public.dfd_collective_contributions (unit_type, unit_id, status);

CREATE INDEX IF NOT EXISTS idx_dfd_collective_contributions_user_status
  ON public.dfd_collective_contributions (user_id, status);

CREATE OR REPLACE FUNCTION public.app_is_member_for_unit(
  target_unit_id UUID,
  target_unit_type TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_units uu
    WHERE uu.user_id = auth.uid()
      AND uu.unit_id = target_unit_id
      AND uu.unit_type = target_unit_type
  );
$$;

ALTER TABLE public.dfd_collective_contributions ENABLE ROW LEVEL SECURITY;

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
  app_is_admin()
  OR user_id = auth.uid()
  OR app_is_chefia_for_unit(unit_id)
  OR public.app_is_member_for_unit(unit_id, unit_type)
);

CREATE POLICY dfd_collective_contributions_insert_policy
ON public.dfd_collective_contributions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND status = 'aberta'
  AND public.app_is_member_for_unit(unit_id, unit_type)
);

CREATE POLICY dfd_collective_contributions_update_policy
ON public.dfd_collective_contributions
FOR UPDATE
USING (
  app_is_admin()
  OR app_is_chefia_for_unit(unit_id)
  OR public.app_is_member_for_unit(unit_id, unit_type)
  OR (
    user_id = auth.uid()
    AND status = 'aberta'
  )
)
WITH CHECK (
  app_is_admin()
  OR app_is_chefia_for_unit(unit_id)
  OR public.app_is_member_for_unit(unit_id, unit_type)
  OR (
    user_id = auth.uid()
    AND status = 'aberta'
  )
);

CREATE POLICY dfd_collective_contributions_delete_policy
ON public.dfd_collective_contributions
FOR DELETE
USING (
  app_is_admin()
  OR (
    user_id = auth.uid()
    AND status = 'aberta'
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.dfd_collective_contributions
TO authenticated;

NOTIFY pgrst, 'reload schema';
