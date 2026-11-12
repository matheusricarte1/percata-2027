const PENDING_CHEFIA_REVIEW_STATUSES = new Set(["rascunho", "triagem"]);

export function canSuperadminReassignDfd(status: string | null | undefined) {
  return PENDING_CHEFIA_REVIEW_STATUSES.has(String(status || "").trim().toLowerCase());
}
