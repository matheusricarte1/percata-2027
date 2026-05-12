-- User settings for Appearance, Notifications and Privacy
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_mode TEXT NOT NULL DEFAULT 'system'
    CHECK (theme_mode IN ('system', 'light', 'dark')),
  density_mode TEXT NOT NULL DEFAULT 'comfortable'
    CHECK (density_mode IN ('compact', 'comfortable')),
  reduced_motion BOOLEAN NOT NULL DEFAULT false,
  show_animations BOOLEAN NOT NULL DEFAULT true,

  notify_aprovacao BOOLEAN NOT NULL DEFAULT true,
  notify_devolucao BOOLEAN NOT NULL DEFAULT true,
  notify_homologacao BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT true,

  profile_visibility TEXT NOT NULL DEFAULT 'campus'
    CHECK (profile_visibility IN ('campus', 'papel', 'privado')),
  show_email BOOLEAN NOT NULL DEFAULT true,
  show_avatar BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_user_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_user_settings_updated_at();

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_select_policy ON public.user_settings;
CREATE POLICY user_settings_select_policy
ON public.user_settings
FOR SELECT
USING (auth.uid() = user_id OR app_is_admin());

DROP POLICY IF EXISTS user_settings_insert_policy ON public.user_settings;
CREATE POLICY user_settings_insert_policy
ON public.user_settings
FOR INSERT
WITH CHECK (auth.uid() = user_id OR app_is_admin());

DROP POLICY IF EXISTS user_settings_update_policy ON public.user_settings;
CREATE POLICY user_settings_update_policy
ON public.user_settings
FOR UPDATE
USING (auth.uid() = user_id OR app_is_admin())
WITH CHECK (auth.uid() = user_id OR app_is_admin());
