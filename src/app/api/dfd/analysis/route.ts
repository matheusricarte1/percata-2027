import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { executeAnalysisOperation } from "@/lib/dfd-analysis-api";
import { captureError } from "@/lib/observability";
export const GET = withAuthorizedRole(
  ["chefia", "superadmin"],
  async ({ user, request, supabaseAdmin }) => {
    const { data, error } = await supabaseAdmin!.rpc("dfd_analysis_workspace", {
      p_actor: user.id,
      p_all: request.nextUrl.searchParams.get("all") === "true",
    });
    if (error) {
      await captureError(error, {
        source: "dfd-analysis.workspace",
        userId: user.id,
      });
      return NextResponse.json(
        {
          error:
            "Não foi possível carregar a área de análise. Tente atualizar a página.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  },
  { requireAdminClient: true },
);
export const POST = withAuthorizedRole(
  ["chefia", "superadmin"],
  (ctx) => executeAnalysisOperation(ctx),
  { requireAdminClient: true },
);
