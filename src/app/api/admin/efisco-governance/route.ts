import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

function parseLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const admin = supabaseAdmin!;
    const queueLimit = parseLimit(request.nextUrl.searchParams.get("limit"), 80, 500);

    const [
      quality,
      gndDistribution,
      taxonomy,
      ambiguity,
      planningSignals,
      missing,
      mixed,
    ] = await Promise.all([
      admin.from("efisco_quality_overview").select("*").maybeSingle(),
      admin
        .from("efisco_gnd_distribution")
        .select("*")
        .order("itens_distintos", { ascending: false })
        .limit(80),
      admin
        .from("efisco_taxonomy_distribution")
        .select("*")
        .order("itens", { ascending: false })
        .limit(240),
      admin
        .from("efisco_item_ambiguity")
        .select("*")
        .order("natureza_count", { ascending: false })
        .limit(60),
      admin
        .from("efisco_planning_signals")
        .select("*")
        .order("natureza_count", { ascending: false })
        .limit(60),
      admin
        .from("catalogo_efisco_v2")
        .select(
          "efisco_item_id:id,codigo_efisco,descricao,tipo_objeto,nome_grupo,nome_classe,nome_material_servico,natureza_count,has_mixed_expense_classes",
        )
        .eq("has_missing_natureza", true)
        .order("id", { ascending: true })
        .limit(queueLimit),
      admin
        .from("catalogo_efisco_v2")
        .select(
          "efisco_item_id:id,codigo_efisco,descricao,tipo_objeto,nome_grupo,nome_classe,nome_material_servico,natureza_count,gnds,naturezas",
        )
        .eq("has_mixed_expense_classes", true)
        .order("natureza_count", { ascending: false })
        .limit(queueLimit),
    ]);

    for (const result of [
      quality,
      gndDistribution,
      taxonomy,
      ambiguity,
      planningSignals,
      missing,
      mixed,
    ]) {
      if (result.error) throw result.error;
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      quality: quality.data || null,
      gndDistribution: gndDistribution.data || [],
      taxonomy: taxonomy.data || [],
      ambiguity: ambiguity.data || [],
      planningSignals: planningSignals.data || [],
      queues: {
        missingNatureza: missing.data || [],
        mixedExpenseClasses: mixed.data || [],
      },
    });
  },
  { requireAdminClient: true },
);
