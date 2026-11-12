import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { sanitizePlainText, sanitizeUuid } from "@/lib/settings-sanitize";
import { submissionOperationError } from "@/lib/submission-policy-server";
import { getDfdExpenseClassViolation } from "@/lib/dfd-gnd";
import { enforceRateLimit } from "@/lib/rate-limit";

const roles = ["solicitante", "chefia", "superadmin"] as const;
const options = { requireAdminClient: true };

export const GET = withAuthorizedRole(roles, async ({ request, user, supabaseAdmin }) => {
  const id = sanitizeUuid(request.nextUrl.searchParams.get("dfdId"));
  if (!id) return NextResponse.json({ error: "DFD inválida." }, { status: 400 });
  const { data, error } = await supabaseAdmin!.rpc("dfd_requester_correction_snapshot", { p_actor: user.id, p_dfd: id });
  if (error) { const mapped = submissionOperationError(error.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}, options);

export const POST = withAuthorizedRole(roles, async ({ request, user, supabaseAdmin }) => {
  const limited = await enforceRateLimit(request, { bucket: "dfd-requester-correction", limit: 30, windowSec: 60 }, user.id);
  if (limited) return limited;
  const text = await request.text();
  if (text.length > 512_000) return NextResponse.json({ error: "A DFD excede o tamanho máximo." }, { status: 413 });
  let body;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const id = sanitizeUuid(body?.dfdId);
  if (!id || !Array.isArray(body?.items) || body.items.length > 500) return NextResponse.json({ error: "DFD ou itens inválidos." }, { status: 400 });
  const admin = supabaseAdmin!;
  // Validate access before resolving any catalog metadata.
  const { data: snapshot, error: accessError } = await admin.rpc("dfd_requester_correction_snapshot", { p_actor: user.id, p_dfd: id });
  if (accessError) { const mapped = submissionOperationError(accessError.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  const original = new Map<string, { gnd?: string; codigo_natureza_despesa?: string }>(snapshot.items.map((item: { id: string }) => [item.id, item]));
  const items: Record<string, unknown>[] = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Item inválido." }, { status: 400 });
    const itemId = raw.id ? sanitizeUuid(raw.id) : null;
    if (raw.id && (!itemId || !original.has(itemId))) return NextResponse.json({ error: "O item não pertence a esta DFD." }, { status: 400 });
    const item: Record<string, unknown> = {
      id: itemId, remove: raw.remove === true, removalReason: sanitizePlainText(raw.removalReason, 2000),
      quantidade: raw.quantidade, valor_unitario_estimado: raw.valor_unitario_estimado,
      justificativa_quantidade: sanitizePlainText(raw.justificativa_quantidade, 4000),
      justificativa_item: sanitizePlainText(raw.justificativa_item, 4000),
      local_uso: sanitizePlainText(raw.local_uso, 1000), link_referencia: sanitizePlainText(raw.link_referencia, 2000),
    };
    if (!item.remove && (!Number.isInteger(item.quantidade) || Number(item.quantidade) < 1 || Number(item.quantidade) > 2147483647 || !Number.isFinite(item.valor_unitario_estimado) || Number(item.valor_unitario_estimado) <= 0 || Number(item.valor_unitario_estimado) > 1e12)) {
      return NextResponse.json({ error: "Informe quantidade inteira positiva e valor unitário válido." }, { status: 400 });
    }
    if (item.link_referencia) {
      try { const url = new URL(String(item.link_referencia)); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); }
      catch { return NextResponse.json({ error: "Use um link de referência http ou https." }, { status: 400 }); }
    }
    if (!itemId && !item.remove) {
      const catalogId = String(raw.catalogId || "");
      if (!/^\d+$/.test(catalogId)) return NextResponse.json({ error: "Escolha o novo item no catálogo." }, { status: 400 });
      const { data: catalog, error: catalogError } = await admin.from("catalogo_efisco_v2").select("id,codigo_efisco,descricao,unidade_medida,gnd_preferencial,codigo_natureza_preferencial,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,natureza_count,has_mixed_expense_classes,has_missing_natureza").eq("id", catalogId).maybeSingle();
      if (catalogError) throw catalogError;
      if (!catalog) return NextResponse.json({ error: "Item do catálogo não encontrado." }, { status: 400 });
      Object.assign(item, {
        codigo_tce: catalog.codigo_efisco, descricao: catalog.descricao, unidade_medida: catalog.unidade_medida,
        gnd: catalog.gnd_preferencial, codigo_natureza_despesa: catalog.codigo_natureza_preferencial,
        efisco_item_id: catalog.id, tipo_objeto: catalog.tipo_objeto, codigo_grupo: catalog.codigo_grupo,
        nome_grupo: catalog.nome_grupo, codigo_classe: catalog.codigo_classe, nome_classe: catalog.nome_classe,
        requires_natureza_review: Number(catalog.natureza_count) !== 1 || catalog.has_mixed_expense_classes || catalog.has_missing_natureza,
      });
    } else if (itemId) {
      const before = original.get(itemId)!;
      Object.assign(item, { gnd: before.gnd, codigo_natureza_despesa: before.codigo_natureza_despesa });
    }
    items.push(item);
  }
  const violation = getDfdExpenseClassViolation(items.filter(item => !item.remove).map(item => ({ gnd: item.gnd as string | null, codigoNaturezaDespesa: item.codigo_natureza_despesa as string | null })));
  if (violation) return NextResponse.json({ error: violation }, { status: 400 });
  const { data, error } = await admin.rpc("save_dfd_requester_correction", {
    p_actor: user.id, p_dfd: id, p_revision: String(body.revision || ""),
    p_object: sanitizePlainText(body.object, 2000), p_reason: sanitizePlainText(body.justification, 10000), p_items: items,
  });
  if (error) { const mapped = submissionOperationError(error.message); return NextResponse.json({ error: mapped.error }, { status: mapped.status }); }
  return NextResponse.json(data);
}, options);
