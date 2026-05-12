import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getEmailProviderStatus } from "./email.ts";

const originalEmailRedirectTo = process.env.EMAIL_REDIRECT_TO;

afterEach(() => {
  if (originalEmailRedirectTo === undefined) {
    delete process.env.EMAIL_REDIRECT_TO;
  } else {
    process.env.EMAIL_REDIRECT_TO = originalEmailRedirectTo;
  }
});

describe("email provider status", () => {
  it("does not redirect emails by default", () => {
    delete process.env.EMAIL_REDIRECT_TO;

    const status = getEmailProviderStatus();

    assert.equal(status.redirectTo, null);
  });

  it("keeps explicit redirect for controlled test environments", () => {
    process.env.EMAIL_REDIRECT_TO = " teste@upe.br ";

    const status = getEmailProviderStatus();

    assert.equal(status.redirectTo, "teste@upe.br");
  });

  it("accepts off as an explicit redirect disable flag", () => {
    process.env.EMAIL_REDIRECT_TO = "off";

    const status = getEmailProviderStatus();

    assert.equal(status.redirectTo, null);
  });
});
