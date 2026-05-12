export const SUPERADMIN_EMAIL = "matheus.ricarte@upe.br";

export type UserRole = "solicitante" | "chefia" | "admin" | "superadmin";

export function isSuperadminEmail(email: string | null | undefined): boolean {
  return (email || "").toLowerCase() === SUPERADMIN_EMAIL;
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
