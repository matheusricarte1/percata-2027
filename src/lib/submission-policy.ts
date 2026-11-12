export type SubmissionState = {
  cycle: { id: string; name: string; startsAt: string; closesAt: string; chefiaClosesAt: string | null } | null;
  open: boolean;
  canCreate: boolean;
  superadminAccess?: boolean;
  exception: { id: string; reason: string; expires_at: string } | null;
  correction: { id: string; reason: string; expires_at: string } | null;
  canEditDfd: boolean;
  serverNow: string;
};

export function canCreateWithSubmissionState(state: SubmissionState | null, now: number) {
  if (!state?.canCreate) return false;
  if (state.superadminAccess) return true;
  return Boolean((state.open && state.cycle && isSubmissionWindowOpen(state.cycle.startsAt, state.cycle.closesAt, now))
    || (state.exception && now < Date.parse(state.exception.expires_at)));
}

export function isSubmissionWindowOpen(startsAt: string, closesAt: string, now: number) {
  return Number.isFinite(now) && now >= Date.parse(startsAt) && now < Date.parse(closesAt);
}

export function canRequesterEditDfd(input: {
  owner: boolean; status: string; canCreate: boolean; correction: boolean;
}) {
  if (!input.owner) return false;
  if (input.status === "devolvida") return true;
  if (input.status === "rascunho") return input.canCreate;
  return input.status === "triagem" && input.correction;
}

export function formatBahiaDate(value: string, dateOnly = false) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia", dateStyle: "short", ...(dateOnly ? {} : { timeStyle: "short" }),
  }).format(new Date(value));
}

// All controls display the last inclusive minute, while the database uses an
// exclusive boundary at midnight on the following day.
export function formatSubmissionDeadline(closesAt: string) {
  return formatBahiaDate(new Date(Date.parse(closesAt) - 1).toISOString());
}

export function parseBahiaDateTime(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  // Reject values normalized by Date, such as February 30.
  if (new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 16) !== value) return null;
  return date.toISOString();
}
