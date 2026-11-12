-- Classification completion only saves a draft. Formal approval requires an explicit approve operation.
DROP TRIGGER IF EXISTS auto_homologate_complete_analysis_draft ON public.dfd_analysis_drafts;
DROP FUNCTION IF EXISTS private.auto_homologate_complete_analysis_draft();
NOTIFY pgrst, 'reload schema';
