import { NextResponse } from "next/server";
import {
  buildCatalogSearchActionQueues,
  buildCatalogSearchInsights,
  buildCatalogSearchMetrics,
  type CatalogSearchClickRow,
  type CatalogSearchLogRow,
  type CatalogSearchOverrideRow,
} from "@/lib/catalog-search-admin";
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
    const logsLimit = parseLimit(
      request.nextUrl.searchParams.get("logs"),
      250,
      1000,
    );
    const clicksLimit = parseLimit(
      request.nextUrl.searchParams.get("clicks"),
      250,
      1000,
    );
    const overridesLimit = parseLimit(
      request.nextUrl.searchParams.get("overrides"),
      100,
      500,
    );

    const [
      { data: logs, error: logsError },
      { data: clicks, error: clicksError },
      { data: overrides, error: overridesError },
    ] = await Promise.all([
      admin
        .from("catalog_search_logs")
        .select(
          "id,query_text,query_norm,category,context,source,result_count,top_catalog_id,top_codigo_efisco,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(logsLimit),
      admin
        .from("catalog_search_clicks")
        .select(
          "id,action_type,query_text,query_norm,category,context,source,result_position,catalog_id,codigo_efisco,item_descricao,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(clicksLimit),
      admin
        .from("catalog_search_overrides")
        .select(
          "id,query_norm,match_mode,override_type,catalog_id,codigo_efisco,weight,notes,is_active,created_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(overridesLimit),
    ]);

    if (logsError) throw logsError;
    if (clicksError) throw clicksError;
    if (overridesError) throw overridesError;

    const typedLogs = (logs || []) as CatalogSearchLogRow[];
    const typedClicks = (clicks || []) as CatalogSearchClickRow[];
    const typedOverrides = (overrides || []) as CatalogSearchOverrideRow[];

    return NextResponse.json({
      metrics: buildCatalogSearchMetrics(typedLogs, typedClicks),
      queries: buildCatalogSearchInsights(typedLogs, typedClicks).slice(0, 60),
      actionQueues: buildCatalogSearchActionQueues(typedLogs, typedClicks),
      recentLogs: typedLogs.slice(0, 80),
      recentClicks: typedClicks.slice(0, 80),
      overrides: typedOverrides,
    });
  },
  { requireAdminClient: true },
);
