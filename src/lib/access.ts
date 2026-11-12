export type UserRole = "solicitante" | "chefia" | "admin" | "superadmin";

export function canUseSolicitanteWorkspace(role: UserRole): boolean {
  return role === "solicitante" || role === "chefia" || role === "superadmin";
}

export function canUseTriagemWorkspace(role: UserRole): boolean {
  return role === "chefia" || role === "superadmin";
}

export function canUseAdminWorkspace(role: UserRole): boolean {
  return role === "admin" || role === "superadmin";
}

export function getRoleSettingsPath(role: UserRole): string {
  if (canUseAdminWorkspace(role)) return "/admin/configuracoes";
  if (canUseTriagemWorkspace(role)) return "/triagem/configuracoes";
  return "/configuracoes";
}

export function getRolePendingWorkPath(role: UserRole): string {
  if (role === "admin") return "/admin/consolidacao";
  if (canUseTriagemWorkspace(role)) return "/triagem";
  return "/minhas-dfds";
}

export function isSuperadminEmail(email: string | null | undefined): boolean {
  void email;
  return false;
}

export function normalizeRole(
  role: string | null | undefined,
  email?: string | null,
): UserRole {
  void email;

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
