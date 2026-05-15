ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS accent_color TEXT NOT NULL DEFAULT 'upe'
CHECK (accent_color IN ('upe', 'teal', 'gold', 'slate'));

CREATE TABLE IF NOT EXISTS public.app_system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_app_system_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_app_system_settings_updated_at ON public.app_system_settings;
CREATE TRIGGER trg_app_system_settings_updated_at
BEFORE UPDATE ON public.app_system_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_app_system_settings_updated_at();

ALTER TABLE public.app_system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_system_settings_select_policy ON public.app_system_settings;
CREATE POLICY app_system_settings_select_policy
ON public.app_system_settings
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS app_system_settings_insert_policy ON public.app_system_settings;
CREATE POLICY app_system_settings_insert_policy
ON public.app_system_settings
FOR INSERT
TO authenticated
WITH CHECK (public.app_is_superadmin());

DROP POLICY IF EXISTS app_system_settings_update_policy ON public.app_system_settings;
CREATE POLICY app_system_settings_update_policy
ON public.app_system_settings
FOR UPDATE
TO authenticated
USING (public.app_is_superadmin())
WITH CHECK (public.app_is_superadmin());

INSERT INTO public.app_system_settings (key, value)
VALUES (
  'global_access_lock',
  jsonb_build_object(
    'enabled', false,
    'message', 'O sistema esta temporariamente bloqueado para manutenção. Aguarde a liberação pelo superadmin.'
  )
)
ON CONFLICT (key) DO NOTHING;

GRANT SELECT ON public.app_system_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_system_settings TO authenticated;
