type Room = { id: string; title: string; status: string };
export class RoomDeletionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function deleteCollectiveRoom(deps: {
  role: string; confirmation: string;
  findRoom: () => Promise<Room | null>;
  hasLinkedDfds: () => Promise<boolean>;
  removeRoom: (room: Room) => Promise<boolean>;
}) {
  if (deps.role !== "superadmin") throw new RoomDeletionError("Somente o superadmin pode excluir salas coletivas.", 403);
  const room = await deps.findRoom();
  if (!room) throw new RoomDeletionError("Sala coletiva não encontrada.", 404);
  if (room.status === "convertida" || room.status === "pronta_para_conversao" || await deps.hasLinkedDfds()) {
    throw new RoomDeletionError("Esta sala está pronta para conversão ou já possui DFD oficial e não pode ser excluída.", 409);
  }
  if (deps.confirmation.trim() !== room.title.trim()) throw new RoomDeletionError("Digite o título da sala para confirmar a exclusão.", 400);
  if (!await deps.removeRoom(room)) throw new RoomDeletionError("A sala mudou durante a operação. Atualize a lista e confira novamente.", 409);
  return { deleted: true, id: room.id };
}
