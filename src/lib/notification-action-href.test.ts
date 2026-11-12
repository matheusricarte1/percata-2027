import assert from "node:assert/strict";
import { test } from "node:test";
import { notificationActionHref } from "./notification-action-href";

test("notificação abre a DFD por caminho interno, preservando consulta e fragmento", () => {
  assert.equal(notificationActionHref("/dfd/abc?origem=aviso#correcao"), "/dfd/abc?origem=aviso#correcao");
  assert.equal(notificationActionHref("https://percata.vercel.app/dfd/abc"), "https://percata.vercel.app/dfd/abc");
});

test("notificação rejeita scripts e caminhos que podem desviar para outro domínio", () => {
  for (const href of ["javascript:alert(1)", "//outro.example/dfd", "/\\outro.example", "data:text/html,test", "", "/\n/outro.example"]) {
    assert.equal(notificationActionHref(href), null);
  }
});
