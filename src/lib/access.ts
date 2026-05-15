export const SUPERADMIN_EMAIL = (
  process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL || ""
).trim().toLowerCase();

export type UserRole = "solicitante" | "chefia" | "admin" | "superadmin";

export function isSuperadminEmail(email: string | null | undefined): boolean {
  return Boolean(SUPERADMIN_EMAIL) && (email || "").toLowerCase() === SUPERADMIN_EMAIL;
}

export function normalizeRole(
  role: string | null | undefined,
  email?: string | null,
): UserRole {
  if (isSuperadminEmail(email)) {
    return "superadmin";
  }

  if (
    role === "superadmin" ||
    role === "admin" ||
    role === "chefia" ||
    role === "solicitante"
  ) {
    return role;
  }

  return "solicitante";
}

export function getHomeForRole(role: UserRole): string {
  if (role === "superadmin") return "/dashboard";
  if (role === "admin") return "/dashboard";
  if (role === "chefia") return "/dashboard";
  return "/dashboard";
}
