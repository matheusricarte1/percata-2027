import assert from "node:assert/strict";
import test from "node:test";
import { deleteCollectiveRoom, RoomDeletionError } from "./collective-room-deletion";
const room = { id: "room", title: "Sala teste", status: "aberta" };
function deps(role = "superadmin") { let removed = false; return { role, confirmation: room.title, findRoom: async () => room, hasLinkedDfds: async () => false, removeRoom: async () => { removed = true; return true; }, wasRemoved: () => removed }; }
test("exclusão é exclusiva do superadmin e exige título correto", async () => {
  for (const role of ["membro", "chefia", "admin"]) { const d = deps(role); await assert.rejects(deleteCollectiveRoom(d), (error: unknown) => error instanceof RoomDeletionError && error.status === 403); assert.equal(d.wasRemoved(), false); }
  const d = deps(); await assert.rejects(deleteCollectiveRoom({ ...d, confirmation: "outro título" }), (error: unknown) => error instanceof RoomDeletionError && error.status === 400); assert.equal(d.wasRemoved(), false);
});
test("salas convertidas, prontas e com DFD vinculada são preservadas", async () => {
  for (const status of ["convertida", "pronta_para_conversao"]) { const d = deps(); await assert.rejects(deleteCollectiveRoom({ ...d, findRoom: async () => ({ ...room, status }) })); assert.equal(d.wasRemoved(), false); }
  const d = deps(); await assert.rejects(deleteCollectiveRoom({ ...d, hasLinkedDfds: async () => true })); assert.equal(d.wasRemoved(), false);
});
test("exclusão confirmada exige remoção efetiva de uma sala", async () => {
  const d = deps(); assert.deepEqual(await deleteCollectiveRoom(d), { deleted: true, id: room.id }); assert.equal(d.wasRemoved(), true);
  await assert.rejects(deleteCollectiveRoom({ ...deps(), removeRoom: async () => false }), (error: unknown) => error instanceof RoomDeletionError && error.status === 409);
});
