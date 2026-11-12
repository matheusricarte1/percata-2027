import type { UserRole } from "@/lib/access";

export type TriagemUnitLink = {
  unit_id: string | null;
  role_in_unit: string | null;
};

export type TriagemScopeRow = {
  unidade_id?: string | null;
  analysis_unidade_id?: string | null;
  campus_id?: string | null;
};

export function resolveTriagemUnitIds(params: {
  profileRole: UserRole;
  units: TriagemUnitLink[];
}) {
  const ids = new Set<string>();

  for (const unit of params.units) {
    const unitId = String(unit.unit_id || "").trim();
    if (!unitId) continue;

    if (unit.role_in_unit === "chefia") {
      ids.add(unitId);
    }
  }

  return Array.from(ids);
}

export function getTriagemTargetUnitId(row: TriagemScopeRow) {
  return String(row.analysis_unidade_id || row.unidade_id || "").trim();
}

export function shouldIncludeCampusOrphanTriagemRow(params: {
  row: TriagemScopeRow;
  profileRole: UserRole;
  campusId: string | null | undefined;
  directUnitIds: string[];
  unitsWithAssignedChefia: Set<string>;
}) {
  void params;
  return false;
}
