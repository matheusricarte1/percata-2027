export type SectorCompletionDfd = {
  id: string;
  itemCount: number;
  missingDecisions: number;
  confirmed: boolean;
  eligible: boolean;
  changedInSession: boolean;
};

export function canCelebrateSector(wasPending: boolean, dfds: SectorCompletionDfd[]) {
  return wasPending && dfds.length > 0 &&
    dfds.some((dfd) => dfd.changedInSession) &&
    dfds.every((dfd) => dfd.eligible && dfd.itemCount > 0 &&
      dfd.missingDecisions === 0 && dfd.confirmed);
}
