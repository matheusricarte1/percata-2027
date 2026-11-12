-- Every final DFD status is represented by one structured notification.  The
-- payload is consumed by the notification dispatcher, so the Gmail message
-- keeps the same protocol, decision and CTA seen in the application.
CREATE OR REPLACE FUNCTION private.notify_dfd_status_email(
  p_dfd public.dfds,
  p_template_key text,
  p_title text,
  p_heading text,
  p_status_label text,
  p_status_tone text,
  p_body text,
  p_reason text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_protocol text := coalesce(nullif(trim(p_dfd.numero_protocolo), ''), 'DFD-' || upper(left(p_dfd.id::text, 8)));
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 1200), '');
BEGIN
  IF p_dfd.solicitante_id IS NULL THEN RETURN; END IF;

  -- Terminal decisions must not create a second e-mail if an administrative
  -- retry replays the same status transition.
  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_dfd.solicitante_id
      AND n.message LIKE '%"template_key": "' || p_template_key || '"%'
      AND n.message LIKE '%/dfd/' || p_dfd.id::text || '%'
  ) THEN RETURN; END IF;

  INSERT INTO public.notifications(user_id, title, message, type)
  VALUES (
    p_dfd.solicitante_id,
    p_title,
    jsonb_build_object(
      'kind', 'rich_notification',
      'template_key', p_template_key,
      'heading', p_heading,
      'context_label', v_protocol,
      'status_label', p_status_label,
      'status_tone', p_status_tone,
      'body', case when v_reason is null then p_body else p_body || E'\n\nDecisão registrada: ' || v_reason end,
      'cta_label', 'Consultar DFD',
      'cta_url', '/dfd/' || p_dfd.id::text,
      'facts', jsonb_build_array(
        jsonb_build_object('label', 'Protocolo', 'value', v_protocol),
        jsonb_build_object('label', 'Situação', 'value', p_status_label)
      )
    )::text,
    case when p_status_tone = 'success' then 'success' when p_status_tone = 'warning' then 'warning' else 'info' end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_dfd_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  -- Devolução possui gatilho próprio em dfd_logs, com o motivo obrigatório.
  IF NEW.status = 'devolvida' THEN RETURN NEW; END IF;

  IF NEW.status = 'aprovada' THEN
    PERFORM private.notify_dfd_status_email(
      NEW, 'dfd_approved', 'DFD aprovada',
      'Sua DFD foi aprovada e seguirá no planejamento institucional.',
      'Aprovada', 'success',
      'A análise foi concluída. Consulte o histórico e acompanhe as próximas etapas.'
    );
  ELSIF NEW.status IN ('rejeitada', 'reprovada') THEN
    PERFORM private.notify_dfd_status_email(
      NEW, 'dfd_rejected', 'Decisão registrada para sua DFD',
      'Sua DFD não foi aprovada nesta etapa.',
      'Não aprovada', 'warning',
      'Consulte a decisão registrada e o histórico da análise para entender os próximos encaminhamentos.'
    );
  ELSIF NEW.status = 'arquivada' THEN
    PERFORM private.notify_dfd_status_email(
      NEW, 'dfd_archived', 'Sua DFD foi arquivada',
      'Sua DFD foi arquivada e permanece disponível para consulta.',
      'Arquivada', 'info',
      'A demanda não seguirá no fluxo ativo. Consulte o histórico institucional sempre que precisar.'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_dfd_status_email(public.dfds, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_dfd_status_change() FROM PUBLIC, anon, authenticated;
