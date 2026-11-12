import "server-only";

import type { UserRole } from "@/lib/access";

export async function getAdminCampusUserIds(admin: any, actorId: string, role: UserRole) {
  if (role === "superadmin") return null;
  const { data: actor, error: actorError } = await admin.from("profiles").select("campus_id").eq("id", actorId).maybeSingle();
  if (actorError) throw actorError;
  if (!actor?.campus_id) return new Set<string>();
  const { data, error } = await admin.from("profiles").select("id").eq("campus_id", actor.campus_id);
  if (error) throw error;
  return new Set((data || []).map((profile: { id: string }) => profile.id));
}
