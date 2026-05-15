CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

ALTER EXTENSION unaccent SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.catalogo_normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      lower(extensions.unaccent(coalesce(input_text, ''))),
      '[^a-z0-9]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ));
$$;

ALTER FUNCTION public.app_can_access_campus(UUID) SET SCHEMA private;
ALTER FUNCTION public.app_can_select_profile(UUID, UUID, TEXT) SET SCHEMA private;
ALTER FUNCTION public.app_collective_room_visible(UUID) SET SCHEMA private;
ALTER FUNCTION public.app_current_profile_role() SET SCHEMA private;
ALTER FUNCTION public.app_is_admin() SET SCHEMA private;
ALTER FUNCTION public.app_is_chefia_for_unit(UUID) SET SCHEMA private;
ALTER FUNCTION public.app_is_member_for_unit(UUID, TEXT) SET SCHEMA private;
ALTER FUNCTION public.app_is_superadmin() SET SCHEMA private;
ALTER FUNCTION public.app_protect_profile_self_update() SET SCHEMA private;
ALTER FUNCTION public.app_user_campus_id() SET SCHEMA private;
ALTER FUNCTION public.enqueue_notification_email() SET SCHEMA private;
ALTER FUNCTION public.is_legacy_pa_admin() SET SCHEMA private;
ALTER FUNCTION public.sync_profile_from_auth_users() SET SCHEMA private;

CREATE OR REPLACE FUNCTION private.app_is_superadmin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) = 'matheus.ricarte@upe.br';
$$;

