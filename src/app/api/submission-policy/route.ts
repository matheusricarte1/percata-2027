import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { loadSubmissionState } from "@/lib/submission-policy-server";
import { sanitizeUuid } from "@/lib/settings-sanitize";

export const GET = withAuthorizedRole(["solicitante", "chefia", "admin", "superadmin"], async ({ request, user, supabaseAdmin }) => {
  const rawId = request.nextUrl.searchParams.get("dfdId");
  const dfdId = rawId ? sanitizeUuid(rawId) : null;
  if (rawId && !dfdId) return NextResponse.json({ error: "DFD inválida." }, { status: 400 });
  return NextResponse.json(await loadSubmissionState(supabaseAdmin!, user.id, dfdId), { headers: { "Cache-Control": "no-store" } });
}, { requireAdminClient: true });
