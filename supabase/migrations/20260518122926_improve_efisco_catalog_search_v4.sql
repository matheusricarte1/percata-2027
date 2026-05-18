-- Aproxima a busca do catalogo e-Fisco da estrategia v4:
-- normalizacao tecnica, sinonimos por dominio, intent produto/servico/peca/tabela,
-- densidade no nome-base, frase contigua, penalidade contextual e diversidade por prefixo.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.catalogo_normalize_text(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  WITH prepared AS (
    SELECT regexp_replace(
      regexp_replace(coalesce(input_text, ''), '([0-9]),([0-9])', '\1.\2', 'g'),
      '\m([0-9]{1,2})\.?000\s*(btus?|btu/h)\M',
      '\1 000 \2',
      'gi'
    ) AS value
  )
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(extensions.unaccent(value)), '(º|°)\s*gl', ' gl', 'g'),
        '%',
        ' gl ',
        'g'
      ),
      '[^a-z0-9.]+',
      ' ',
      'g'
    ),
    '\s+',
    ' ',
    'g'
  ))
  FROM prepared;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_search_stopwords()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'a', 'as', 'ao', 'aos', 'e', 'o', 'os', 'de', 'da', 'das', 'do', 'dos',
    'em', 'na', 'nas', 'no', 'nos', 'para', 'por', 'com', 'um', 'uma',
    'uns', 'umas', 'tipo'
  ];
$$;

INSERT INTO public.catalogo_search_synonyms (term_norm, expansion_norm)
VALUES
  ('vidracaria', 'vidracaria|vidro|box|espelho|janela|blindex|temperado|vitrine|porta de vidro'),
  ('vidraceiro', 'vidracaria|vidro|box|espelho|janela|blindex|temperado|vitrine|porta de vidro'),
  ('marcenaria', 'marcenaria|madeira|mdf|compensado|armario|bancada|movel planejado|carpintaria'),
  ('marceneiro', 'marcenaria|madeira|mdf|compensado|armario|bancada|movel planejado|carpintaria'),
  ('gessaria', 'gessaria|gesso|drywall|forro|sanca|placa de gesso|parede de gesso'),
  ('gesseiro', 'gessaria|gesso|drywall|forro|sanca|placa de gesso|parede de gesso'),
  ('serralharia', 'serralharia|ferro|aco|grade|portao|corrimao|estrutura metalica'),
  ('serralheiro', 'serralharia|ferro|aco|grade|portao|corrimao|estrutura metalica'),
  ('marmoraria', 'marmoraria|marmore|granito|pedra|bancada'),
  ('alcool', 'alcool|alcoolico|gl|inpm|graus gay lussac'),
  ('álcool', 'alcool|alcoolico|gl|inpm|graus gay lussac'),
  ('controle de acesso', 'controle de acesso|biometria|biometrico|facial|catraca|reconhecimento facial'),
  ('biometria facial', 'controle de acesso|biometria|biometrico|facial|catraca|reconhecimento facial'),
  ('bipap', 'bipap|cpap|ventilacao nao invasiva|vni|ventilador pulmonar'),
  ('ventilacao nao invasiva', 'bipap|cpap|ventilacao nao invasiva|vni|ventilador pulmonar'),
  ('ventilação não invasiva', 'bipap|cpap|ventilacao nao invasiva|vni|ventilador pulmonar'),
  ('torneira banheiro', 'torneira|misturador|registro|metais sanitarios|lavatorio'),
  ('torneira de banheiro', 'torneira|misturador|registro|metais sanitarios|lavatorio'),
  ('lampada led', 'lampada led|led|luminaria|bulbo'),
  ('lâmpada led', 'lampada led|led|luminaria|bulbo'),
  ('manutencao predial', 'manutencao predial|manutencao corretiva|manutencao preventiva|reparo predial|conservacao predial'),
  ('manutenção predial', 'manutencao predial|manutencao corretiva|manutencao preventiva|reparo predial|conservacao predial')
ON CONFLICT (term_norm)
DO UPDATE SET expansion_norm = EXCLUDED.expansion_norm;

