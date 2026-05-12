-- TABELA DE LOGS PARA TIMELINE
CREATE TABLE IF NOT EXISTS dfd_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dfd_id UUID REFERENCES dfds(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'criacao', 'envio', 'homologacao', 'devolucao', 'edicao'
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ADICIONANDO CAMPOS DE CATEGORIA AOS KITS
ALTER TABLE kits ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Geral';

-- TRIGGER PARA LOGAR ESTATUTOS AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION log_dfd_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS NULL OR OLD.status <> NEW.status THEN
    INSERT INTO dfd_logs (dfd_id, action, details)
    VALUES (NEW.id, NEW.status, 'Status alterado para ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_dfd_status
AFTER INSERT OR UPDATE ON dfds
FOR EACH ROW
EXECUTE FUNCTION log_dfd_changes();
;