CREATE OR REPLACE FUNCTION private.app_current_profile_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN private.app_is_superadmin() THEN 'superadmin'
    ELSE (
      SELECT p.role
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
      LIMIT 1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION private.app_user_campus_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.campus_id
  FROM public.profiles p
  WHERE p.id = (SELECT auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.app_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT private.app_is_superadmin()
    OR coalesce(private.app_current_profile_role(), '') IN ('admin', 'superadmin');
$$;

CREATE OR REPLACE FUNCTION private.app_is_chefia_for_unit(target_unit_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_units uu
    WHERE uu.user_id = (SELECT auth.uid())
      AND uu.role_in_unit = 'chefia'
      AND uu.unit_id = target_unit_id
  );
$$;

CREATE OR REPLACE FUNCTION private.app_is_member_for_unit(target_unit_id UUID, target_unit_type TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_units uu
    WHERE uu.user_id = (SELECT auth.uid())
      AND uu.unit_id = target_unit_id
      AND uu.unit_type = target_unit_type
  );
$$;

CREATE OR REPLACE FUNCTION private.app_can_access_campus(target_campus UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    private.app_is_superadmin()
    OR (
      target_campus IS NOT NULL
      AND coalesce(private.app_current_profile_role(), '') IN ('admin', 'superadmin')
      AND private.app_user_campus_id() = target_campus
    );
$$;

CREATE OR REPLACE FUNCTION private.app_can_select_profile(
  target_profile_id UUID,
  target_campus_id UUID,
  target_role TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH current_context AS (
    SELECT (SELECT auth.uid()) AS user_id
  )
  SELECT coalesce((
    SELECT
      ctx.user_id IS NOT NULL
      AND (
        target_profile_id = ctx.user_id
        OR private.app_is_admin()
        OR EXISTS (
          SELECT 1
          FROM public.dfds d
          WHERE d.solicitante_id = target_profile_id
            AND (
              d.solicitante_id = ctx.user_id
              OR private.app_is_chefia_for_unit(d.unidade_id)
            )
        )
      )
    FROM current_context ctx
  ), false);
$$;

CREATE OR REPLACE FUNCTION private.app_collective_room_visible(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dfd_collective_rooms r
    WHERE r.id = target_room_id
      AND (
        private.app_is_admin()
        OR private.app_is_member_for_unit(r.unit_id, r.unit_type)
        OR private.app_is_chefia_for_unit(r.unit_id)
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_legacy_pa_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role IN ('admin', 'superadmin')
    )
    OR lower(coalesce((SELECT auth.jwt()) ->> 'email', '')) = 'matheus.ricarte@upe.br';
$$;

CREATE OR REPLACE FUNCTION private.app_protect_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := (SELECT auth.uid());
  jwt_email TEXT := lower(coalesce((SELECT auth.jwt()) ->> 'email', ''));
  jwt_role TEXT := coalesce((SELECT auth.role()), '');
  is_privileged BOOLEAN := current_user_id IS NULL OR jwt_role = 'service_role' OR private.app_is_admin();
BEGIN
  IF is_privileged THEN
    RETURN NEW;
  END IF;

  IF current_user_id IS NULL OR NEW.id IS DISTINCT FROM current_user_id THEN
    RAISE EXCEPTION 'Operacao de perfil nao autorizada.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NOT NULL AND NEW.role <> 'solicitante' THEN
      RAISE EXCEPTION 'Usuario comum nao pode definir perfil privilegiado.';
    END IF;

    IF NEW.role IS NULL THEN
      NEW.role := 'solicitante';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Usuario comum nao pode alterar o proprio papel.';
    END IF;

    IF OLD.campus_id IS NOT NULL AND NEW.campus_id IS DISTINCT FROM OLD.campus_id THEN
      RAISE EXCEPTION 'Alteracao de campus deve ser feita por administrador.';
    END IF;

    IF NEW.signature_hash IS DISTINCT FROM OLD.signature_hash THEN
      RAISE EXCEPTION 'Usuario comum nao pode alterar assinatura institucional.';
    END IF;
  END IF;

  IF NEW.email IS NOT NULL AND jwt_email <> '' AND lower(NEW.email) <> jwt_email THEN
    RAISE EXCEPTION 'E-mail do perfil deve corresponder ao usuario autenticado.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.enqueue_notification_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email TEXT;
  user_notify_email BOOLEAN := TRUE;
BEGIN
  SELECT p.email
    INTO target_email
  FROM public.profiles p
  WHERE p.id = NEW.user_id
  LIMIT 1;

  IF target_email IS NULL OR btrim(target_email) = '' THEN
    RETURN NEW;
  END IF;

  IF to_regclass('public.user_settings') IS NOT NULL THEN
    SELECT coalesce(us.notify_email, TRUE)
      INTO user_notify_email
    FROM public.user_settings us
    WHERE us.user_id = NEW.user_id
    LIMIT 1;
  END IF;

  IF NOT coalesce(user_notify_email, TRUE) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.email_alert_queue q
    WHERE q.notification_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.email_alert_queue (
    notification_id,
    user_id,
    email_to,
    subject,
    body
  ) VALUES (
    NEW.id,
    NEW.user_id,
    lower(target_email),
    NEW.title,
    NEW.message
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.sync_profile_from_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  inferred_full_name TEXT;
  inferred_avatar_url TEXT;
BEGIN
  inferred_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(
      concat_ws(
        ' ',
        NULLIF(NEW.raw_user_meta_data ->> 'given_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'family_name', '')
      ),
      ''
    )
  );

  inferred_avatar_url := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'picture', '')
  );

  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    lower(NEW.email),
    inferred_full_name,
    inferred_avatar_url
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  RETURN NEW;
END;
$$;

ALTER POLICY admin_user_audit_logs_select_policy ON public.admin_user_audit_logs
USING ((SELECT private.app_is_admin()));

ALTER POLICY app_system_settings_insert_policy ON public.app_system_settings
WITH CHECK ((SELECT private.app_is_superadmin()));

ALTER POLICY app_system_settings_update_policy ON public.app_system_settings
USING ((SELECT private.app_is_superadmin()))
WITH CHECK ((SELECT private.app_is_superadmin()));

ALTER POLICY auth_login_events_insert_policy ON public.auth_login_events
WITH CHECK (
  (SELECT private.app_is_admin())
  OR user_id = (SELECT auth.uid())
  OR email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
);

ALTER POLICY auth_login_events_select_policy ON public.auth_login_events
USING (
  (SELECT private.app_is_admin())
  OR user_id = (SELECT auth.uid())
  OR email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
);

ALTER POLICY catalogo_favoritos_delete_own ON public.catalogo_favoritos
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY catalogo_favoritos_insert_own ON public.catalogo_favoritos
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY catalogo_favoritos_select_own ON public.catalogo_favoritos
USING ((SELECT auth.uid()) = user_id);

ALTER POLICY catalogo_item_naturezas_select_authenticated ON public.catalogo_item_naturezas
USING ((SELECT auth.role()) = 'authenticated');

ALTER POLICY dfd_collective_contributions_delete_policy ON public.dfd_collective_contributions
USING (
  (SELECT private.app_is_admin())
  OR private.app_is_chefia_for_unit(unit_id)
  OR (
    user_id = (SELECT auth.uid())
    AND status = 'aberta'
    AND (
      room_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.dfd_collective_rooms r
        WHERE r.id = dfd_collective_contributions.room_id
          AND r.status = 'aberta'
      )
    )
  )
);

ALTER POLICY dfd_collective_contributions_insert_policy ON public.dfd_collective_contributions
WITH CHECK (
  user_id = (SELECT auth.uid())
  AND status = 'aberta'
  AND private.app_is_member_for_unit(unit_id, unit_type)
  AND (
    room_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.dfd_collective_rooms r
      WHERE r.id = dfd_collective_contributions.room_id
        AND r.status = 'aberta'
        AND r.unit_id = dfd_collective_contributions.unit_id
        AND r.unit_type = dfd_collective_contributions.unit_type
    )
  )
);

ALTER POLICY dfd_collective_contributions_select_policy ON public.dfd_collective_contributions
USING (
  (SELECT private.app_is_admin())
  OR user_id = (SELECT auth.uid())
  OR private.app_is_chefia_for_unit(unit_id)
  OR private.app_is_member_for_unit(unit_id, unit_type)
);

ALTER POLICY dfd_collective_contributions_update_policy ON public.dfd_collective_contributions
USING (
  (SELECT private.app_is_admin())
  OR private.app_is_chefia_for_unit(unit_id)
  OR (
    user_id = (SELECT auth.uid())
    AND status = 'aberta'
    AND (
      room_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.dfd_collective_rooms r
        WHERE r.id = dfd_collective_contributions.room_id
          AND r.status = 'aberta'
      )
    )
  )
)
WITH CHECK (
  (SELECT private.app_is_admin())
  OR private.app_is_chefia_for_unit(unit_id)
  OR (
    user_id = (SELECT auth.uid())
    AND status = 'aberta'
    AND (
      room_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.dfd_collective_rooms r
        WHERE r.id = dfd_collective_contributions.room_id
          AND r.status = 'aberta'
      )
    )
  )
);

