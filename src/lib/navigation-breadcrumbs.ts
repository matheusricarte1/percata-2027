import type { ShellRole } from "@/lib/layout-shell";

export type ShellBreadcrumb = {
  label: string;
  href?: string;
};

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Painel",
  catalogo: "Catálogo",
  "nova-dfd": "Nova solicitação",
  "minhas-dfds": "Minhas solicitações",
  dfd: "DFD",
  "dfds-coletivas": "DFDs coletivas",
  historico: "Histórico",
  verificar: "Verificação",
  configuracoes: "Configurações",
  triagem: "Triagem",
  chefia: "Chefia",
  orcamento: "Orçamento",
  aprovacoes: "Aprovações",
  admin: "Administração",
  usuarios: "Usuários",
  kits: "Kits",
  exportacao: "Exportação",
  consolidacao: "Consolidação",
  consolidacoes: "Consolidações",
  campanhas: "Ciclos",
  "catalogo-busca": "Busca do catálogo",
  "analytics-superadmin": "Central analítica",
  "efisco-natureza-review": "Revisão e-Fisco",
  "efisco-governance": "Governança e-Fisco",
};

const DYNAMIC_LABELS: Record<string, string> = {
  dfd: "Detalhe da DFD",
  "minhas-dfds": "Detalhe da DFD",
  "dfds-coletivas": "Sala coletiva",
  historico: "Consulta histórica",
};

function isDynamicSegment(segment: string) {
  return /^[0-9a-f-]{8,}$/i.test(segment) || /^\d{4}$/.test(segment) || segment.length > 24;
}

function fallbackLabel(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRootLabel(role: ShellRole, firstSegment?: string) {
  if (firstSegment === "admin") return "Administração";
  if (firstSegment === "triagem" || firstSegment === "chefia") return "Chefia";
  if (!firstSegment && (role === "admin" || role === "superadmin")) return "Administração";
  if (!firstSegment && role === "chefia") return "Chefia";
  return "Painel";
}

export function getShellBreadcrumbs(pathname: string | null, role: ShellRole): ShellBreadcrumb[] {
  const cleanPath = (pathname || "/dashboard").split("?")[0]?.replace(/\/+$/, "") || "/dashboard";
  const segments = cleanPath.split("/").filter(Boolean);
  const firstSegment = segments[0];
  const rootHref =
    firstSegment === "admin"
      ? "/admin"
      : firstSegment === "triagem" || firstSegment === "chefia"
        ? `/${firstSegment}`
        : "/dashboard";

  const breadcrumbs: ShellBreadcrumb[] = [
    {
      label: getRootLabel(role, firstSegment),
      href: cleanPath === rootHref ? undefined : rootHref,
    },
  ];

  if (segments.length === 0 || cleanPath === rootHref) {
    return breadcrumbs;
  }

  let accumulatedPath = "";
  segments.forEach((segment, index) => {
    accumulatedPath += `/${segment}`;
    const previous = segments[index - 1];
    const isLast = index === segments.length - 1;
    const label = isDynamicSegment(segment)
      ? DYNAMIC_LABELS[previous || ""] || "Detalhe"
      : ROUTE_LABELS[segment] || fallbackLabel(segment);

    if (index === 0 && label === breadcrumbs[0]?.label) return;

    breadcrumbs.push({
      label,
      href: isLast || isDynamicSegment(segment) ? undefined : accumulatedPath,
    });
  });

  return breadcrumbs;
}
