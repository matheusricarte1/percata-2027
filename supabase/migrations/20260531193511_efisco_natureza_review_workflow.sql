-- Internal workflow for e-Fisco items without official natureza.
-- Access is restricted to admin/superadmin through RLS and server-side APIs.

CREATE TABLE IF NOT EXISTS public.efisco_natureza_review_decisions (
  id BIGSERIAL PRIMARY KEY,
  efisco_item_id BIGINT NOT NULL REFERENCES efisco_core.itens(id) ON DELETE CASCADE,
  dfd_id UUID NULL REFERENCES public.dfds(id) ON DELETE CASCADE,
  dfd_item_id UUID NULL REFERENCES public.dfd_items(id) ON DELETE CASCADE,
  decision_scope TEXT NOT NULL DEFAULT 'catalogo'
    CHECK (decision_scope IN ('catalogo', 'dfd_item')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'em_analise', 'saneado', 'substituido', 'bloqueado')),
  codigo_natureza_despesa TEXT NULL
    CHECK (codigo_natureza_despesa IS NULL OR codigo_natureza_despesa ~ '^[0-9]{8}$'),
  replacement_efisco_item_id BIGINT NULL REFERENCES efisco_core.itens(id) ON DELETE SET NULL,
  snapshot_codigo_efisco TEXT NULL,
  snapshot_descricao TEXT NULL,
  snapshot_tipo_objeto TEXT NULL,
  snapshot_nome_grupo TEXT NULL,
  snapshot_nome_classe TEXT NULL,
  justificativa TEXT NULL,
  decided_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_efisco_review_catalog_item
  ON public.efisco_natureza_review_decisions (efisco_item_id)
  WHERE dfd_item_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_efisco_review_dfd_item
  ON public.efisco_natureza_review_decisions (dfd_item_id)
  WHERE dfd_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_efisco_review_status
  ON public.efisco_natureza_review_decisions (status);

CREATE INDEX IF NOT EXISTS idx_efisco_review_open_status
  ON public.efisco_natureza_review_decisions (status, created_at)
  WHERE status IN ('pendente', 'em_analise');

CREATE OR REPLACE FUNCTION public.touch_efisco_natureza_review_decisions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  IF NEW.status IN ('saneado', 'substituido', 'bloqueado') THEN
    NEW.decided_at := COALESCE(NEW.decided_at, NOW());
  ELSE
    NEW.decided_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_efisco_natureza_review_decisions
  ON public.efisco_natureza_review_decisions;

CREATE TRIGGER touch_efisco_natureza_review_decisions
BEFORE UPDATE ON public.efisco_natureza_review_decisions
FOR EACH ROW
EXECUTE FUNCTION public.touch_efisco_natureza_review_decisions();

ALTER TABLE public.efisco_natureza_review_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS efisco_review_admin_select
  ON public.efisco_natureza_review_decisions;
CREATE POLICY efisco_review_admin_select
ON public.efisco_natureza_review_decisions
FOR SELECT
USING (private.app_is_admin());

DROP POLICY IF EXISTS efisco_review_admin_insert
  ON public.efisco_natureza_review_decisions;
CREATE POLICY efisco_review_admin_insert
ON public.efisco_natureza_review_decisions
FOR INSERT
WITH CHECK (private.app_is_admin());

DROP POLICY IF EXISTS efisco_review_admin_update
  ON public.efisco_natureza_review_decisions;
CREATE POLICY efisco_review_admin_update
ON public.efisco_natureza_review_decisions
FOR UPDATE
USING (private.app_is_admin())
WITH CHECK (private.app_is_admin());

DROP POLICY IF EXISTS efisco_review_admin_delete
  ON public.efisco_natureza_review_decisions;
CREATE POLICY efisco_review_admin_delete
ON public.efisco_natureza_review_decisions
FOR DELETE
USING (private.app_is_admin());

INSERT INTO public.efisco_natureza_review_decisions (
  efisco_item_id,
  decision_scope,
  status,
  snapshot_codigo_efisco,
  snapshot_descricao,
  snapshot_tipo_objeto,
  snapshot_nome_grupo,
  snapshot_nome_classe,
  justificativa
)
SELECT
  i.id,
  'catalogo',
  'pendente',
  i.codigo_item,
  i.nome_item,
  i.tipo_objeto,
  g.nome_grupo,
  c.nome_classe,
  'Carga inicial: item sem natureza no DBAtualizado.csv.'
FROM efisco_core.itens i
JOIN efisco_core.materiais_servicos ms
  ON ms.codigo_material_servico = i.codigo_material_servico
JOIN efisco_core.classes c
  ON c.codigo_classe = ms.codigo_classe
JOIN efisco_core.grupos g
  ON g.codigo_grupo = c.codigo_grupo
WHERE i.has_missing_natureza
ON CONFLICT DO NOTHING;

