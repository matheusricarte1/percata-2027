CREATE OR REPLACE FUNCTION public.require_dfd_items_before_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('triagem', 'aprovada', 'pactuando', 'concluida')
     AND NOT EXISTS (
       SELECT 1
       FROM public.dfd_items item
       WHERE item.dfd_id = NEW.id
       LIMIT 1
     ) THEN
    RAISE EXCEPTION
      'Inclua pelo menos um item antes de enviar a DFD para análise.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_require_dfd_items_before_workflow_insert ON public.dfds;
CREATE TRIGGER trg_require_dfd_items_before_workflow_insert
BEFORE INSERT ON public.dfds
FOR EACH ROW
EXECUTE FUNCTION public.require_dfd_items_before_workflow();

DROP TRIGGER IF EXISTS trg_require_dfd_items_before_workflow_update ON public.dfds;
CREATE TRIGGER trg_require_dfd_items_before_workflow_update
BEFORE UPDATE OF status ON public.dfds
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION public.require_dfd_items_before_workflow();
