-- LGPD: logs de acesso são mantidos por 180 dias para segurança e suporte.
CREATE OR REPLACE FUNCTION private.purge_expired_auth_login_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.auth_login_events WHERE logged_at < statement_timestamp() - interval '180 days';
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS purge_expired_auth_login_events ON public.auth_login_events;
CREATE TRIGGER purge_expired_auth_login_events
AFTER INSERT ON public.auth_login_events
FOR EACH STATEMENT EXECUTE FUNCTION private.purge_expired_auth_login_events();