INSERT INTO public.efisco_natureza_review_decisions (
  efisco_item_id,
  dfd_id,
  dfd_item_id,
  decision_scope,
  status,
  snapshot_codigo_efisco,
  snapshot_descricao,
  snapshot_tipo_objeto,
  snapshot_nome_grupo,
  snapshot_nome_classe,
  justificativa
)
SELECT
  di.efisco_item_id,
  di.dfd_id,
  di.id,
  'dfd_item',
  'pendente',
  COALESCE(di.codigo_item_efisco, i.codigo_item, di.codigo_tce),
  COALESCE(di.descricao, i.nome_item),
  COALESCE(di.tipo_objeto, i.tipo_objeto),
  COALESCE(di.nome_grupo, g.nome_grupo),
  COALESCE(di.nome_classe, c.nome_classe),
  'DFD gerada em separado por item sem natureza.'
FROM public.dfd_items di
JOIN public.dfds d
  ON d.id = di.dfd_id
LEFT JOIN efisco_core.itens i
  ON i.id = di.efisco_item_id
LEFT JOIN efisco_core.materiais_servicos ms
  ON ms.codigo_material_servico = i.codigo_material_servico
LEFT JOIN efisco_core.classes c
  ON c.codigo_classe = ms.codigo_classe
LEFT JOIN efisco_core.grupos g
  ON g.codigo_grupo = c.codigo_grupo
WHERE di.requires_natureza_review = TRUE
  AND di.efisco_item_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW public.efisco_natureza_review_queue AS
SELECT
  r.id,
  r.efisco_item_id,
  r.dfd_id,
  r.dfd_item_id,
  r.decision_scope,
  r.status,
  r.codigo_natureza_despesa,
  r.replacement_efisco_item_id,
  r.snapshot_codigo_efisco AS codigo_efisco,
  r.snapshot_descricao AS descricao,
  r.snapshot_tipo_objeto AS tipo_objeto,
  r.snapshot_nome_grupo AS nome_grupo,
  r.snapshot_nome_classe AS nome_classe,
  d.numero_protocolo,
  d.status AS dfd_status,
  di.quantidade,
  di.valor_unitario_estimado,
  (di.quantidade * di.valor_unitario_estimado) AS valor_total_item,
  r.justificativa,
  r.decided_by,
  p.full_name AS decided_by_name,
  r.decided_at,
  r.created_at,
  r.updated_at
FROM public.efisco_natureza_review_decisions r
LEFT JOIN public.dfds d
  ON d.id = r.dfd_id
LEFT JOIN public.dfd_items di
  ON di.id = r.dfd_item_id
LEFT JOIN public.profiles p
  ON p.id = r.decided_by;

ALTER VIEW public.efisco_natureza_review_queue SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_natureza_review_summary AS
SELECT
  COUNT(*)::BIGINT AS total,
  COUNT(*) FILTER (WHERE status IN ('pendente', 'em_analise'))::BIGINT AS abertos,
  COUNT(*) FILTER (WHERE status = 'pendente')::BIGINT AS pendentes,
  COUNT(*) FILTER (WHERE status = 'em_analise')::BIGINT AS em_analise,
  COUNT(*) FILTER (WHERE status = 'saneado')::BIGINT AS saneados,
  COUNT(*) FILTER (WHERE status = 'substituido')::BIGINT AS substituidos,
  COUNT(*) FILTER (WHERE status = 'bloqueado')::BIGINT AS bloqueados,
  COUNT(*) FILTER (WHERE decision_scope = 'dfd_item')::BIGINT AS vinculados_a_dfd,
  COUNT(*) FILTER (WHERE decision_scope = 'catalogo')::BIGINT AS apenas_catalogo
FROM public.efisco_natureza_review_decisions;

ALTER VIEW public.efisco_natureza_review_summary SET (security_invoker = true);

CREATE OR REPLACE VIEW public.efisco_natureza_review_reuse AS
SELECT DISTINCT ON (efisco_item_id)
  efisco_item_id,
  codigo_natureza_despesa,
  replacement_efisco_item_id,
  status,
  updated_at
FROM public.efisco_natureza_review_decisions
WHERE status IN ('saneado', 'substituido')
ORDER BY efisco_item_id, updated_at DESC;

ALTER VIEW public.efisco_natureza_review_reuse SET (security_invoker = true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.efisco_natureza_review_decisions
  TO authenticated, service_role;

GRANT USAGE, SELECT
  ON SEQUENCE public.efisco_natureza_review_decisions_id_seq
  TO authenticated, service_role;

GRANT SELECT ON
  public.efisco_natureza_review_queue,
  public.efisco_natureza_review_summary,
  public.efisco_natureza_review_reuse
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.touch_efisco_natureza_review_decisions()
  TO service_role;

NOTIFY pgrst, 'reload schema';
