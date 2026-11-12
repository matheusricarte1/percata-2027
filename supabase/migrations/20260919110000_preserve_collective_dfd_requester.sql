-- A collective DFD must keep the person who opened the room as requester.
-- Conversion/publishing is a workflow action and must never take ownership.
WITH corrected AS (
  UPDATE public.dfds d
  SET solicitante_id = r.created_by
  FROM public.dfd_collective_rooms r
  WHERE d.origin_type = 'collective'
    AND d.collective_origin_room_id = r.id
    AND d.solicitante_id IS DISTINCT FROM r.created_by
  RETURNING d.id, d.numero_protocolo, d.solicitante_id AS previous_requester, r.created_by AS requester_id
)
INSERT INTO public.dfd_logs (dfd_id, user_id, action, details)
SELECT
  id,
  requester_id,
  'solicitante_coletivo_corrigido',
  jsonb_build_object(
    'reason', 'Correção de autoria coletiva: a conversão não altera o solicitante.',
    'previous_requester_id', previous_requester,
    'requester_id', requester_id
  )::text
FROM corrected;

NOTIFY pgrst, 'reload schema';
