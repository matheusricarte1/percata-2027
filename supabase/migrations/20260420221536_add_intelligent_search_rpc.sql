CREATE OR REPLACE FUNCTION buscar_catalogo_inteligente(
  query_text TEXT,
  categoria_filtro TEXT DEFAULT 'all',
  limit_val INT DEFAULT 30,
  offset_val INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  codigo_efisco TEXT,
  descricao TEXT,
  tipo TEXT,
  categoria TEXT,
  grupo TEXT,
  classe TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, 
    c.codigo_efisco, 
    c.descricao, 
    c.tipo, 
    c.categoria, 
    c.grupo, 
    c.classe,
    CASE 
      WHEN query_text = '' THEN 0 
      ELSE ts_rank_cd(to_tsvector('portuguese', c.descricao), plainto_tsquery('portuguese', query_text)) 
    END as rank
  FROM catalogo c
  WHERE 
    (query_text = '' OR to_tsvector('portuguese', c.descricao) @@ plainto_tsquery('portuguese', query_text))
    AND (categoria_filtro = 'all' OR c.tipo = categoria_filtro)
  ORDER BY 
    CASE WHEN query_text = '' THEN 0 ELSE rank END DESC,
    c.descricao ASC
  LIMIT limit_val
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;
;
