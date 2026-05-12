-- Migration: 20260421191500_role_rls_hardening.sql
-- Description: Role-aware RLS hardening for core operational tables
-- Author: Codex
-- Date: 2026-04-21

CREATE OR REPLACE FUNCTION app_is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'matheus.ricarte@upe.br';
$$;

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    app_is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'superadmin')
    );
$$;

CREATE OR REPLACE FUNCTION app_is_chefia_for_unit(target_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_units uu
    WHERE uu.user_id = auth.uid()
      AND uu.role_in_unit = 'chefia'
      AND uu.unit_id = target_unit_id
  );
$$;

ALTER TABLE dfds ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfd_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfd_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Individuals can view their own DFDs." ON dfds;
DROP POLICY IF EXISTS "Individuals can create DFDs." ON dfds;
DROP POLICY IF EXISTS "Individuals can update their own DFDs." ON dfds;
DROP POLICY IF EXISTS dfds_select_policy ON dfds;
DROP POLICY IF EXISTS dfds_insert_policy ON dfds;
DROP POLICY IF EXISTS dfds_update_policy ON dfds;
DROP POLICY IF EXISTS dfds_delete_policy ON dfds;

CREATE POLICY dfds_select_policy
ON dfds
FOR SELECT
USING (
  app_is_admin()
  OR solicitante_id = auth.uid()
  OR app_is_chefia_for_unit(unidade_id)
);

CREATE POLICY dfds_insert_policy
ON dfds
FOR INSERT
WITH CHECK (
  app_is_admin()
  OR (
    solicitante_id = auth.uid()
    AND (
      campus_id IS NULL
      OR campus_id = (SELECT p.campus_id FROM profiles p WHERE p.id = auth.uid())
    )
  )
);

CREATE POLICY dfds_update_policy
ON dfds
FOR UPDATE
USING (
  app_is_admin()
  OR (
    solicitante_id = auth.uid()
    AND status IN ('rascunho', 'devolvida', 'triagem')
  )
  OR (
    app_is_chefia_for_unit(unidade_id)
    AND status IN ('triagem', 'aprovada', 'devolvida')
  )
)
WITH CHECK (
  app_is_admin()
  OR (
    solicitante_id = auth.uid()
    AND status IN ('rascunho', 'devolvida', 'triagem')
    AND (
      campus_id IS NULL
      OR campus_id = (SELECT p.campus_id FROM profiles p WHERE p.id = auth.uid())
    )
  )
  OR (
    app_is_chefia_for_unit(unidade_id)
    AND status IN ('triagem', 'aprovada', 'devolvida')
  )
);

CREATE POLICY dfds_delete_policy
ON dfds
FOR DELETE
USING (
  app_is_admin()
  OR (
    solicitante_id = auth.uid()
    AND status = 'rascunho'
  )
);

DROP POLICY IF EXISTS "Items viewable by DFD owner/admin." ON dfd_items;
DROP POLICY IF EXISTS "Items insetable by DFD owner." ON dfd_items;
DROP POLICY IF EXISTS dfd_items_select_policy ON dfd_items;
DROP POLICY IF EXISTS dfd_items_insert_policy ON dfd_items;
DROP POLICY IF EXISTS dfd_items_update_policy ON dfd_items;
DROP POLICY IF EXISTS dfd_items_delete_policy ON dfd_items;

CREATE POLICY dfd_items_select_policy
ON dfd_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        app_is_admin()
        OR d.solicitante_id = auth.uid()
        OR app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

CREATE POLICY dfd_items_insert_policy
ON dfd_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        app_is_admin()
        OR (
          d.solicitante_id = auth.uid()
          AND d.status IN ('rascunho', 'devolvida')
        )
      )
  )
);

CREATE POLICY dfd_items_update_policy
ON dfd_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        app_is_admin()
        OR (
          d.solicitante_id = auth.uid()
          AND d.status IN ('rascunho', 'devolvida')
        )
        OR (
          app_is_chefia_for_unit(d.unidade_id)
          AND d.status = 'triagem'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        app_is_admin()
        OR (
          d.solicitante_id = auth.uid()
          AND d.status IN ('rascunho', 'devolvida')
        )
        OR (
          app_is_chefia_for_unit(d.unidade_id)
          AND d.status = 'triagem'
        )
      )
  )
);

CREATE POLICY dfd_items_delete_policy
ON dfd_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        app_is_admin()
        OR (
          d.solicitante_id = auth.uid()
          AND d.status = 'rascunho'
        )
      )
  )
);

DROP POLICY IF EXISTS dfd_logs_select_policy ON dfd_logs;
DROP POLICY IF EXISTS dfd_logs_insert_policy ON dfd_logs;

CREATE POLICY dfd_logs_select_policy
ON dfd_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_logs.dfd_id
      AND (
        app_is_admin()
        OR d.solicitante_id = auth.uid()
        OR app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

CREATE POLICY dfd_logs_insert_policy
ON dfd_logs
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND (user_id IS NULL OR user_id = auth.uid())
  AND EXISTS (
    SELECT 1
    FROM dfds d
    WHERE d.id = dfd_logs.dfd_id
      AND (
        app_is_admin()
        OR d.solicitante_id = auth.uid()
        OR app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
DROP POLICY IF EXISTS profiles_select_policy ON profiles;

CREATE POLICY profiles_select_policy
ON profiles
FOR SELECT
USING (auth.role() = 'authenticated');