ALTER POLICY dfd_collective_room_dfds_insert_policy ON public.dfd_collective_room_dfds
WITH CHECK (private.app_collective_room_visible(room_id));

ALTER POLICY dfd_collective_room_dfds_select_policy ON public.dfd_collective_room_dfds
USING (private.app_collective_room_visible(room_id));

ALTER POLICY dfd_collective_room_events_insert_policy ON public.dfd_collective_room_events
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND private.app_collective_room_visible(room_id)
);

ALTER POLICY dfd_collective_room_events_select_policy ON public.dfd_collective_room_events
USING (private.app_collective_room_visible(room_id));

ALTER POLICY dfd_collective_rooms_insert_policy ON public.dfd_collective_rooms
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND status = 'aberta'
  AND private.app_is_member_for_unit(unit_id, unit_type)
);

ALTER POLICY dfd_collective_rooms_select_policy ON public.dfd_collective_rooms
USING (
  (SELECT private.app_is_admin())
  OR private.app_is_member_for_unit(unit_id, unit_type)
  OR private.app_is_chefia_for_unit(unit_id)
);

ALTER POLICY dfd_collective_rooms_update_policy ON public.dfd_collective_rooms
USING (
  (SELECT private.app_is_admin())
  OR private.app_is_chefia_for_unit(unit_id)
)
WITH CHECK (
  (SELECT private.app_is_admin())
  OR private.app_is_chefia_for_unit(unit_id)
);

