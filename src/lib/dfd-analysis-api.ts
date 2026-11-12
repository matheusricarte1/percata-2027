import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { AuthorizedContext } from "@/lib/api-auth";
import { analysisError } from "@/lib/dfd-analysis";
import { enforceRateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function executeAnalysisOperation(
  ctx: AuthorizedContext,
  forcedAction?: string,
) {
  const { request, user, supabaseAdmin: admin } = ctx;
  const limited = await enforceRateLimit(
    request,
    { bucket: "dfd-analysis", limit: 120, windowSec: 60 },
    user.id,
  );
  if (limited) return limited;
  const text = await request.text();
  if (text.length > 500_000)
    return NextResponse.json(
      { error: "Envie uma DFD por vez." },
      { status: 413 },
    );
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const id = String(body.dfdId || body.id || "");
  const requestId =
    typeof body.requestId === "string" ? body.requestId : randomUUID();
  const action = forcedAction || String(body.action || "");
  if (
    !UUID.test(id) ||
    !UUID.test(requestId) ||
    !["save_draft", "apply", "approve", "return", "remove", "delete", "send_ready", "send_median", "remove_admin_item"].includes(
      action,
    )
  )
    return NextResponse.json(
      { error: "DFD ou operação inválida." },
      { status: 400 },
    );
  const payload = Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => !["id", "dfdId", "requestId", "action"].includes(key),
    ),
  );
  if (["send_median", "remove_admin_item"].includes(action) && ctx.role !== "superadmin")
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  if (action === "remove_admin_item" && (!UUID.test(String(body.itemId || "")) || typeof body.baseRevision !== "string" || typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 2000))
    return NextResponse.json({ error: "Informe o item, a revisão e o motivo da retirada." }, { status: 400 });
  const { data, error } = action === "remove_admin_item" ? await admin!.rpc("dfd_analysis_remove_admin_item", {
    p_actor: user.id, p_request_id: requestId, p_dfd_id: id, p_item_id: body.itemId, p_revision: body.baseRevision, p_reason: body.reason,
  }) : ["send_ready", "send_median"].includes(action) ? await admin!.rpc(action === "send_median" ? "dfd_analysis_send_median" : "dfd_analysis_send_ready", {
    p_actor: user.id, p_request_id: requestId, p_dfd_id: id,
  }) : await admin!.rpc("dfd_analysis_operation", {
    p_actor: user.id,
    p_request_id: requestId,
    p_action: action,
    p_dfd_id: id,
    p_payload: payload,
  });
  if (error) {
    await captureError(error, {
      source: "dfd-analysis.rpc",
      userId: user.id,
      dfdId: id,
      requestId,
      action,
    });
    return NextResponse.json(
      {
        ok: false,
        error: analysisError("DATABASE_ERROR").message,
        code: "DATABASE_ERROR",
        requestId,
      },
      { status: 503 },
    );
  }
  if (!data?.ok) {
    const mapped = analysisError(data?.code || "DATABASE_ERROR");
    return NextResponse.json(
      { ...data, error: mapped.message, requestId, recorded: true },
      { status: mapped.status },
    );
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
