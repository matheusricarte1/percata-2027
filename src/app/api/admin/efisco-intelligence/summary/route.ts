import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";

function asNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ role, supabaseAdmin }) => {
    const admin = supabaseAdmin!;

    const [quality, reviewSummary] = await Promise.all([
      admin.from("efisco_quality_overview").select("*").maybeSingle(),
      admin.from("efisco_natureza_review_summary").select("*").maybeSingle(),
    ]);

    if (quality.error) throw quality.error;
    if (reviewSummary.error) throw reviewSummary.error;

    const qualityData = quality.data || {};
    const reviewData = reviewSummary.data || {};
    const totalItems = asNumber(qualityData.total_itens);
    const missingNatureza = asNumber(qualityData.itens_com_natureza_ausente);
    const mixedExpense = asNumber(qualityData.itens_misturam_custeio_investimento);
    const openReview = asNumber(reviewData.abertos);
    const pendingReview = asNumber(reviewData.pendentes);
    const saneados = asNumber(reviewData.saneados);

    const missingPct = totalItems > 0 ? missingNatureza / totalItems : 0;
    const mixedPct = totalItems > 0 ? mixedExpense / totalItems : 0;
    const action =
      pendingReview > 0
        ? "Priorizar saneamento dos itens pendentes antes de liberar novas DFDs com natureza indefinida."
        : missingNatureza > 0
          ? "Manter fila separada de DFDs sem natureza e homologar as correções por lote."
          : "Manter monitoramento e usar analytics para planejamento de compras.";

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      role,
      quality: {
        total_items: totalItems,
        missing_natureza: missingNatureza,
        missing_pct: missingPct,
        mixed_expense_classes: mixedExpense,
        mixed_pct: mixedPct,
        multiple_naturezas: asNumber(qualityData.itens_multiplas_naturezas),
        long_descriptions: asNumber(qualityData.itens_nome_muito_longo),
        refreshed_at: qualityData.refreshed_at || null,
      },
      review: {
        open: openReview,
        pending: pendingReview,
        in_analysis: asNumber(reviewData.em_analise),
        saneados,
        substituted: asNumber(reviewData.substituidos),
        blocked: asNumber(reviewData.bloqueados),
        linked_to_dfd: asNumber(reviewData.vinculados_a_dfd),
        catalog_only: asNumber(reviewData.apenas_catalogo),
        total: asNumber(reviewData.total),
      },
      analytics: {
        available: role === "superadmin",
        scope: "Planejamento institucional por histórico, preço, recorrência e tendência.",
      },
      recommendation: {
        action,
        risk_level:
          missingPct >= 0.05 || mixedPct >= 0.25 || pendingReview > 1000
            ? "alto"
            : missingPct >= 0.01 || pendingReview > 0
              ? "moderado"
              : "baixo",
      },
    });
  },
  { requireAdminClient: true },
);
