-- A devolução formal já cria uma notificação rica pelo trigger em dfd_logs,
-- com motivo, protocolo e CTA de correção. Não crie uma segunda notificação
-- genérica apenas porque o status da DFD também mudou para "devolvida".
-- Os demais status preservam o aviso legado até cada fluxo ter seu gatilho rico.

CREATE OR REPLACE FUNCTION public.notify_dfd_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    IF NEW.status = 'devolvida' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.solicitante_id,
      'Sua DFD mudou de status',
      'O status da sua demanda foi alterado de ' || OLD.status || ' para ' || NEW.status || '.',
      CASE
        WHEN NEW.status = 'aprovada' THEN 'success'
        ELSE 'info'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_dfd_status_change() FROM PUBLIC, anon, authenticated;
