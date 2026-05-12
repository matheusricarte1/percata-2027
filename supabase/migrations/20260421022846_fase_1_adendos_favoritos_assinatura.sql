-- ADICIONANDO TABELA DE FAVORITOS
CREATE TABLE IF NOT EXISTS catalogo_favoritos (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES catalogo(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY(user_id, item_id)
);

-- GARANTINDO CAMPOS DE CONTROLE NA DFD_ITEMS SE NÃO EXISTIREM
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dfd_items' AND column_name='prioridade_item') THEN
    ALTER TABLE public.dfd_items ADD COLUMN prioridade_item INTEGER DEFAULT 3;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='dfd_items' AND column_name='is_highlight_item') THEN
    ALTER TABLE public.dfd_items ADD COLUMN is_highlight_item BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
;
