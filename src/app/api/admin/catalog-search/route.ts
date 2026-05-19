import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeRole } from "@/lib/access";
import {
  buildCatalogSearchInsights,
  buildCatalogSearchMetrics,
  type CatalogSearchClickRow,
  type CatalogSearchLogRow,
  type CatalogSearchOverrideRow,
} from "@/lib/catalog-search-admin";

async function requireAdminOrSuperadmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = normalizeRole(profile?.role, user.email);
  if (role !== "admin" && role !== "superadmin") return null;
  return { user, role };
}

function parseLimit(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminOrSuperadmin();
    if (!actor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const logsLimit = parseLimit(request.nextUrl.searchParams.get("logs"), 250, 1000);
    const clicksLimit = parseLimit(request.nextUrl.searchParams.get("clicks"), 250, 1000);
    const overridesLimit = parseLimit(request.nextUrl.searchParams.get("overrides"), 100, 500);

    const admin = createSupabaseAdminClient();

    const [{ data: logs, error: logsError }, { data: clicks, error: clicksError }, { data: overrides, error: overridesError }] =
      await Promise.all([
        admin
          .from("catalog_search_logs")
          .select("id,query_text,query_norm,category,context,source,result_count,top_catalog_id,top_codigo_efisco,created_at")
          .order("created_at", { ascending: false })
          .limit(logsLimit),
        admin
          .from("catalog_search_clicks")
          .select("id,action_type,query_text,query_norm,category,context,source,result_position,catalog_id,codigo_efisco,item_descricao,created_at")
          .order("created_at", { ascending: false })
          .limit(clicksLimit),
        admin
          .from("catalog_search_overrides")
          .select("id,query_norm,match_mode,override_type,catalog_id,codigo_efisco,weight,notes,is_active,created_at,updated_at")
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
      recentLogs: typedLogs.slice(0, 80),
      recentClicks: typedClicks.slice(0, 80),
      overrides: typedOverrides,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Falha ao carregar inteligencia da busca." },
      { status: 500 },
    );
  }
}