ALTER POLICY dfd_items_delete_policy ON public.dfd_items
USING (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR (d.solicitante_id = (SELECT auth.uid()) AND d.status = 'rascunho')
      )
  )
);

ALTER POLICY dfd_items_insert_policy ON public.dfd_items
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR (
          d.solicitante_id = (SELECT auth.uid())
          AND d.status = ANY (ARRAY['rascunho'::text, 'devolvida'::text])
        )
      )
  )
);

ALTER POLICY dfd_items_select_policy ON public.dfd_items
USING (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR d.solicitante_id = (SELECT auth.uid())
        OR private.app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

ALTER POLICY dfd_items_update_policy ON public.dfd_items
USING (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR (
          d.solicitante_id = (SELECT auth.uid())
          AND d.status = ANY (ARRAY['rascunho'::text, 'devolvida'::text])
        )
        OR (
          private.app_is_chefia_for_unit(d.unidade_id)
          AND d.status = 'triagem'
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_items.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR (
          d.solicitante_id = (SELECT auth.uid())
          AND d.status = ANY (ARRAY['rascunho'::text, 'devolvida'::text])
        )
        OR (
          private.app_is_chefia_for_unit(d.unidade_id)
          AND d.status = 'triagem'
        )
      )
  )
);

ALTER POLICY dfd_logs_insert_policy ON public.dfd_logs
WITH CHECK (
  (SELECT auth.role()) = 'authenticated'
  AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
  AND EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_logs.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR d.solicitante_id = (SELECT auth.uid())
        OR private.app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

ALTER POLICY dfd_logs_select_policy ON public.dfd_logs
USING (
  EXISTS (
    SELECT 1
    FROM public.dfds d
    WHERE d.id = dfd_logs.dfd_id
      AND (
        private.app_can_access_campus(d.campus_id)
        OR d.solicitante_id = (SELECT auth.uid())
        OR private.app_is_chefia_for_unit(d.unidade_id)
      )
  )
);

ALTER POLICY dfds_delete_policy ON public.dfds
USING (
  private.app_can_access_campus(campus_id)
  OR (solicitante_id = (SELECT auth.uid()) AND status = 'rascunho')
);

ALTER POLICY dfds_insert_policy ON public.dfds
WITH CHECK (
  private.app_can_access_campus(campus_id)
  OR (
    solicitante_id = (SELECT auth.uid())
    AND (campus_id IS NULL OR campus_id = private.app_user_campus_id())
  )
);

ALTER POLICY dfds_select_policy ON public.dfds
USING (
  private.app_can_access_campus(campus_id)
  OR solicitante_id = (SELECT auth.uid())
  OR private.app_is_chefia_for_unit(unidade_id)
);

ALTER POLICY dfds_update_policy ON public.dfds
USING (
  private.app_can_access_campus(campus_id)
  OR (
    solicitante_id = (SELECT auth.uid())
    AND status = ANY (ARRAY['rascunho'::text, 'devolvida'::text, 'triagem'::text])
  )
  OR (
    private.app_is_chefia_for_unit(unidade_id)
    AND status = ANY (ARRAY['triagem'::text, 'aprovada'::text, 'devolvida'::text])
  )
)
WITH CHECK (
  private.app_can_access_campus(campus_id)
  OR (
    solicitante_id = (SELECT auth.uid())
    AND status = ANY (ARRAY['rascunho'::text, 'devolvida'::text, 'triagem'::text])
    AND (campus_id IS NULL OR campus_id = private.app_user_campus_id())
  )
  OR (
    private.app_is_chefia_for_unit(unidade_id)
    AND status = ANY (ARRAY['triagem'::text, 'aprovada'::text, 'devolvida'::text])
  )
);

ALTER POLICY email_alert_queue_admin_policy ON public.email_alert_queue
USING ((SELECT private.app_is_admin()));

ALTER POLICY governanca_ciclos_delete_superadmin ON public.governanca_ciclos
USING ((SELECT private.app_is_superadmin()));

ALTER POLICY governanca_ciclos_insert_superadmin ON public.governanca_ciclos
WITH CHECK ((SELECT private.app_is_superadmin()));

ALTER POLICY governanca_ciclos_select_authenticated ON public.governanca_ciclos
USING ((SELECT auth.role()) = 'authenticated');

ALTER POLICY governanca_ciclos_update_superadmin ON public.governanca_ciclos
USING ((SELECT private.app_is_superadmin()))
WITH CHECK ((SELECT private.app_is_superadmin()));

ALTER POLICY "Users can view their own historical demands" ON public.historico_demandas
USING (((SELECT auth.jwt()) ->> 'email') = solicitante_email);

ALTER POLICY kit_items_delete_policy ON public.kit_items
USING ((SELECT private.app_is_admin()));

ALTER POLICY kit_items_insert_policy ON public.kit_items
WITH CHECK ((SELECT private.app_is_admin()));

ALTER POLICY kit_items_select_policy ON public.kit_items
USING ((SELECT auth.role()) = 'authenticated');

ALTER POLICY kit_items_update_policy ON public.kit_items
USING ((SELECT private.app_is_admin()))
WITH CHECK ((SELECT private.app_is_admin()));

ALTER POLICY kits_delete_policy ON public.kits
USING ((SELECT private.app_is_admin()));

ALTER POLICY kits_insert_policy ON public.kits
WITH CHECK ((SELECT private.app_is_admin()));

ALTER POLICY kits_select_policy ON public.kits
USING ((SELECT auth.role()) = 'authenticated');

ALTER POLICY kits_update_policy ON public.kits
USING ((SELECT private.app_is_admin()))
WITH CHECK ((SELECT private.app_is_admin()));

ALTER POLICY legacy_demand_user_links_select_policy ON public.legacy_demand_user_links
USING (
  (SELECT private.is_legacy_pa_admin())
  OR lower(user_email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup
    WHERE lup.link_state = 'active'
      AND lup.profile_id = (SELECT auth.uid())
      AND lup.legacy_email = lower(legacy_demand_user_links.user_email)
  )
);

ALTER POLICY legacy_pa_demandas_select_policy ON public.legacy_pa_demandas
USING (
  (SELECT private.is_legacy_pa_admin())
  OR lower(coalesce(requester_email, '')) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup_req
    WHERE lup_req.link_state = 'active'
      AND lup_req.profile_id = (SELECT auth.uid())
      AND lup_req.legacy_email = lower(coalesce(legacy_pa_demandas.requester_email, ''))
  )
  OR EXISTS (
    SELECT 1
    FROM public.legacy_pa_itens i
    WHERE i.legacy_year = legacy_pa_demandas.legacy_year
      AND i.demand_code = legacy_pa_demandas.demand_code
      AND (
        lower(coalesce(i.fiscal_email, '')) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
        OR EXISTS (
          SELECT 1
          FROM public.legacy_user_profile_links lup_item
          WHERE lup_item.link_state = 'active'
            AND lup_item.profile_id = (SELECT auth.uid())
            AND lup_item.legacy_email = lower(coalesce(i.fiscal_email, ''))
        )
      )
  )
);

