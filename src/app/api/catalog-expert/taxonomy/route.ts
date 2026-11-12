import { NextResponse } from "next/server";

import { listCatalogExpertTaxonomyChildren } from "@/lib/catalog-expert-server";
import { withAuthorizedRole } from "@/lib/api-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const parentKey = request.nextUrl.searchParams.get("parentKey") || "base";
    const children = await listCatalogExpertTaxonomyChildren(supabaseAdmin!, parentKey);
    const taxonomy =
      parentKey === "base"
        ? { key: "base", label: "Base", count: children.reduce((sum, child) => sum + child.count, 0), children, hasMoreChildren: true }
        : null;
    return NextResponse.json({
      taxonomy,
      parentKey,
      children,
      total: children.reduce((sum, child) => sum + child.count, 0),
      generatedAt: new Date().toISOString(),
    });
  },
  { requireAdminClient: true },
);
