import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";
import { submissionOperationError } from "@/lib/submission-policy-server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = withAuthorizedRole(["chefia", "superadmin"], async ({ request, user, supabaseAdmin }) => {
  const limited = await enforceRateLimit(request, { bucket: "dfd-correction-permission", limit: 20, windowSec: 60 }, user.id);
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  const id = sanitizeUuid(body.dfdId);
  if (!id) return NextResponse.json({ error: "DFD inválida." }, { status: 400 });
  if (body.revoke !== true && (typeof body.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt)))) return NextResponse.json({ error: "Informe uma validade válida." }, { status: 400 });
  const { data: dfd, error: lookupError } = await supabaseAdmin!.from("dfds").select("solicitante_id").eq("id", id).maybeSingle();
  if (lookupError) throw lookupError;
  if (!dfd) return NextResponse.json({ error: "DFD não encontrada." }, { status: 404 });
  const { error } = await supabaseAdmin!.rpc("manage_submission_permission", {
    p_actor: user.id, p_user: dfd.solicitante_id, p_dfd: id, p_revoke: body.revoke === true,
    p_reason: sanitizePlainText(body.reason, 2000), p_expires: body.revoke === true ? null : body.expiresAt,
  });
  if (error) { const mapped = submissionOperationError(error.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  return NextResponse.json({ ok: true });
}, { requireAdminClient: true });
