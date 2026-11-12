import { NextResponse } from "next/server";

import {
  listCatalogExpertNodeItems,
} from "@/lib/catalog-expert-server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { parseBoundedCatalogInt } from "@/lib/catalog-query-signal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withAuthorizedRole(
  ["admin", "superadmin"],
  async ({ request, supabaseAdmin }) => {
    const { searchParams } = new URL(request.url);
    const nodeKey = searchParams.get("nodeKey") || "base";
    const limit = parseBoundedCatalogInt(searchParams.get("limit"), 60, 1, 120);
    const offset = parseBoundedCatalogInt(searchParams.get("offset"), 0, 0, 200_000);
    const result = await listCatalogExpertNodeItems(supabaseAdmin!, nodeKey, limit, offset);

    return NextResponse.json({
      ...result,
      nodeKey,
      source: "catalog-expert-v2",
    });
  },
  { requireAdminClient: true },
);
