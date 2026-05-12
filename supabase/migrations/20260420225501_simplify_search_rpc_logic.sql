DROP FUNCTION IF EXISTS buscar_catalogo_inteligente(text,text,integer,integer);

CREATE OR REPLACE FUNCTION buscar_catalogo_inteligente(
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
  rank REAL
) AS $$
BEGIN
  -- Se a busca estiver vazia, retorna os itens por ID (muito mais rápido e seguro)
  IF query_text IS NULL OR query_text = '' THEN
    RETURN QUERY
    SELECT 
      c.id, c.codigo_efisco, c.descricao, c.tipo, c.categoria, c.grupo, c.classe, 0::REAL as rank
    FROM catalogo c
    WHERE (categoria_filtro = 'all' OR c.tipo = categoria_filtro)
    ORDER BY c.id ASC
    LIMIT limit_val
    OFFSET offset_val;
  ELSE
    -- Se houver texto, usa o ranking de relevância
    RETURN QUERY
    SELECT 
      c.id, 
      c.codigo_efisco, 
      c.descricao, 
      c.tipo, 
      c.categoria, 
      c.grupo, 
      c.classe,
      ts_rank_cd(to_tsvector('portuguese', c.descricao), plainto_tsquery('portuguese', query_text)) as rank
    FROM catalogo c
    WHERE 
      to_tsvector('portuguese', c.descricao) @@ plainto_tsquery('portuguese', query_text)
      AND (categoria_filtro = 'all' OR c.tipo = categoria_filtro)
    ORDER BY rank DESC, c.id ASC
    LIMIT limit_val
    OFFSET offset_val;
  END IF;
END;
$$ LANGUAGE plpgsql;
;
