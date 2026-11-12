import assert from "node:assert/strict";
import test from "node:test";

import { renderSystemEmailForPreview } from "./email";

test("uses a people-first editorial introduction for operational e-mails", () => {
  const html = renderSystemEmailForPreview({
    to: "servidor@upe.br",
    subject: "PERCATA • DFD devolvida para ajustes",
    text: "A chefia registrou uma solicitação de ajuste.",
    templateKey: "dfd_returned",
    actionUrl: "https://percata.vercel.app/dashboard",
  });

  assert.match(html, /Sua demanda pode seguir/);
  assert.match(html, /o que precisa ser ajustado/);
});

test("explains the practical benefit of a broadcast before asking for action", () => {
  const html = renderSystemEmailForPreview({
    to: "servidor@upe.br",
    subject: "PERCATA • O ciclo de planejamento está aberto",
    text: "O ciclo foi aberto.",
    templateKey: "broadcast_announcement",
    actionUrl: "https://percata.vercel.app/dashboard",
  });

  assert.match(html, /sua unidade precisa para funcionar/);
  assert.match(html, /planejamento institucional/);
});

test("uses a restrained masthead where the state is metadata, not a competing pill", () => {
  const html = renderSystemEmailForPreview({
    to: "servidor@upe.br",
    subject: "PERCATA • Comunicado",
    text: "Há uma atualização institucional.",
    templateKey: "broadcast_announcement",
  });

  assert.match(html, /Comunicação institucional/);
  assert.match(html, /PERCATA/);
  assert.doesNotMatch(html, /background:#FFFFFF;padding:7px 10px/);
});
