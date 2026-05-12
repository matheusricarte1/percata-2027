-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'solicitante', -- solicitante, chefia, admin
  campus TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DFDs Table
CREATE TABLE IF NOT EXISTS dfds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_protocolo TEXT UNIQUE NOT NULL,
  objeto_contratacao TEXT NOT NULL,
  justificativa_contratacao TEXT NOT NULL,
  campus TEXT NOT NULL,
  solicitante_id UUID REFERENCES auth.users NOT NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'triagem', 'devolvida', 'aprovada', 'pactuando', 'concluida')),
  previsao_recebimento DATE,
  valor_total_estimado NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DFD Items Table
CREATE TABLE IF NOT EXISTS dfd_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dfd_id UUID REFERENCES dfds ON DELETE CASCADE NOT NULL,
  codigo_tce TEXT NOT NULL,
  descricao TEXT NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  valor_unitario_estimado NUMERIC NOT NULL,
  justificativa_quantidade TEXT,
  gnd TEXT NOT NULL,
  grupo_justificativa_id TEXT
);

-- Catalogo e-Fisco Table
CREATE TABLE IF NOT EXISTS catalogo_efisco (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_tce TEXT UNIQUE NOT NULL,
  descricao TEXT NOT NULL,
  gnd TEXT NOT NULL,
  valor_estimado_base NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfds ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfd_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_efisco ENABLE ROW LEVEL SECURITY;

-- Profils: Anyone can read, only owner can update
CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

-- DFDs Policies
CREATE POLICY "Individuals can view their own DFDs." ON dfds FOR SELECT USING (auth.uid() = solicitante_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('chefia', 'admin')));
CREATE POLICY "Individuals can create DFDs." ON dfds FOR INSERT WITH CHECK (auth.uid() = solicitante_id);
CREATE POLICY "Individuals can update their own DFDs." ON dfds FOR UPDATE USING (auth.uid() = solicitante_id AND status = 'rascunho');

-- DFD Items Policies
CREATE POLICY "Items viewable by DFD owner/admin." ON dfd_items FOR SELECT USING (EXISTS (SELECT 1 FROM dfds WHERE id = dfd_id AND (solicitante_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('chefia', 'admin')))));
CREATE POLICY "Items insetable by DFD owner." ON dfd_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM dfds WHERE id = dfd_id AND solicitante_id = auth.uid()));

-- Catalogo: Read only for everyone
CREATE POLICY "Catalogo is viewable by all authenticated users" ON catalogo_efisco FOR SELECT USING (auth.role() = 'authenticated');
;
