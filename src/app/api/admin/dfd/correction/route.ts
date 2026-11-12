import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { sanitizeUuid, sanitizePlainText } from "@/lib/settings-sanitize";
import { submissionOperationError } from "@/lib/submission-policy-server";
import { enforceRateLimit } from "@/lib/rate-limit";

const roles = ["admin", "superadmin"] as const;
const options = { requireAdminClient: true };
export const GET = withAuthorizedRole(roles, async ({ request, user, supabaseAdmin }) => {
  const id = sanitizeUuid(request.nextUrl.searchParams.get("dfdId"));
  if (!id) return NextResponse.json({ error: "DFD inválida." }, { status: 400 });
  const collective = request.nextUrl.searchParams.get("collective") === "1";
  const { data, error } = await supabaseAdmin!.rpc(collective ? "room_admin_correction_snapshot" : "dfd_admin_correction_snapshot", { p_actor: user.id, [collective ? "p_room" : "p_dfd"]: id });
  if (error) { const mapped = error.message.includes("MIXED_EXPENSE_CLASSES") ? { status: 400, error: "A alteração mistura custeio e capital. Separe esses itens em DFDs distintas." } : submissionOperationError(error.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}, options);
export const POST = withAuthorizedRole(roles, async ({ request, user, supabaseAdmin }) => {
  const limited = await enforceRateLimit(request, { bucket: "admin-dfd-correction", limit: 20, windowSec: 60 }, user.id);
  if (limited) return limited;
  const text = await request.text();
  if (text.length > 512_000) return NextResponse.json({ error: "A DFD excede o tamanho máximo." }, { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const id = sanitizeUuid(body?.dfdId);
  if (!id || !Array.isArray(body?.items) || (body.collective !== true && body.items.length < 1) || body.items.length > 500) return NextResponse.json({ error: "DFD ou itens inválidos." }, { status: 400 });
  const items = [];
  const ids = new Set<string>();
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Item inválido." }, { status: 400 });
    const itemId = sanitizeUuid(raw?.id);
    if ((raw.id && !itemId) || (itemId && ids.has(itemId)) || (!raw.remove && (!Number.isInteger(raw.quantidade) || raw.quantidade < 1 || raw.quantidade > 2147483647 || !Number.isFinite(raw.valor_unitario_estimado) || raw.valor_unitario_estimado <= 0 || raw.valor_unitario_estimado > 1e12))) return NextResponse.json({ error: "Informe itens existentes, quantidades inteiras positivas e valores válidos." }, { status: 400 });
    if (itemId) ids.add(itemId);
    const catalogId = raw.catalogId ? String(raw.catalogId) : null;
    if ((catalogId && !/^\d+$/.test(catalogId)) || (!itemId && !catalogId)) return NextResponse.json({ error: "Escolha o item no catálogo." }, { status: 400 });
    const link = sanitizePlainText(raw.link_referencia, 2000);
    if (link) { try { if (!["http:", "https:"].includes(new URL(link).protocol)) throw new Error(); } catch { return NextResponse.json({ error: "Use uma referência http ou https." }, { status: 400 }); } }
    items.push({ id: itemId, catalogId, naturezaCode: sanitizePlainText(raw.naturezaCode, 80), remove: raw.remove === true, removalReason: sanitizePlainText(raw.removalReason, 2000), quantidade: raw.quantidade, valor_unitario_estimado: raw.valor_unitario_estimado,
      justificativa_quantidade: sanitizePlainText(raw.justificativa_quantidade, 4000), justificativa_item: sanitizePlainText(raw.justificativa_item, 4000),
      local_uso: sanitizePlainText(raw.local_uso, 1000), link_referencia: link });
  }
  const { data, error } = await supabaseAdmin!.rpc(body.collective === true ? "save_room_admin_correction" : "save_dfd_admin_correction", { p_actor: user.id, [body.collective === true ? "p_room" : "p_dfd"]: id,
    p_revision: String(body.revision || ""), p_object: sanitizePlainText(body.object, 2000),
    p_justification: sanitizePlainText(body.justification, 10000), p_reason: sanitizePlainText(body.reason, 2000), p_items: items });
  if (error) { const mapped = error.message.includes("MIXED_EXPENSE_CLASSES") ? { status: 400, error: "A alteração mistura custeio e capital. Separe esses itens em DFDs distintas." } : submissionOperationError(error.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  return NextResponse.json(data);
}, options);
