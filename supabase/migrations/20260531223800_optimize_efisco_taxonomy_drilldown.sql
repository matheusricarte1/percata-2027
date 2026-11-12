-- Fast drill-down for admin e-Fisco governance taxonomy tree.
-- Supports class/type expansion into concrete catalog items with codigo_eFisco.

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_classe_tipo_id
  ON efisco_search.catalogo_documents (codigo_classe, tipo_objeto, id);

CREATE INDEX IF NOT EXISTS idx_search_catalogo_documents_grupo_tipo_id
  ON efisco_search.catalogo_documents (codigo_grupo, tipo_objeto, id);
