import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { deriveGndFromNatureza } from "@/lib/catalog-fiscal";
import {
  buildNaturezaReviewCsv,
  normalizeNaturezaReviewDecision,
  normalizeNaturezaReviewStatus,
} from "@/lib/efisco-natureza-review";

function parseLimit(value: string | null, fallback = 120, max = 1000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function parseOffset(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

async function getCatalogSnapshot(admin: any, efiscoItemId: number) {
  const { data, error } = await admin
    .from("catalogo_efisco_v2")
    .select(
      "id,codigo_efisco,descricao,tipo_objeto,nome_grupo,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,has_missing_natureza",
    )
    .eq("id", efiscoItemId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getExistingDecisionId(
  admin: any,
  efiscoItemId: number,
  dfdItemId: string | null,
) {
  let query = admin
    .from("efisco_natureza_review_decisions")
    .select("id")
    .eq("efisco_item_id", efiscoItemId)
    .limit(1);

  query = dfdItemId ? query.eq("dfd_item_id", dfdItemId) : query.is("dfd_item_id", null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function syncDfdItemsAfterDecision(admin: any, decision: ReturnType<typeof normalizeNaturezaReviewDecision>) {
  const patch: Record<string, unknown> = {};

  if (decision.status === "saneado" && decision.codigo_natureza_despesa) {
    const gnd = deriveGndFromNatureza(decision.codigo_natureza_despesa);
    patch.codigo_natureza_despesa = decision.codigo_natureza_despesa;
    patch.gnd = gnd;
    patch.gnd_derivado = gnd;
    patch.requires_natureza_review = false;
  }

  if (decision.status === "bloqueado") {
    patch.requires_natureza_review = false;
  }

  if (decision.status === "substituido" && decision.replacement_efisco_item_id) {
    const replacement = await getCatalogSnapshot(admin, decision.replacement_efisco_item_id);
    if (replacement) {
      patch.efisco_item_id = Number(replacement.id);
      patch.codigo_tce = replacement.codigo_efisco;
      patch.codigo_item_efisco = replacement.codigo_efisco;
      patch.descricao = replacement.descricao;
      patch.tipo_objeto = replacement.tipo_objeto;
      patch.nome_grupo = replacement.nome_grupo;
      patch.nome_classe = replacement.nome_classe;
      patch.codigo_material_servico = replacement.codigo_material_servico;
      patch.nome_material_servico = replacement.nome_material_servico;
      patch.codigo_natureza_despesa = replacement.codigo_natureza_preferencial;
      patch.gnd = replacement.gnd_preferencial || deriveGndFromNatureza(replacement.codigo_natureza_preferencial);
      patch.gnd_derivado = patch.gnd;
      patch.requires_natureza_review = false;
    }
  }

  if (Object.keys(patch).length === 0) return;

  if (decision.dfd_item_id) {
    const { error } = await admin
      .from("dfd_items")
      .update(patch)
      .eq("id", decision.dfd_item_id);
    if (error) throw error;
    return;
  }

  const { error } = await admin
    .from("dfd_items")
    .update(patch)
    .eq("efisco_item_id", decision.efisco_item_id)
    .eq("requires_natureza_review", true);
  if (error) throw error;
}

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const { searchParams } = request.nextUrl;
    const statusParam = searchParams.get("status");
    const scope = searchParams.get("scope");
    const format = searchParams.get("format");
    const limit = parseLimit(searchParams.get("limit"), format === "csv" ? 1000 : 120);
    const offset = parseOffset(searchParams.get("offset"));

    let queueQuery = admin
      .from("efisco_natureza_review_decisions")
      .select(
        "id,efisco_item_id,dfd_id,dfd_item_id,decision_scope,status,codigo_natureza_despesa,replacement_efisco_item_id,snapshot_codigo_efisco,snapshot_descricao,snapshot_tipo_objeto,snapshot_nome_grupo,snapshot_nome_classe,justificativa,decided_by,decided_at,created_at,updated_at",
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (statusParam && statusParam !== "todos") {
      queueQuery = queueQuery.eq("status", normalizeNaturezaReviewStatus(statusParam));
    }
    if (scope === "catalogo" || scope === "dfd_item") {
      queueQuery = queueQuery.eq("decision_scope", scope);
    }

    const [summary, queue] = await Promise.all([
      admin.from("efisco_natureza_review_summary").select("*").maybeSingle(),
      queueQuery,
    ]);

    if (summary.error) throw summary.error;
    if (queue.error) throw queue.error;

    const rows = (queue.data || []).map((row: any) => ({
      id: row.id,
      efisco_item_id: row.efisco_item_id,
      dfd_id: row.dfd_id,
      dfd_item_id: row.dfd_item_id,
      decision_scope: row.decision_scope,
      status: row.status,
      codigo_natureza_despesa: row.codigo_natureza_despesa,
      replacement_efisco_item_id: row.replacement_efisco_item_id,
      codigo_efisco: row.snapshot_codigo_efisco,
      descricao: row.snapshot_descricao,
      tipo_objeto: row.snapshot_tipo_objeto,
      nome_grupo: row.snapshot_nome_grupo,
      nome_classe: row.snapshot_nome_classe,
      numero_protocolo: null,
      dfd_status: null,
      quantidade: null,
      valor_unitario_estimado: null,
      valor_total_item: null,
      justificativa: row.justificativa,
      decided_by: row.decided_by,
      decided_by_name: null,
      decided_at: row.decided_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
    if (format === "csv") {
      return new NextResponse(buildNaturezaReviewCsv(rows), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="efisco-sem-natureza-saneamento.csv"',
        },
      });
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      summary: summary.data || null,
      items: rows,
      pagination: {
        limit,
        offset,
        hasMore: rows.length === limit,
      },
    });
  },
  { requireAdminClient: true },
);

export const POST = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin, user }) => {
    const admin = supabaseAdmin!;
    const body = await request.json().catch(() => ({}));
    const decision = normalizeNaturezaReviewDecision(body);
    const catalog = await getCatalogSnapshot(admin, decision.efisco_item_id);

    let dfdId: string | null = null;
    let dfdItemSnapshot: any = null;
    if (decision.dfd_item_id) {
      const { data, error } = await admin
        .from("dfd_items")
        .select("id,dfd_id,codigo_tce,descricao,tipo_objeto,nome_grupo,nome_classe")
        .eq("id", decision.dfd_item_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: "Item de DFD não encontrado." },
          { status: 404 },
        );
      }
      dfdItemSnapshot = data;
      dfdId = data.dfd_id;
    }

    const payload = {
      efisco_item_id: decision.efisco_item_id,
      dfd_id: dfdId,
      dfd_item_id: decision.dfd_item_id,
      decision_scope: decision.dfd_item_id ? "dfd_item" : "catalogo",
      status: decision.status,
      codigo_natureza_despesa: decision.codigo_natureza_despesa,
      replacement_efisco_item_id: decision.replacement_efisco_item_id,
      snapshot_codigo_efisco:
        catalog?.codigo_efisco || dfdItemSnapshot?.codigo_tce || String(decision.efisco_item_id),
      snapshot_descricao:
        catalog?.descricao || dfdItemSnapshot?.descricao || "Item e-Fisco sem descrição",
      snapshot_tipo_objeto: catalog?.tipo_objeto || dfdItemSnapshot?.tipo_objeto || null,
      snapshot_nome_grupo: catalog?.nome_grupo || dfdItemSnapshot?.nome_grupo || null,
      snapshot_nome_classe: catalog?.nome_classe || dfdItemSnapshot?.nome_classe || null,
      justificativa: decision.justificativa || null,
      decided_by: user.id,
    };

    const existingId = await getExistingDecisionId(
      admin,
      decision.efisco_item_id,
      decision.dfd_item_id,
    );

    const mutation = existingId
      ? admin
          .from("efisco_natureza_review_decisions")
          .update(payload)
          .eq("id", existingId)
          .select("*")
          .single()
      : admin
          .from("efisco_natureza_review_decisions")
          .insert(payload)
          .select("*")
          .single();

    const { data, error } = await mutation;
    if (error) throw error;

    await syncDfdItemsAfterDecision(admin, decision);

    return NextResponse.json({ decision: data });
  },
  { requireAdminClient: true },
);
