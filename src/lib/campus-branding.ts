export type CampusBranding = {
  campusKey: "petrolina" | "ouricuri" | "default";
  label: string;
  logoSrc: string;
  accent: string;
  accentSoft: string;
  support: string;
};

const DEFAULT_BRANDING: CampusBranding = {
  campusKey: "default",
  label: "Campus UPE",
  logoSrc: "/brands/upe-campus-petrolina.png",
  accent: "#164073",
  accentSoft: "#E8EDF2",
  support: "#4D79A8",
};

function normalizeCampusValue(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveCampusBranding(
  campusNameOrCode?: string | null,
): CampusBranding {
  const normalized = normalizeCampusValue(campusNameOrCode);

  if (normalized.includes("ouricuri") || normalized === "our") {
    return {
      campusKey: "ouricuri",
      label: "Campus Ouricuri",
      logoSrc: "/brands/upe-campus-ouricuri.png",
      accent: "#1F6F78",
      accentSoft: "#DCEAF0",
      support: "#2A7C8C",
    };
  }

  if (normalized.includes("petrolina") || normalized === "ptr") {
    return {
      campusKey: "petrolina",
      label: "Campus Petrolina",
      logoSrc: "/brands/upe-campus-petrolina.png",
      accent: "#164073",
      accentSoft: "#E8EDF2",
      support: "#2D5D94",
    };
  }

  return DEFAULT_BRANDING;
}

