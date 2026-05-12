-- Dedetizacao deve expandir para conceitos de servico, nao para pragas soltas.

INSERT INTO public.catalogo_search_synonyms (term_norm, expansion_norm)
VALUES
  ('dedetizacao', 'dedetizacao|desinfestacao|desinsetizacao|controle de pragas'),
  ('dedetização', 'dedetizacao|desinfestacao|desinsetizacao|controle de pragas'),
  ('desinsetizacao', 'dedetizacao|desinfestacao|desinsetizacao|controle de pragas'),
  ('controle pragas', 'dedetizacao|desinfestacao|desinsetizacao|controle de pragas')
ON CONFLICT (term_norm)
DO UPDATE SET expansion_norm = EXCLUDED.expansion_norm;

NOTIFY pgrst, 'reload schema';
