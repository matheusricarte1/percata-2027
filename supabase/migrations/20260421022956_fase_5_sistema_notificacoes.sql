CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gatilho para notificar usuário quando a DFD muda de status
CREATE OR REPLACE FUNCTION notify_dfd_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      NEW.solicitante_id,
      'Sua DFD mudou de status',
      'O status da sua demanda foi alterado de ' || OLD.status || ' para ' || NEW.status || '.',
      CASE 
        WHEN NEW.status = 'aprovada' THEN 'success'
        WHEN NEW.status = 'devolvida' THEN 'warning'
        ELSE 'info'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_dfd_status
AFTER UPDATE ON dfds
FOR EACH ROW
EXECUTE FUNCTION notify_dfd_status_change();
;
