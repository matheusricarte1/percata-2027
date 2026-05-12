CREATE TABLE IF NOT EXISTS public.catalogo (
    id BIGSERIAL PRIMARY KEY,
    codigo_efisco TEXT UNIQUE,
    descricao TEXT,
    tipo TEXT,
    categoria TEXT,
    grupo TEXT,
    classe TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index para busca rápida por texto e código
CREATE INDEX IF NOT EXISTS idx_catalogo_descricao ON public.catalogo USING gin (to_tsvector('portuguese', descricao));
CREATE INDEX IF NOT EXISTS idx_catalogo_codigo ON public.catalogo (codigo_efisco);
;
