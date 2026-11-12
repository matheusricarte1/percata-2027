import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { getAuthCallbackUrl, getPublicSiteOrigin, toPublicSiteUrl } from "./site-url.ts";

const originalServerSiteUrl = process.env.SITE_URL;
const originalServerAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalServerSiteUrl === undefined) {
    delete process.env.SITE_URL;
  } else {
    process.env.SITE_URL = originalServerSiteUrl;
  }

  if (originalServerAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalServerAppUrl;
  }
});

describe("site-url", () => {
  it("uses the configured public site origin before request origin", () => {
    process.env.SITE_URL = "percata.vercel.app/";

    assert.equal(
      getAuthCallbackUrl("https://endereco-antigo.vercel.app"),
      "https://percata.vercel.app/auth/callback",
    );
  });

  it("falls back to the request origin outside production", () => {
    delete process.env.SITE_URL;
    delete process.env.APP_URL;

    assert.equal(
      getPublicSiteOrigin("http://localhost:3000/login"),
      "http://localhost:3000",
    );
  });

  it("builds public URLs from relative paths", () => {
    process.env.SITE_URL = "https://percata.vercel.app";

    assert.equal(
      toPublicSiteUrl("/auth/callback?code=123", "https://old.example").toString(),
      "https://percata.vercel.app/auth/callback?code=123",
    );
  });

  it("starts Google OAuth on the server so the PKCE verifier reaches the callback", () => {
    const loginPage = readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
    const oauthStartRoute = path.join(process.cwd(), "src/app/auth/start/route.ts");

    assert.match(loginPage, /new URL\("\/auth\/start", publicOrigin\)/);
    assert.ok(readFileSync(oauthStartRoute, "utf8").includes("signInWithOAuth"));
  });
});
