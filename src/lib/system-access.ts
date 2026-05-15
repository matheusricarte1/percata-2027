import type { UserRole } from "./access.ts";

export const ACCESS_LOCK_KEY = "global_access_lock";
export const ACCESS_LOCK_PATH = "/acesso-bloqueado";

export type AccessLockState = {
  enabled: boolean;
  message: string;
};

const DEFAULT_LOCK_MESSAGE =
  "O sistema esta temporariamente bloqueado para manutenção. Aguarde a liberação pelo superadmin.";

export function normalizeAccessLock(input: unknown): AccessLockState {
  const value = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const rawMessage = String(value.message || "").replace(/\s+/g, " ").trim();
  return {
    enabled: value.enabled === true,
    message: rawMessage.slice(0, 240) || DEFAULT_LOCK_MESSAGE,
  };
}

export function shouldBlockForAccessLock(
  lock: AccessLockState,
  role: UserRole,
  pathname: string,
): boolean {
  if (!lock.enabled) return false;
  if (role === "superadmin") return false;
  if (pathname === ACCESS_LOCK_PATH) return false;
  if (pathname.startsWith("/auth/")) return false;
  return true;
}
