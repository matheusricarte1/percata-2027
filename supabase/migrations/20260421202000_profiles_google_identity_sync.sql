-- Sync Google identity metadata (name/photo) into public.profiles
-- so the application can render requester identity consistently.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- One-time backfill from auth.users metadata
UPDATE public.profiles p
SET
  email = COALESCE(NULLIF(lower(p.email), ''), lower(u.email)),
  full_name = COALESCE(
    NULLIF(p.full_name, ''),
    NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(u.raw_user_meta_data ->> 'name', ''),
    NULLIF(
      concat_ws(
        ' ',
        NULLIF(u.raw_user_meta_data ->> 'given_name', ''),
        NULLIF(u.raw_user_meta_data ->> 'family_name', '')
      ),
      ''
    )
  ),
  avatar_url = COALESCE(
    NULLIF(p.avatar_url, ''),
    NULLIF(u.raw_user_meta_data ->> 'avatar_url', ''),
    NULLIF(u.raw_user_meta_data ->> 'picture', '')
  )
FROM auth.users u
WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_users()
RETURNS trigger
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

DROP TRIGGER IF EXISTS trg_sync_profile_from_auth_users ON auth.users;
CREATE TRIGGER trg_sync_profile_from_auth_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_from_auth_users();
