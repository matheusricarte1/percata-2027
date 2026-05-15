import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getAuthCallbackUrl, getPublicSiteOrigin, toPublicSiteUrl } from "./site-url.ts";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }

  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("site-url", () => {
  it("uses the configured public site origin before request origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "percata.vercel.app/";

    assert.equal(
      getAuthCallbackUrl("https://endereco-antigo.vercel.app"),
      "https://percata.vercel.app/auth/callback",
    );
  });

  it("falls back to the request origin outside production", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    assert.equal(
      getPublicSiteOrigin("http://localhost:3000/login"),
      "http://localhost:3000",
    );
  });

  it("builds public URLs from relative paths", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://percata.vercel.app";

    assert.equal(
      toPublicSiteUrl("/auth/callback?code=123", "https://old.example").toString(),
      "https://percata.vercel.app/auth/callback?code=123",
    );
  });
});
