CREATE TABLE IF NOT EXISTS public.historico_demandas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ano_referencia INTEGER NOT NULL,
    codigo_dfd TEXT,
    objeto TEXT NOT NULL,
    campus TEXT,
    solicitante_email TEXT,
    valor_total DECIMAL(15,2),
    itens_json JSONB DEFAULT '[]'::jsonb,
    status_final TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.historico_demandas ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios históricos baseados no e-mail
CREATE POLICY "Users can view their own historical demands" 
ON public.historico_demandas 
FOR SELECT 
USING (auth.jwt() ->> 'email' = solicitante_email);

-- Adicionar índices para performance
CREATE INDEX idx_historico_email ON public.historico_demandas(solicitante_email);
CREATE INDEX idx_historico_ano ON public.historico_demandas(ano_referencia);
;
