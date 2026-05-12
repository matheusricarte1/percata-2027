import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canSendDfdToChefia } from "./dfd-send-permissions.ts";

describe("dfd-send-permissions", () => {
  it("allows only the DFD creator to send it to chefia", () => {
    assert.equal(
      canSendDfdToChefia({
        currentUserId: "creator-1",
        solicitanteId: "creator-1",
      }),
      true,
    );

    assert.equal(
      canSendDfdToChefia({
        currentUserId: "admin-1",
        solicitanteId: "creator-1",
      }),
      false,
    );
  });

  it("rejects missing user ids", () => {
    assert.equal(canSendDfdToChefia({ currentUserId: null, solicitanteId: "creator-1" }), false);
    assert.equal(canSendDfdToChefia({ currentUserId: "creator-1", solicitanteId: null }), false);
  });
});
