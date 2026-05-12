-- 1. ESTRUTURA ORGANIZACIONAL (CAMPI, DEPTOS, LABS)
CREATE TABLE IF NOT EXISTS campi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  sigla TEXT NOT NULL UNIQUE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID REFERENCES campi(id),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS laboratorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RELACIONAMENTO USUÁRIO <-> UNIDADES (N:N)
CREATE TABLE IF NOT EXISTS user_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_type TEXT CHECK (unit_type IN ('departamento', 'laboratorio')),
  unit_id UUID NOT NULL,
  role_in_unit TEXT DEFAULT 'membro', -- 'membro', 'chefia'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, unit_type, unit_id)
);

-- 3. AJUSTES NA TABELA PROFILES (Adaptando para o novo modelo)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='campus_id') THEN
    ALTER TABLE public.profiles ADD COLUMN campus_id UUID REFERENCES campi(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='signature_hash') THEN
    ALTER TABLE public.profiles ADD COLUMN signature_hash TEXT;
  END IF;
END $$;

-- 4. REFINAMENTO DAS DFDS
ALTER TABLE public.dfds 
  ADD COLUMN IF NOT EXISTS justificativa_quantidade TEXT,
  ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES campi(id),
  ADD COLUMN IF NOT EXISTS unidade_id UUID,
  ADD COLUMN IF NOT EXISTS tipo_unidade TEXT,
  ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS versao INTEGER DEFAULT 1;

-- 5. REFINAMENTO DOS ITENS DA DFD
ALTER TABLE public.dfd_items
  ADD COLUMN IF NOT EXISTS justificativa_item TEXT,
  ADD COLUMN IF NOT EXISTS local_uso TEXT,
  ADD COLUMN IF NOT EXISTS link_referencia TEXT;

-- Nota: preco_total será calculado via View ou aplicação para evitar problemas com colunas geradas existentes.

-- 6. PERIODOS DE CICLO (PLANEJAMENTO)
CREATE TABLE IF NOT EXISTS periodos_ciclo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano_referencia INTEGER NOT NULL UNIQUE,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'analise')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. KITS / MODELOS DE DFDS
CREATE TABLE IF NOT EXISTS kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  classe_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID REFERENCES kits(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES catalogo(id),
  quantidade INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SEED INICIAL DE CAMPI
INSERT INTO campi (nome, sigla) VALUES 
  ('Campus Petrolina', 'PTR'),
  ('Campus Ouricuri', 'OUR'),
  ('Campus Salgueiro', 'SLG')
ON CONFLICT DO NOTHING;
;
