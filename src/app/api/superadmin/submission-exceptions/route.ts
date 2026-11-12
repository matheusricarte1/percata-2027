import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";
import { loadSubmissionState, submissionOperationError } from "@/lib/submission-policy-server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = withAuthorizedRole(["superadmin"], async ({ request, supabaseAdmin }) => {
  const userId = sanitizeUuid(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  const state = await loadSubmissionState(supabaseAdmin!, userId);
  let events: unknown[] = [];
  if (state.cycle) {
    const { data, error } = await supabaseAdmin!.from("submission_permission_events").select("id,action,details,created_at,actor_id")
      .eq("user_id", userId).eq("cycle_id", state.cycle.id).is("dfd_id", null).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    const actorIds = [...new Set((data || []).map(event => event.actor_id))];
    const { data: actors, error: actorsError } = actorIds.length ? await supabaseAdmin!.from("profiles").select("id,full_name").in("id", actorIds) : { data: [], error: null };
    if (actorsError) throw actorsError;
    const names = new Map((actors || []).map(actor => [actor.id, actor.full_name]));
    events = (data || []).map(event => ({ ...event, actorName: names.get(event.actor_id) || "Superadmin" }));
  }
  return NextResponse.json({ state, events }, { headers: { "Cache-Control": "no-store" } });
}, { requireAdminClient: true });

export const POST = withAuthorizedRole(["superadmin"], async ({ request, user, supabaseAdmin }) => {
  const limited = await enforceRateLimit(request, { bucket: "submission-exceptions", limit: 20, windowSec: 60 }, user.id);
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  const targetId = sanitizeUuid(body.userId);
  if (!targetId) return NextResponse.json({ error: "Usuário inválido." }, { status: 400 });
  if (body.revoke !== true && (typeof body.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt)))) return NextResponse.json({ error: "Informe uma validade válida." }, { status: 400 });
  const { error } = await supabaseAdmin!.rpc("manage_submission_permission", {
    p_actor: user.id, p_user: targetId, p_dfd: null, p_revoke: body.revoke === true,
    p_reason: sanitizePlainText(body.reason, 2000), p_expires: body.revoke === true ? null : body.expiresAt,
  });
  if (error) { const mapped = submissionOperationError(error.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  return NextResponse.json({ ok: true });
}, { requireAdminClient: true });
