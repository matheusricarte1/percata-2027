import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

function sanitizeText(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export const PATCH = withAuthorizedRole<{ id: string }>(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }, params) => {
    const admin = supabaseAdmin!;
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body?.is_active === "boolean") patch.is_active = body.is_active;
    if (body?.notes !== undefined)
      patch.notes = sanitizeText(body.notes, 500) || null;
    if (body?.weight !== undefined) {
      patch.weight = Math.max(0, Math.min(5000, Number(body.weight || 0)));
    }

    const { data, error } = await admin
      .from("catalog_search_overrides")
      .update(patch)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  },
  { requireAdminClient: true },
);
