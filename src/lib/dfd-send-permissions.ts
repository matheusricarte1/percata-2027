export function canSendDfdToChefia({
  currentUserId,
  solicitanteId,
}: {
  currentUserId?: string | null;
  solicitanteId?: string | null;
}) {
  const requester = String(currentUserId || "").trim();
  const creator = String(solicitanteId || "").trim();
  return requester.length > 0 && requester === creator;
}
