import { withAuthorizedRole } from "@/lib/api-auth";
import { executeAnalysisOperation } from "@/lib/dfd-analysis-api";

// One database transaction validates the actor and preserves the operation history.
export const POST = withAuthorizedRole(
  ["chefia", "superadmin"],
  (ctx) => executeAnalysisOperation(ctx, "approve"),
  { requireAdminClient: true },
);
