ALTER TABLE public.catalogo
  DROP COLUMN IF EXISTS situacao_classe,
  DROP COLUMN IF EXISTS situacao_material_servico,
  DROP COLUMN IF EXISTS data_inclusao_item,
  DROP COLUMN IF EXISTS situacao_item,
  DROP COLUMN IF EXISTS descricao_grupo,
  DROP COLUMN IF EXISTS situacao_grupo;
