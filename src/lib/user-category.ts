import type { UserRole } from "@/lib/access";

export type UserCategory =
  | UserRole
  | "collective"
  | "departamento"
  | "laboratorio"
  | "campus"
  | "usuario";

export function roleToUserCategory(role?: string | null): UserCategory {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "superadmin") return "superadmin";
  if (normalized === "admin") return "admin";
  if (normalized === "chefia") return "chefia";
  if (normalized === "solicitante") return "solicitante";
  return "usuario";
}
