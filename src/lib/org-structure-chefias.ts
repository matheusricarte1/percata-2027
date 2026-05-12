export type UnitType = "departamento" | "laboratorio";

export type UnitReference = {
  id: string;
  type: UnitType;
};

export type UserUnitChefiaRow = {
  unit_type: string | null;
  unit_id: string | null;
  user_id: string | null;
};

export type ProfileChefiaRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type ChefiaAssignment = {
  user_id: string;
  full_name: string | null;
  email: string | null;
};

export function normalizeUnitType(value: string | null | undefined): UnitType {
  return value === "laboratorio" ? "laboratorio" : "departamento";
}

export function buildChefiaAssignmentMap(
  units: UnitReference[],
  userUnits: UserUnitChefiaRow[],
  profiles: ProfileChefiaRow[],
) {
  const unitTypeById = new Map(units.map((unit) => [unit.id, unit.type]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const map = new Map<string, ChefiaAssignment>();

  for (const row of userUnits) {
    if (!row.unit_id || !row.user_id) continue;

    const expectedType = unitTypeById.get(String(row.unit_id));
    const unitType = normalizeUnitType(row.unit_type);
    if (!expectedType || expectedType !== unitType) continue;

    const key = `${unitType}:${row.unit_id}`;
    if (map.has(key)) continue;

    const profile = profileById.get(String(row.user_id));
    map.set(key, {
      user_id: String(row.user_id),
      full_name: profile?.full_name || null,
      email: profile?.email || null,
    });
  }

  return map;
}