CREATE OR REPLACE FUNCTION public.catalogo_query_expansion_parts(input_text TEXT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
  WITH normalized AS (
    SELECT public.catalogo_normalize_text(input_text) AS q
  ),
  matched_synonyms AS (
    SELECT s.expansion_norm
    FROM public.catalogo_search_synonyms s, normalized n
    WHERE n.q <> ''
      AND (
        n.q LIKE '%' || public.catalogo_normalize_text(s.term_norm) || '%'
        OR public.catalogo_normalize_text(s.term_norm) LIKE '%' || n.q || '%'
      )
  ),
  phrase_parts AS (
    SELECT public.catalogo_normalize_text(regexp_split_to_table(expansion_norm, '\s*\|\s*')) AS part
    FROM matched_synonyms
  ),
  parts AS (
    SELECT part FROM phrase_parts
    UNION ALL
    SELECT regexp_split_to_table(part, '\s+') AS part FROM phrase_parts
    UNION ALL
    SELECT regexp_split_to_table((SELECT q FROM normalized), '\s+') AS part
  )
  SELECT coalesce(array_agg(DISTINCT part), ARRAY[]::TEXT[])
  FROM parts
  WHERE length(part) >= 3
    AND NOT part = ANY(public.catalogo_search_stopwords());
$$;

CREATE OR REPLACE FUNCTION public.catalogo_detect_search_intent(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  WITH q AS (
    SELECT public.catalogo_normalize_text(input_text) AS value
  )
  SELECT CASE
    WHEN value ~ '\m(sinapi|orse|seinfra|seduc|tabela|composicao)\M' THEN 'tabela'
    WHEN value ~ '\m(vidracaria|marcenaria|gessaria|serralharia|marmoraria)\M'
      AND value ~ '\m(material|materiais|fornecimento|insumo|insumos|inclusive|inclui)\M' THEN 'servico'
    WHEN value ~ '\m(servico|manutencao|instalacao|locacao|contratacao|reparo|corretiva|preventiva|fornecimento|assentamento|transporte|desinsetizacao|dedetizacao)\M' THEN 'servico'
    WHEN value ~ '\m(peca|reposicao|capacitor|helice|filtro|suporte|refil|acessorio)\M' THEN 'peca'
    WHEN value ~ '\m[0-9]+([.][0-9]+)?\s?(mm|cm|m|m2|m3|kg|g|l|ml|btus?|btu/h|w|kw|v|hz|pol|polegadas?|gl|inpm)\M' THEN 'produto'
    WHEN value ~ '\m(material|equipamento|insumo)\M' THEN 'produto'
    ELSE 'qualquer'
  END
  FROM q;
$$;

CREATE OR REPLACE FUNCTION public.catalogo_classify_functional_type(
  descricao TEXT,
  tipo_objeto TEXT,
  tipo TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      public.catalogo_normalize_text(split_part(coalesce(descricao, ''), '-', 1)) AS nome,
      public.catalogo_normalize_text(concat_ws(' ', tipo_objeto, tipo)) AS tipo_text
  )
  SELECT CASE
    WHEN nome ~ '^(tabela|cesta)\s+(sinapi|orse|seinfra|seduc|referencial)' THEN 'tabela'
    WHEN nome ~ '^(peca de reposicao|peca|acessorio|capacitor|helice|filtro|refil)\M' THEN 'peca'
    WHEN nome ~ '^(materiais? de|insumos? de|kit de)\M' THEN 'kit'
    WHEN tipo_text LIKE '%servico%' OR nome ~ '^(servico|manutencao|instalacao|locacao|assentamento|reparo)\M' THEN 'servico'
    ELSE 'principal'
  END
  FROM base;
$$;

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
  normalized_query TEXT := public.catalogo_normalize_text(query_text);
  normalized_category TEXT := public.catalogo_normalize_text(categoria_filtro);
  code_query TEXT := regexp_replace(lower(coalesce(query_text, '')), '[^a-z0-9]', '', 'g');
  is_code_query BOOLEAN;
  returned_rows INTEGER := 0;
  terms tsquery;
  query_intent TEXT := public.catalogo_detect_search_intent(query_text);
  query_parts TEXT[] := ARRAY[]::TEXT[];
  expansion_parts TEXT[] := ARRAY[]::TEXT[];
  query_has_oficio BOOLEAN := FALSE;
  query_has_material BOOLEAN := FALSE;
  oficio_scope_regex TEXT;
  oficio_terms tsquery;
BEGIN
  normalized_category := CASE
    WHEN normalized_category IN ('produto', 'produtos', 'material', 'materiais') THEN 'material'
    WHEN normalized_category IN ('servico', 'servicos') THEN 'servico'
    ELSE coalesce(nullif(normalized_category, ''), 'all')
  END;

  is_code_query := code_query <> '' AND code_query ~ '^[0-9]+$';

  SELECT coalesce(array_agg(term), ARRAY[]::TEXT[])
  INTO query_parts
  FROM regexp_split_to_table(normalized_query, '\s+') AS term
  WHERE length(term) >= 3
    AND NOT term = ANY(public.catalogo_search_stopwords());

  expansion_parts := public.catalogo_query_expansion_parts(query_text);
  query_has_oficio := normalized_query ~ '\m(vidracaria|marcenaria|gessaria|serralharia|marmoraria)\M';
  query_has_material := normalized_query ~ '\m(material|materiais|fornecimento|insumo|insumos|inclusive|inclui)\M';
  oficio_scope_regex := CASE
    WHEN normalized_query ~ '\m(vidracaria|vidraceiro|vidro|box|espelho|blindex)\M'
      THEN '\m(vidracaria|vidraceiro|vidro|box|espelho|blindex|temperado|laminado|vitrine|porta de vidro)\M'
    WHEN normalized_query ~ '\m(marcenaria|marceneiro|carpintaria|madeira|mdf)\M'
      THEN '\m(marcenaria|marceneiro|carpintaria|madeira|mdf|compensado|armario|bancada|movel)\M'
    WHEN normalized_query ~ '\m(gessaria|gesseiro|gesso|drywall)\M'
      THEN '\m(gessaria|gesseiro|gesso|drywall|forro|sanca|placa de gesso|parede de gesso)\M'
    WHEN normalized_query ~ '\m(serralharia|serralheiro|ferro|aco|portao|grade)\M'
      THEN '\m(serralharia|serralheiro|ferro|aco|grade|portao|corrimao|estrutura metalica)\M'
    WHEN normalized_query ~ '\m(marmoraria|marmore|granito|pedra)\M'
      THEN '\m(marmoraria|marmore|granito|pedra|bancada)\M'
    ELSE NULL
  END;
  oficio_terms := CASE
    WHEN normalized_query ~ '\m(vidracaria|vidraceiro|vidro|box|espelho|blindex)\M'
      THEN to_tsquery('portuguese', 'vidro | box | espelho | blindex | temperado | laminado | vitrine')
    WHEN normalized_query ~ '\m(marcenaria|marceneiro|carpintaria|madeira|mdf)\M'
      THEN to_tsquery('portuguese', 'madeira | mdf | compensado | armario | bancada | movel | carpintaria')
    WHEN normalized_query ~ '\m(gessaria|gesseiro|gesso|drywall)\M'
      THEN to_tsquery('portuguese', 'gesso | drywall | forro | sanca')
    WHEN normalized_query ~ '\m(serralharia|serralheiro|ferro|aco|portao|grade)\M'
      THEN to_tsquery('portuguese', 'ferro | aco | grade | portao | corrimao')
    WHEN normalized_query ~ '\m(marmoraria|marmore|granito|pedra)\M'
      THEN to_tsquery('portuguese', 'marmore | granito | pedra | bancada')
    ELSE NULL
  END;

  IF normalized_query <> '' AND is_code_query THEN
    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
           c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
           c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
           c.gnd_preferencial, c.natureza_count, c.unidade_medida, 100::REAL
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND regexp_replace(lower(coalesce(c.codigo_efisco, '')), '[^a-z0-9]', '', 'g') = code_query
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
    LIMIT limit_val OFFSET offset_val;

    GET DIAGNOSTICS returned_rows = ROW_COUNT;
    IF returned_rows > 0 THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
           c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
           c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
           c.gnd_preferencial, c.natureza_count, c.unidade_medida, 80::REAL
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND regexp_replace(lower(coalesce(c.codigo_efisco, '')), '[^a-z0-9]', '', 'g') LIKE code_query || '%'
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
    ORDER BY c.codigo_efisco ASC
    LIMIT limit_val OFFSET offset_val;
    RETURN;
  END IF;

  IF normalized_query = '' THEN
    RETURN QUERY
    SELECT c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe,
           c.tipo_objeto, c.codigo_grupo, c.nome_grupo, c.codigo_classe, c.nome_classe,
           c.codigo_material_servico, c.nome_material_servico, c.codigo_natureza_preferencial,
           c.gnd_preferencial, c.natureza_count, c.unidade_medida, 0::REAL
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
    ORDER BY c.tipo_objeto ASC, c.id ASC
    LIMIT limit_val OFFSET offset_val;
    RETURN;
  END IF;

  terms := public.catalogo_search_tsquery(query_text);

  IF terms IS NULL OR terms::TEXT = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      c.*,
      ts_rank_cd(c.search_vector, terms) AS fts_rank,
      public.catalogo_classify_functional_type(c.descricao, c.tipo_objeto, c.tipo) AS functional_type,
      CASE WHEN c.normalized_search_text LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS phrase_hit,
      CASE WHEN c.normalized_nome_base LIKE normalized_query || '%' THEN 1 ELSE 0 END AS base_prefix_hit,
      CASE WHEN c.normalized_nome_base LIKE '%' || normalized_query || '%' THEN 1 ELSE 0 END AS base_contains_hit,
      CASE
        WHEN cardinality(query_parts) > 0 AND NOT EXISTS (
          SELECT 1
          FROM unnest(query_parts) AS qp
          WHERE c.normalized_search_text NOT LIKE '%' || qp || '%'
        ) THEN 1
        ELSE 0
      END AS all_query_terms_hit,
      (
        SELECT count(*)::REAL
        FROM unnest(query_parts) AS qp
        WHERE c.normalized_nome_base LIKE '%' || qp || '%'
      ) AS base_term_hits,
      greatest(cardinality(regexp_split_to_array(coalesce(c.normalized_nome_base, ''), '\s+')), 1) AS base_word_count,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(expansion_parts) AS ep
          WHERE length(ep) >= 4
            AND c.normalized_nome_base LIKE '%' || ep || '%'
        ) THEN 1
        ELSE 0
      END AS expansion_base_hit,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(expansion_parts) AS ep
          WHERE length(ep) >= 4
            AND c.normalized_search_text LIKE '%' || ep || '%'
        ) THEN 1
        ELSE 0
      END AS expansion_text_hit,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(expansion_parts) AS ep
          WHERE length(ep) >= 4
            AND position(' ' in ep) > 0
            AND ep <> normalized_query
            AND c.normalized_nome_base LIKE '%' || ep || '%'
        ) THEN 1
        ELSE 0
      END AS synonym_phrase_base_hit,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest(query_parts) AS qp
          WHERE position(qp in c.normalized_nome_base) > 0
            AND position(qp in c.normalized_nome_base) <= greatest(length(c.normalized_nome_base) / 3, 1)
        ) THEN 1
        ELSE 0
      END AS early_position_hit,
      CASE
        WHEN query_has_oficio AND query_has_material
          AND (oficio_scope_regex IS NULL OR c.normalized_search_text ~ oficio_scope_regex)
          AND c.normalized_search_text ~ '\m(material|materiais|fornecimento|insumo|insumos|inclusive|inclui)\M'
        THEN 1 ELSE 0
      END AS oficio_material_hit,
      CASE
        WHEN query_has_oficio AND c.normalized_search_text ~ '\m(pedagogico|treinamento|didatico|esportivo|escolar|infantil|brinquedo|jogo|memoria)\M'
        THEN 1
        WHEN query_has_oficio
          AND normalized_query !~ '\m(locacao|evento|stand|camarote|espaco)\M'
          AND c.normalized_nome_base LIKE 'locacao de material equipamento e espaco%'
        THEN 1 ELSE 0
      END AS contextual_block_hit
    FROM public.catalogo c
    WHERE c.tipo_objeto IN ('MATERIAL', 'SERVIÇO')
      AND c.search_vector @@ terms
      AND (
        oficio_terms IS NULL
        OR c.search_vector @@ oficio_terms
      )
      AND (
        oficio_scope_regex IS NULL
        OR c.normalized_search_text ~ oficio_scope_regex
      )
      AND (
        normalized_category = 'all'
        OR (normalized_category = 'material' AND c.tipo_objeto = 'MATERIAL')
        OR (normalized_category = 'servico' AND c.tipo_objeto = 'SERVIÇO')
      )
    ORDER BY
      (
        ts_rank_cd(c.search_vector, terms)
        + CASE WHEN oficio_terms IS NULL THEN 0 ELSE ts_rank_cd(c.search_vector, oficio_terms) END
      ) DESC,
      c.id ASC
    LIMIT greatest(limit_val + offset_val + 260, 320)
  ),
  scored AS (
    SELECT
      c.*,
      (
        (
          (c.fts_rank * 12)
          + (c.phrase_hit * 46)
          + (c.base_prefix_hit * 42)
          + (c.base_contains_hit * 26)
          + (c.all_query_terms_hit * 18)
          + (c.expansion_base_hit * 20)
          + (c.synonym_phrase_base_hit * 98)
          + (c.expansion_text_hit * 8)
          + (c.early_position_hit * 18)
          + ((c.base_term_hits / greatest(c.base_word_count, cardinality(query_parts), 1)) * 90)
          + (c.oficio_material_hit * 55)
        )
        * CASE
            WHEN query_intent = 'produto' AND c.functional_type = 'principal' THEN 1.16
            WHEN query_intent = 'produto' AND c.functional_type = 'kit' THEN 1.04
            WHEN query_intent = 'produto' AND c.functional_type = 'servico' THEN 0.34
            WHEN query_intent = 'produto' AND c.functional_type = 'peca' THEN 0.50
            WHEN query_intent = 'produto' AND c.functional_type = 'tabela' THEN 0.22
            WHEN query_intent = 'servico' AND c.functional_type = 'servico' THEN 1.18
            WHEN query_intent = 'servico' AND c.functional_type = 'kit' THEN 1.06
            WHEN query_intent = 'servico' AND c.functional_type = 'tabela' THEN 0.42
            WHEN query_intent = 'servico' THEN 0.86
            WHEN query_intent = 'peca' AND c.functional_type = 'peca' THEN 1.20
            WHEN query_intent = 'peca' AND c.functional_type = 'principal' THEN 0.82
            WHEN query_intent = 'peca' AND c.functional_type = 'servico' THEN 0.52
            WHEN query_intent = 'peca' AND c.functional_type = 'tabela' THEN 0.28
            WHEN query_intent = 'tabela' AND c.functional_type = 'tabela' THEN 1.25
            WHEN query_intent = 'tabela' THEN 0.62
            WHEN query_intent = 'qualquer' AND c.functional_type = 'tabela' THEN 0.72
            ELSE 1.00
          END
        * CASE WHEN c.contextual_block_hit = 1 THEN 0.35 ELSE 1.00 END
      )::REAL AS score,
      split_part(coalesce(c.normalized_nome_base, ''), ' ', 1) || ' ' ||
      split_part(coalesce(c.normalized_nome_base, ''), ' ', 2) || ' ' ||
      split_part(coalesce(c.normalized_nome_base, ''), ' ', 3) AS prefix_key
    FROM candidates c
  ),
  diversified AS (
    SELECT
      s.*,
      row_number() OVER (PARTITION BY s.prefix_key ORDER BY s.score DESC, s.id ASC) AS prefix_rank
    FROM scored s
  )
  SELECT
    d.id, d.codigo_efisco, d.descricao, d.tipo, d.categoria, d.grupo, d.classe,
    d.tipo_objeto, d.codigo_grupo, d.nome_grupo, d.codigo_classe, d.nome_classe,
    d.codigo_material_servico, d.nome_material_servico,
    d.codigo_natureza_preferencial, d.gnd_preferencial, d.natureza_count,
    d.unidade_medida,
    d.score AS rank
  FROM diversified d
  ORDER BY
    CASE WHEN d.prefix_rank <= 3 THEN 0 ELSE 1 END,
    d.score DESC,
    d.id ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql STABLE;

ALTER FUNCTION public.catalogo_normalize_text(TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_search_stopwords() SET search_path = public;
ALTER FUNCTION public.catalogo_query_expansion_parts(TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_detect_search_intent(TEXT) SET search_path = public;
ALTER FUNCTION public.catalogo_classify_functional_type(TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.buscar_catalogo_inteligente(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public;

NOTIFY pgrst, 'reload schema';
