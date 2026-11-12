import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readDfdCartHydration } from "./dfd-cart-sync.ts";

describe("dfd-cart-sync", () => {
  it("não tenta acessar a persistência do navegador durante a renderização no servidor", () => {
    assert.equal(readDfdCartHydration(undefined), false);
  });

  it("usa o estado hidratado quando a persistência do navegador está disponível", () => {
    assert.equal(readDfdCartHydration({ hasHydrated: () => true }), true);
  });
});
