import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { executeAnalysisOperation } from "@/lib/dfd-analysis-api";

/** Global read model: only superadmin may browse every DFD/status/campus. */
export const GET = withAuthorizedRole(
  ["superadmin"],
  async ({ supabaseAdmin, request }) => {
    const status = request.nextUrl.searchParams.get("status")?.trim();
    let query = supabaseAdmin!
      .from("dfds")
      .select("id,numero_protocolo,status,created_at,campus_id,campus,solicitante_id,objeto_contratacao,valor_total_estimado,unidade_id,analysis_unidade_id,tipo_unidade,analysis_tipo_unidade,origin_type")
      .order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data || [];
    const requesterIds = Array.from(new Set(rows.map((row) => row.solicitante_id).filter(Boolean)));
    const campusIds = Array.from(new Set(rows.map((row) => row.campus_id).filter(Boolean)));
    const unitIds = Array.from(new Set(rows.map((row) => row.analysis_unidade_id || row.unidade_id).filter(Boolean)));
    const dfdIds = rows.map((row) => row.id);
    const [{ data: profiles }, { data: campuses }, { data: items }, { data: departments }, { data: laboratories }] = await Promise.all([
      requesterIds.length
        ? supabaseAdmin!.from("profiles").select("id,full_name,email,role,avatar_url").in("id", requesterIds)
        : Promise.resolve({ data: [] }),
      campusIds.length
        ? supabaseAdmin!.from("campi").select("id,nome,sigla").in("id", campusIds)
        : Promise.resolve({ data: [] }),
      dfdIds.length
        ? supabaseAdmin!.from("dfd_items").select("dfd_id,gnd").in("dfd_id", dfdIds)
        : Promise.resolve({ data: [] }),
      unitIds.length ? supabaseAdmin!.from("departamentos").select("id,nome").in("id", unitIds) : Promise.resolve({ data: [] }),
      unitIds.length ? supabaseAdmin!.from("laboratorios").select("id,nome").in("id", unitIds) : Promise.resolve({ data: [] }),
    ]);
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const campusById = new Map((campuses || []).map((campus) => [campus.id, campus]));
    const unitById = new Map([...(departments || []), ...(laboratories || [])].map((unit) => [unit.id, unit]));
    const reviewerRows = unitIds.length
      ? (await supabaseAdmin!.from("user_units").select("unit_id,user_id").in("unit_id", unitIds).eq("role_in_unit", "chefia")).data || []
      : [];
    const reviewerIds = Array.from(new Set(reviewerRows.map((row) => row.user_id).filter(Boolean)));
    const { data: reviewerProfiles } = reviewerIds.length
      ? await supabaseAdmin!.from("profiles").select("id,full_name,email,avatar_url,role").in("id", reviewerIds)
      : { data: [] };
    const reviewerByUnit = new Map<string, string>();
    reviewerRows.forEach((row) => { if (!reviewerByUnit.has(String(row.unit_id))) reviewerByUnit.set(String(row.unit_id), String(row.user_id)); });
    const reviewerById = new Map((reviewerProfiles || []).map((profile) => [profile.id, profile]));
    const itemsByDfd = new Map<string, { count: number; gnds: string[] }>();
    for (const item of items || []) {
      const previous = itemsByDfd.get(item.dfd_id) || { count: 0, gnds: [] };
      previous.count += 1;
      if (item.gnd && !previous.gnds.includes(item.gnd)) previous.gnds.push(item.gnd);
      itemsByDfd.set(item.dfd_id, previous);
    }
    const enriched = rows.map((row) => {
      const requester = profileById.get(row.solicitante_id);
      const campus = campusById.get(row.campus_id);
      const unitId = row.analysis_unidade_id || row.unidade_id;
      const unit = unitId ? unitById.get(unitId) : null;
      const reviewer = unitId ? reviewerById.get(reviewerByUnit.get(String(unitId)) || "") : null;
      const itemSummary = itemsByDfd.get(row.id) || { count: 0, gnds: [] };
      return {
        ...row,
        campus_name: campus?.nome || row.campus || null,
        campus_sigla: campus?.sigla || row.campus || null,
        solicitante_nome: requester?.full_name || null,
        solicitante_email: requester?.email || null,
        solicitante_role: requester?.role || null,
        solicitante_avatar_url: requester?.avatar_url || null,
        unidade_nome: unit?.nome || null,
        unidade_tipo: row.analysis_tipo_unidade || row.tipo_unidade || null,
        chefia_nome: reviewer?.full_name || null,
        chefia_email: reviewer?.email || null,
        chefia_avatar_url: reviewer?.avatar_url || null,
        item_count: itemSummary.count,
        gnds: itemSummary.gnds,
      };
    });
    return NextResponse.json({
      scope: "global",
      statuses: Array.from(new Set(rows.map((row) => row.status).filter(Boolean))),
      campuses: Array.from(new Set(enriched.map((row) => row.campus_name).filter(Boolean))),
      total: enriched.length,
      dfds: enriched,
    });
  },
  { requireAdminClient: true },
);

// One database transaction validates the actor and preserves the operation history.
export const DELETE = withAuthorizedRole(
  ["superadmin"],
  (ctx) => executeAnalysisOperation(ctx, "delete"),
  { requireAdminClient: true },
);
