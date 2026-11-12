-- A formal return must reach the requester without relying on a manual visit
-- to the DFD history. The audit log remains the source of the full reason.
CREATE OR REPLACE FUNCTION private.notify_dfd_return() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  v_dfd public.dfds%ROWTYPE;
  v_reason text;
BEGIN
  IF NEW.action <> 'devolvida' THEN RETURN NEW; END IF;
  SELECT * INTO v_dfd FROM public.dfds WHERE id=NEW.dfd_id;
  IF NOT FOUND OR v_dfd.solicitante_id IS NULL THEN RETURN NEW; END IF;
  v_reason := left(coalesce((NEW.details::jsonb)->>'reason', NEW.details, ''), 1200);
  INSERT INTO public.notifications(user_id,title,message,type)
  VALUES (
    v_dfd.solicitante_id,
    'DFD devolvida para correção',
    jsonb_build_object(
      'kind','rich_notification',
      'template_key','dfd_returned',
      'heading','Sua DFD foi devolvida para correção',
      'context_label',coalesce(v_dfd.numero_protocolo,'DFD'),
      'status_label','Correção solicitada',
      'status_tone','warning',
      'body',case when v_reason='' then 'A chefia devolveu a DFD. Consulte o histórico e corrija antes de reenviar.' else v_reason end,
      'cta_label','Corrigir e reenviar',
      'cta_url','/dfd/' || v_dfd.id::text,
      'facts',jsonb_build_array(jsonb_build_object('label','Protocolo','value',coalesce(v_dfd.numero_protocolo, v_dfd.id::text)))
    )::text,
    'warning'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_dfd_return ON public.dfd_logs;
CREATE TRIGGER notify_dfd_return
AFTER INSERT ON public.dfd_logs
FOR EACH ROW EXECUTE FUNCTION private.notify_dfd_return();

REVOKE ALL ON FUNCTION private.notify_dfd_return() FROM PUBLIC,anon,authenticated;
