-- Email queue hardening:
-- 1) avoid duplicate queue rows per notification
-- 2) respect user notification preference (notify_email)

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_alert_queue_notification_id
  ON public.email_alert_queue (notification_id)
  WHERE notification_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_notification_email()
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

