import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeAccessLock,
  shouldBlockForAccessLock,
} from "./system-access.ts";

describe("system-access", () => {
  it("blocks authenticated non-superadmin users when the global lock is enabled", () => {
    const lock = normalizeAccessLock({ enabled: true, message: "Manutenção" });

    assert.equal(shouldBlockForAccessLock(lock, "solicitante", "/dashboard"), true);
    assert.equal(shouldBlockForAccessLock(lock, "admin", "/admin/configuracoes"), true);
    assert.equal(shouldBlockForAccessLock(lock, "chefia", "/triagem"), true);
  });

  it("never blocks superadmin or the blocked notice page", () => {
    const lock = normalizeAccessLock({ enabled: true });

    assert.equal(shouldBlockForAccessLock(lock, "superadmin", "/dashboard"), false);
    assert.equal(shouldBlockForAccessLock(lock, "solicitante", "/acesso-bloqueado"), false);
  });

  it("does not block anyone when the global lock is disabled", () => {
    const lock = normalizeAccessLock({ enabled: false });

    assert.equal(shouldBlockForAccessLock(lock, "solicitante", "/dashboard"), false);
  });
});
