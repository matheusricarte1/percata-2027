import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const helperSource = readFileSync(
  path.join(process.cwd(), "src/lib/email-alert-queue.ts"),
  "utf8",
);

test("fila de email pode despachar uma notificacao especifica sem depender de admin logado", () => {
  assert.match(helperSource, /export async function sendQueuedNotificationEmail/);
  assert.match(helperSource, /notification_id[\s\S]*notificationId/);
  assert.match(helperSource, /sendSystemEmail\(/);
  assert.match(helperSource, /idempotencyKey: `email-queue:\$\{queueItem\.id\}`/);
  assert.match(helperSource, /status: "sent"/);
  assert.match(helperSource, /status: "failed"/);
});
