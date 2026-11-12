CREATE OR REPLACE FUNCTION private.analysis_auto_forwarding_enabled()
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION private.analysis_auto_forwarding_enabled() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
