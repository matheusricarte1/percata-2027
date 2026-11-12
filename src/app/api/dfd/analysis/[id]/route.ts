import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { captureError } from "@/lib/observability";
import { readAnalysisEvaluations } from "@/lib/analysis-evaluation-reader";

export const GET = withAuthorizedRole<{ id: string }>(
  ["chefia", "superadmin"],
  async ({ user, supabaseAdmin }, { id }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
      return NextResponse.json({ error: "Identificador de DFD inválido." }, { status: 400 });
    const { data, error } = await supabaseAdmin!.rpc("dfd_analysis_detail_display", {
      p_actor: user.id,
      p_dfd_id: id,
    });
    if (error) {
      await captureError(error, { source: "dfd-analysis.detail", userId: user.id, dfdId: id });
      return NextResponse.json(
        { error: "Não foi possível carregar esta DFD. Tente novamente." },
        { status: error.code === "42501" ? 403 : 500 },
      );
    }
    if (!data || data?.dfd?.status !== "triagem")
      return NextResponse.json(
        { error: "Esta DFD não está disponível na sua fila de análise." },
        { status: 404 },
      );
    if (data.role === "superadmin") {
      const evaluations = await readAnalysisEvaluations(supabaseAdmin!, data.role, [id], true);
      data.dfd.evaluations = evaluations.get(id) || [];
      const { data: reference, error: referenceError } = await supabaseAdmin!.rpc("dfd_analysis_reference_evaluation", { p_actor: user.id, p_dfd: id });
      if (referenceError) throw referenceError;
      data.dfd.referenceEvaluation = reference;
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  },
  { requireAdminClient: true },
);
