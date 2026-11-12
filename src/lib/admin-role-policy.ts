import type { UserRole } from "./access.ts";

type TargetAccessInput = {
  actorRole: UserRole;
  actorCampusId: string | null;
  targetCampusId: string | null;
  targetRole: string | null;
};

type ManagedCampusInput = {
  actorRole: UserRole;
  actorCampusId: string | null;
  requestedCampusId: string | null;
};

export function evaluateAdminTargetAccess({
  actorRole,
  actorCampusId,
  targetCampusId,
  targetRole,
}: TargetAccessInput): { allowed: boolean } {
  if (actorRole === "superadmin") return { allowed: true };
  return {
    allowed:
      actorRole === "admin" &&
      Boolean(actorCampusId) &&
      actorCampusId === targetCampusId &&
      targetRole !== "superadmin",
  };
}

export function resolveManagedCampus({
  actorRole,
  actorCampusId,
  requestedCampusId,
}: ManagedCampusInput): { allowed: boolean; campusId: string | null } {
  if (actorRole === "superadmin") {
    return { allowed: true, campusId: requestedCampusId };
  }
  if (actorRole !== "admin" || !actorCampusId) {
    return { allowed: false, campusId: null };
  }
  if (requestedCampusId && requestedCampusId !== actorCampusId) {
    return { allowed: false, campusId: null };
  }
  return { allowed: true, campusId: actorCampusId };
}
