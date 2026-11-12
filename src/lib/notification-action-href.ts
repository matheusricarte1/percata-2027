export function notificationActionHref(value: unknown): string | null {
  const href = String(value || "").trim();
  if (!href || /[\\\u0000-\u001f]/.test(href)) return null;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
