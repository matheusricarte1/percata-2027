-- Separa a busca textual por categoria para evitar plano generico lento.

DROP FUNCTION IF EXISTS public.buscar_catalogo_inteligente(TEXT, TEXT, INT, INT);

CREATE OR REPLACE FUNCTION public.buscar_catalogo_inteligente(
  query_text TEXT,
  categoria_filtro TEXT DEFAULT 'all',
  limit_val INT DEFAULT 30,
  offset_val INT DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  codigo_efisco TEXT,
  descricao TEXT,
  tipo TEXT,
  categoria TEXT,
  grupo TEXT,
  classe TEXT,
  tipo_objeto TEXT,
  codigo_grupo TEXT,
  nome_grupo TEXT,
  codigo_classe TEXT,
  nome_classe TEXT,
  codigo_material_servico TEXT,
  nome_material_servico TEXT,
  codigo_natureza_preferencial TEXT,
  gnd_preferencial TEXT,
  natureza_count INTEGER,
  unidade_medida TEXT,
  rank REAL
) AS $$
DECLARE
  normalized_query TEXT := trim(lower(coalesce(query_text, '')));
  normalized_category TEXT := trim(lower(coalesce(categoria_filtro, 'all')));
  is_code_query BOOLEAN;
  returned_rows INTEGER := 0;
BEGIN
  normalized_query := regexp_replace(normalized_query, '\s+', ' ', 'g');
  normalized_category := CASE
    WHEN normalized_category IN ('produto', 'produtos', 'material', 'materiais') THEN 'material'
    WHEN normalized_category IN ('servico', 'servicos', 'serviço', 'serviços') THEN 'servico'
    ELSE normalized_category
  END;
  is_code_query := normalized_query ~ '^[a-z0-9.\-_/]+$' AND position(' ' in normalized_query) = 0;

  IF normalized_query = '' THEN
    IF normalized_category = 'material' THEN
      RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL FROM public.catalogo c WHERE c.tipo_objeto = 'MATERIAL' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
    ELSIF normalized_category = 'servico' THEN
      RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL FROM public.catalogo c WHERE c.tipo_objeto = 'SERVIÇO' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
    ELSE
      RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL FROM public.catalogo c WHERE c.tipo_objeto IS NOT NULL ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
    END IF;
    RETURN;
  END IF;

  IF is_code_query THEN
    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 1.6::REAL
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) = normalized_query
      AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
    LIMIT limit_val OFFSET offset_val;

    GET DIAGNOSTICS returned_rows = ROW_COUNT;
    IF returned_rows > 0 THEN RETURN; END IF;

    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0.8::REAL
    FROM public.catalogo c
    WHERE lower(c.codigo_efisco) LIKE normalized_query || '%'
      AND (normalized_category = 'all' OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL') OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO'))
    ORDER BY c.codigo_efisco ASC
    LIMIT limit_val OFFSET offset_val;
    RETURN;
  END IF;

  IF normalized_category = 'material' THEN
    RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0.8::REAL FROM public.catalogo c WHERE c.tipo_objeto = 'MATERIAL' AND left(lower(c.descricao), 160) LIKE normalized_query || '%' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
  ELSIF normalized_category = 'servico' THEN
    RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0.8::REAL FROM public.catalogo c WHERE c.tipo_objeto = 'SERVIÇO' AND left(lower(c.descricao), 160) LIKE normalized_query || '%' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
  ELSE
    RETURN QUERY SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe, c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial, c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0.8::REAL FROM public.catalogo c WHERE c.tipo_objeto IS NOT NULL AND left(lower(c.descricao), 160) LIKE normalized_query || '%' ORDER BY c.id ASC LIMIT limit_val OFFSET offset_val;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

NOTIFY pgrst, 'reload schema';
