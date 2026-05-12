-- Amplia sinonimos de busca para termos comuns usados pelos solicitantes.

INSERT INTO public.catalogo_search_synonyms (term_norm, expansion_norm)
VALUES
  ('datashow', 'datashow|data show|projetor|projetor multimidia|equipamento de projecao'),
  ('data show', 'datashow|data show|projetor|projetor multimidia|equipamento de projecao'),
  ('projetor', 'projetor|projetor multimidia|datashow|data show|equipamento de projecao'),
  ('projetor multimidia', 'projetor|projetor multimidia|datashow|data show|equipamento de projecao'),
  ('tv', 'tv|televisor|televisao|smart tv'),
  ('televisor', 'tv|televisor|televisao|smart tv'),
  ('televisao', 'tv|televisor|televisao|smart tv'),
  ('desktop', 'desktop|computador|microcomputador|estacao de trabalho'),
  ('computador', 'desktop|computador|microcomputador|estacao de trabalho'),
  ('notebook', 'notebook|laptop|computador portatil|microcomputador portatil'),
  ('laptop', 'notebook|laptop|computador portatil|microcomputador portatil'),
  ('impressora', 'impressora|multifuncional|equipamento de impressao'),
  ('multifuncional', 'impressora|multifuncional|equipamento de impressao')
ON CONFLICT (term_norm)
DO UPDATE SET expansion_norm = EXCLUDED.expansion_norm;

NOTIFY pgrst, 'reload schema';
