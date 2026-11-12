/** Traduz os detalhes registrados sem expor o objeto técnico na tramitação. */
export function dfdTimelineDescription(details: unknown): string {
  const fallback = "Movimentação registrada automaticamente pelo sistema.";
  if (!details) return fallback;
  let value: unknown = details;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return fallback;
    if (!text.startsWith("{") && !text.startsWith("[")) return text;
    try { value = JSON.parse(text); } catch { return text; }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const messages = [record.reason, record.justification, record.message, record.description]
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .map(entry => entry.trim());
    return [...new Set(messages)].join("\n") || fallback;
  }
  return fallback;
}
