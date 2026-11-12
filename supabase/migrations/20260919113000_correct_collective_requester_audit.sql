-- The first backfill recorded RETURNING values after the update. Preserve its
-- immutable audit row and append the actual workflow actor that was replaced.
INSERT INTO public.dfd_logs (dfd_id, user_id, action, details)
SELECT
  d.id,
  r.created_by,
  'solicitante_coletivo_auditoria_corrigida',
  jsonb_build_object(
    'reason', 'Complemento de auditoria da correção de autoria coletiva.',
    'previous_requester_id', r.published_by,
    'requester_id', r.created_by,
    'note', 'O registro anterior preserva o resultado da atualização; este evento preserva o ator de fluxo substituído.'
  )::text
FROM public.dfds d
JOIN public.dfd_collective_rooms r ON r.id = d.collective_origin_room_id
WHERE d.origin_type = 'collective'
  AND r.published_by IS NOT NULL
  AND r.published_by IS DISTINCT FROM r.created_by
  AND EXISTS (
    SELECT 1 FROM public.dfd_logs l
    WHERE l.dfd_id = d.id
      AND l.action = 'solicitante_coletivo_corrigido'
  );

NOTIFY pgrst, 'reload schema';
