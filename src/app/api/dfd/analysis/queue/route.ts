import { NextResponse } from "next/server";
import { withAuthorizedRole } from "@/lib/api-auth";
import { parseAnalysisQueueQuery } from "@/lib/dfd-analysis-queue";
import { captureError } from "@/lib/observability";
import { readAnalysisEvaluations } from "@/lib/analysis-evaluation-reader";
import type { AnalysisQueueData } from "@/lib/dfd-analysis-queue";

export const GET = withAuthorizedRole(
  ["chefia", "superadmin"],
  async ({ user, request, supabaseAdmin }) => {
    let query: ReturnType<typeof parseAnalysisQueueQuery>;
    try {
      query = parseAnalysisQueueQuery(request.nextUrl.searchParams);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin!.rpc("dfd_analysis_queue_display", {
      p_actor: user.id,
      p_page: query.page,
      p_search: query.search,
      // Superadmin already has institutional scope through the RPC. `p_all`
      // also included DFDs outside triagem, including returned demands.
      p_all: false,
      p_filter: query.filter,
    });
    if (error) {
      await captureError(error, { source: "dfd-analysis.queue", userId: user.id });
      return NextResponse.json(
        { error: "Não foi possível carregar a fila de análise. Tente novamente." },
        { status: error.code === "42501" ? 403 : 500 },
      );
    }
    if (data?.role === "superadmin") {
      const queue = data as AnalysisQueueData;
      const ids = queue.people.flatMap((person) => person.dfds.map((dfd) => dfd.id));
      const evaluations = await readAnalysisEvaluations(supabaseAdmin!, queue.role, ids);
      for (const person of queue.people) for (const dfd of person.dfds) dfd.evaluators = evaluations.get(dfd.id) || [];
    }
    if (data) {
      const { data: groups, error: groupError } = await supabaseAdmin!.rpc("dfd_analysis_group_progress", { p_actor: user.id });
      if (groupError) {
        await captureError(groupError, { source: "dfd-analysis.group-progress", userId: user.id });
        return NextResponse.json({ error: "Não foi possível conferir o andamento dos grupos. Tente novamente." }, { status: groupError.code === "42501" ? 403 : 503 });
      }
      data.groups = groups;
      const queue = data as AnalysisQueueData;
      const progress = new Map(queue.groups?.flatMap((group) => group.dfds.map((dfd) => [dfd.id, dfd] as const)));
      for (const person of queue.people) for (const dfd of person.dfds) {
        const evaluated = progress.get(dfd.id);
        if (evaluated) Object.assign(dfd, { missingImpact: evaluated.missingImpact, missingPriority: evaluated.missingPriority, retainedCount: evaluated.retainedCount, proposedTotal: evaluated.proposedTotal, evaluationProgress: true });
      }
      // Use institutional evaluations within the same complete search scope.
      if (query.filter === "all" && (!query.search || queue.totalPeople <= queue.people.length)) {
        const pending = (query.search ? queue.people.flatMap((person) => person.dfds) : queue.groups?.flatMap((group) => group.dfds) || []).filter((dfd) => dfd.status === "triagem");
        queue.totals.missingImpact = pending.reduce((sum, dfd) => sum + dfd.missingImpact, 0);
        queue.totals.missingPriority = pending.reduce((sum, dfd) => sum + dfd.missingPriority, 0);
        queue.totals.retainedItems = pending.reduce((sum, dfd) => sum + dfd.retainedCount, 0);
        queue.totals.items = queue.totals.retainedItems;
        queue.totals.proposedTotal = pending.reduce((sum, dfd) => sum + dfd.proposedTotal, 0);
      }
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  },
  { requireAdminClient: true },
);
