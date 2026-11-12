import assert from "node:assert/strict";
import test from "node:test";
import * as email from "./email";

test("cria uma notificação de boas-vindas institucional com o modelo welcome", () => {
  const buildWelcome = (email as typeof email & {
    buildOnboardingWelcomeNotification?: (input: {
      userId: string;
      fullName?: string | null;
      campusName?: string | null;
      actionUrl: string;
    }) => { user_id: string; title: string; type: string; message: string };
  }).buildOnboardingWelcomeNotification;

  assert.equal(typeof buildWelcome, "function");
  const notification = buildWelcome!({
    userId: "user-1",
    fullName: "Ana Carolina Silva",
    campusName: "Campus Santo Amaro",
    actionUrl: "https://percata.vercel.app/dashboard",
  });

  assert.equal(notification.user_id, "user-1");
  assert.equal(notification.title, "Seu acesso institucional está pronto");
  assert.equal(notification.type, "success");
  const envelope = JSON.parse(notification.message);
  assert.equal(envelope.template_key, "welcome");
  assert.equal(envelope.cta_url, "https://percata.vercel.app/dashboard");
  assert.match(envelope.body, /Ana Carolina Silva/);
  assert.deepEqual(envelope.facts, [
    { label: "Campus", value: "Campus Santo Amaro" },
    { label: "Perfil", value: "Acesso institucional liberado" },
  ]);
});
