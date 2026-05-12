-- Fecha lacunas de RLS em tabelas de referencia usadas pelo app.

ALTER TABLE public.campi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_efisco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_search_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.periodos_ciclo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campi_select_authenticated" ON public.campi;
CREATE POLICY "campi_select_authenticated"
ON public.campi
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "catalogo_select_authenticated" ON public.catalogo;
CREATE POLICY "catalogo_select_authenticated"
ON public.catalogo
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "catalogo_efisco_select_authenticated" ON public.catalogo_efisco;
CREATE POLICY "catalogo_efisco_select_authenticated"
ON public.catalogo_efisco
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "catalogo_search_synonyms_select_authenticated" ON public.catalogo_search_synonyms;
CREATE POLICY "catalogo_search_synonyms_select_authenticated"
ON public.catalogo_search_synonyms
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "departamentos_select_authenticated" ON public.departamentos;
CREATE POLICY "departamentos_select_authenticated"
ON public.departamentos
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "laboratorios_select_authenticated" ON public.laboratorios;
CREATE POLICY "laboratorios_select_authenticated"
ON public.laboratorios
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "periodos_ciclo_select_public" ON public.periodos_ciclo;
CREATE POLICY "periodos_ciclo_select_public"
ON public.periodos_ciclo
FOR SELECT
TO anon, authenticated
USING (true);

NOTIFY pgrst, 'reload schema';
