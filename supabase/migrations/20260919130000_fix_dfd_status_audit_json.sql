-- Legacy status trigger wrote plain text into a JSON field. That made every
-- later status transition fail with 22P02, including formal returns.
CREATE OR REPLACE FUNCTION public.log_dfd_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS NULL OR OLD.status <> NEW.status THEN
    INSERT INTO public.dfd_logs (dfd_id, action, details)
    VALUES (
      NEW.id,
      NEW.status,
      jsonb_build_object('reason', 'Status alterado para ' || NEW.status)::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp;

NOTIFY pgrst, 'reload schema';
