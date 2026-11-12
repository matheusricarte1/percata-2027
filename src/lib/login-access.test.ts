import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ACCESS_DENIED_CONTACT_EMAIL,
  ACCESS_DENIED_MESSAGE,
  decideLoginAccess,
} from "./login-access.ts";

describe("login-access", () => {
  it("allows an active profile", () => {
    const decision = decideLoginAccess({
      profiles: { data: [{ is_active: true }] },
      legacyUsers: { data: [] },
      legacyLinks: { data: [] },
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.reason, "active_profile");
  });

  it("allows legacy users even when no active profile exists", () => {
    const directoryDecision = decideLoginAccess({
      profiles: { data: [] },
      legacyUsers: { data: [{ id: "legacy-user" }] },
      legacyLinks: { data: [] },
    });
    const linkDecision = decideLoginAccess({
      profiles: { data: [{ is_active: false }] },
      legacyUsers: { data: [] },
      legacyLinks: { data: [{ id: "legacy-link" }] },
    });

    assert.equal(directoryDecision.allowed, true);
    assert.equal(directoryDecision.reason, "legacy_user");
    assert.equal(linkDecision.allowed, true);
    assert.equal(linkDecision.reason, "legacy_user");
  });

  it("blocks users absent from both active and legacy lists with the contact email", () => {
    const decision = decideLoginAccess({
      profiles: { data: [] },
      legacyUsers: { data: [] },
      legacyLinks: { data: [] },
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "not_registered_active_or_legacy");
    assert.match(ACCESS_DENIED_MESSAGE, /cadastro ativo ou legado/i);
    assert.match(ACCESS_DENIED_MESSAGE, new RegExp(ACCESS_DENIED_CONTACT_EMAIL));
  });

  it("blocks on lookup errors instead of falling back open", () => {
    const decision = decideLoginAccess({
      profiles: { error: new Error("db unavailable"), data: [{ is_active: true }] },
      legacyUsers: { data: [{ id: "legacy-user" }] },
      legacyLinks: { data: [] },
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "profile_lookup_error");
  });
});
