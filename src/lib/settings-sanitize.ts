const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const MULTISPACE = /\s+/g;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function sanitizePlainText(value: unknown, maxLength = 240) {
  return String(value ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(MULTISPACE, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeUiMessage(value: unknown, maxLength = 240) {
  return sanitizePlainText(value, maxLength).trim();
}

export function sanitizeUiLabel(value: unknown, maxLength = 64) {
  return sanitizePlainText(value, maxLength).trim();
}

export function sanitizeLongText(value: unknown, maxLength = 4000) {
  return String(value ?? "")
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

export function normalizeComparableText(value: unknown) {
  return sanitizePlainText(value, 500)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function sanitizeEmail(value: unknown) {
  const email = sanitizePlainText(value, 254).toLowerCase();
  return EMAIL_REGEX.test(email) ? email : "";
}

export function sanitizeUuid(value: unknown) {
  const id = sanitizePlainText(value, 80);
  return UUID_REGEX.test(id) ? id : "";
}

export function isValidUuid(value: unknown) {
  return Boolean(sanitizeUuid(value));
}

export function parseLocalDateTimeToIso(value: unknown) {
  const raw = sanitizePlainText(value, 32);
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export function validateDateRange(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return { ok: true as const };
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false as const, error: "Datas inválidas." };
  }
  if (end < start) {
    return { ok: false as const, error: "A data final não pode ser anterior à inicial." };
  }
  return { ok: true as const };
}