ALTER POLICY legacy_pa_itens_select_policy ON public.legacy_pa_itens
USING (
  (SELECT private.is_legacy_pa_admin())
  OR lower(coalesce(fiscal_email, '')) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup_item
    WHERE lup_item.link_state = 'active'
      AND lup_item.profile_id = (SELECT auth.uid())
      AND lup_item.legacy_email = lower(coalesce(legacy_pa_itens.fiscal_email, ''))
  )
  OR EXISTS (
    SELECT 1
    FROM public.legacy_demand_user_links l
    WHERE l.legacy_year = legacy_pa_itens.legacy_year
      AND l.demand_code = legacy_pa_itens.demand_code
      AND l.link_role = 'fiscal'
      AND (
        lower(l.user_email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
        OR EXISTS (
          SELECT 1
          FROM public.legacy_user_profile_links lup_link
          WHERE lup_link.link_state = 'active'
            AND lup_link.profile_id = (SELECT auth.uid())
            AND lup_link.legacy_email = lower(l.user_email)
        )
      )
  )
);

ALTER POLICY legacy_user_directory_select_policy ON public.legacy_user_directory
USING (
  (SELECT private.is_legacy_pa_admin())
  OR lower(email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  OR EXISTS (
    SELECT 1
    FROM public.legacy_user_profile_links lup
    WHERE lup.link_state = 'active'
      AND lup.profile_id = (SELECT auth.uid())
      AND lup.legacy_email = lower(legacy_user_directory.email)
  )
);

ALTER POLICY legacy_user_profile_links_delete_policy ON public.legacy_user_profile_links
USING ((SELECT private.is_legacy_pa_admin()));

ALTER POLICY legacy_user_profile_links_insert_policy ON public.legacy_user_profile_links
WITH CHECK ((SELECT private.is_legacy_pa_admin()));

ALTER POLICY legacy_user_profile_links_select_policy ON public.legacy_user_profile_links
USING (
  (SELECT private.is_legacy_pa_admin())
  OR profile_id = (SELECT auth.uid())
  OR legacy_email = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
);

ALTER POLICY legacy_user_profile_links_update_policy ON public.legacy_user_profile_links
USING ((SELECT private.is_legacy_pa_admin()))
WITH CHECK ((SELECT private.is_legacy_pa_admin()));

ALTER POLICY notifications_insert_policy ON public.notifications
WITH CHECK ((SELECT auth.role()) = 'authenticated');

ALTER POLICY notifications_select_policy ON public.notifications
USING ((SELECT private.app_is_admin()) OR user_id = (SELECT auth.uid()));

ALTER POLICY notifications_update_policy ON public.notifications
USING ((SELECT private.app_is_admin()) OR user_id = (SELECT auth.uid()))
WITH CHECK ((SELECT private.app_is_admin()) OR user_id = (SELECT auth.uid()));

ALTER POLICY "Users can insert their own profile." ON public.profiles
WITH CHECK ((SELECT auth.uid()) = id);

ALTER POLICY "Users can update own profile." ON public.profiles
USING ((SELECT auth.uid()) = id);

ALTER POLICY profiles_select_policy ON public.profiles
USING (private.app_can_select_profile(id, campus_id, role));

ALTER POLICY user_settings_insert_policy ON public.user_settings
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT private.app_is_admin()));

