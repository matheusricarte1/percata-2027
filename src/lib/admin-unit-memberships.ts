export type ManagedUnitLink = {
  unit_id: string;
  unit_type: "departamento" | "laboratorio";
  role_in_unit: "membro" | "chefia";
};

export function normalizeManagedUnitLinks(
  links: Array<Partial<ManagedUnitLink>>,
): ManagedUnitLink[] {
  const byUnit = new Map<string, ManagedUnitLink>();

  for (const link of links) {
    const unitId = String(link.unit_id || "").trim();
    if (!unitId) continue;
    const unitType = link.unit_type === "laboratorio" ? "laboratorio" : "departamento";
    const role = link.role_in_unit === "chefia" ? "chefia" : "membro";
    const key = `${unitType}:${unitId}`;
    const existing = byUnit.get(key);

    byUnit.set(key, {
      unit_id: unitId,
      unit_type: unitType,
      role_in_unit: existing?.role_in_unit === "chefia" || role === "chefia" ? "chefia" : "membro",
    });
  }

  return Array.from(byUnit.values());
}
