-- Explicit per-table coverage for the service-only analysis API.
ALTER TABLE public.dfd_analysis_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dfd_operations ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.dfd_analysis_drafts TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.dfd_operations TO service_role;
CREATE POLICY analysis_drafts_no_direct_client_access ON public.dfd_analysis_drafts
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY analysis_operations_no_direct_client_access ON public.dfd_operations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.dfd_analysis_drafts,public.dfd_operations FROM anon,authenticated;
