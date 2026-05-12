export const SHELL_APP_BAR_HEIGHT = "72px";

export const SHELL_SIDEBAR_WIDTH = {
  user: "248px",
  chefia: "248px",
  admin: "248px",
} as const;

export type ShellRole = "solicitante" | "chefia" | "admin" | "superadmin";

export function getSidebarWidthForRole(role: ShellRole): string {
  if (role === "admin") return SHELL_SIDEBAR_WIDTH.admin;
  if (role === "chefia") return SHELL_SIDEBAR_WIDTH.chefia;
  return SHELL_SIDEBAR_WIDTH.user;
}
