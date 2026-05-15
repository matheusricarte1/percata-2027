const DEFAULT_PRODUCTION_SITE_ORIGIN = "https://percata.vercel.app";

function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicSiteOrigin(fallbackOrigin?: string | null): string {
  const configuredOrigin =
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL);

  if (configuredOrigin) return configuredOrigin;

  if (process.env.NODE_ENV === "production") {
    return DEFAULT_PRODUCTION_SITE_ORIGIN;
  }

  return normalizeOrigin(fallbackOrigin) || "http://localhost:3000";
}

export function getAuthCallbackUrl(fallbackOrigin?: string | null): string {
  return `${getPublicSiteOrigin(fallbackOrigin)}/auth/callback`;
}

export function toPublicSiteUrl(pathAndSearch: string, fallbackOrigin?: string | null): URL {
  return new URL(pathAndSearch, getPublicSiteOrigin(fallbackOrigin));
}