ALTER POLICY user_settings_select_policy ON public.user_settings
USING ((SELECT auth.uid()) = user_id OR (SELECT private.app_is_admin()));

ALTER POLICY user_settings_update_policy ON public.user_settings
USING ((SELECT auth.uid()) = user_id OR (SELECT private.app_is_admin()))
WITH CHECK ((SELECT auth.uid()) = user_id OR (SELECT private.app_is_admin()));

ALTER POLICY user_units_delete_policy ON public.user_units
USING (
  (SELECT private.app_is_admin())
  OR (
    user_id = (SELECT auth.uid())
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
);

ALTER POLICY user_units_insert_policy ON public.user_units
WITH CHECK (
  (SELECT private.app_is_admin())
  OR (
    user_id = (SELECT auth.uid())
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
);

ALTER POLICY user_units_select_policy ON public.user_units
USING ((SELECT private.app_is_admin()) OR user_id = (SELECT auth.uid()));

ALTER POLICY user_units_update_policy ON public.user_units
USING (
  (SELECT private.app_is_admin())
  OR (
    user_id = (SELECT auth.uid())
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
)
WITH CHECK (
  (SELECT private.app_is_admin())
  OR (
    user_id = (SELECT auth.uid())
    AND coalesce(role_in_unit, 'membro') = 'membro'
  )
);

REVOKE ALL ON FUNCTION private.app_protect_profile_self_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enqueue_notification_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.sync_profile_from_auth_users() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION private.app_can_access_campus(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_can_select_profile(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_collective_room_visible(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_current_profile_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_is_chefia_for_unit(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_is_member_for_unit(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_is_superadmin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.app_user_campus_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_legacy_pa_admin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.app_can_access_campus(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_can_select_profile(UUID, UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_collective_room_visible(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_current_profile_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_is_chefia_for_unit(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_is_member_for_unit(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_is_superadmin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.app_user_campus_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_legacy_pa_admin() TO anon, authenticated, service_role;
