"use client";
import { useSubmissionPolicy } from "@/lib/use-submission-policy";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Plus } from "@/components/icons/phosphor/exports/Plus";
import { Check } from "@/components/icons/phosphor/exports/Check";
import { Heart } from "@/components/icons/phosphor/exports/Heart";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { PaintRoller } from "@/components/icons/phosphor/exports/PaintRoller";
import { BookOpen } from "@/components/icons/phosphor/exports/BookOpen";
import { Queue } from "@/components/icons/phosphor/exports/Queue";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { Hash } from "@/components/icons/phosphor/exports/Hash";
import { Lightning } from "@/components/icons/phosphor/exports/Lightning";
import { X } from "@/components/icons/phosphor/exports/X";
import { Trash } from "@/components/icons/phosphor/exports/Trash";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { ArrowUpRight } from "@/components/icons/phosphor/exports/ArrowUpRight";
import { Broom } from "@/components/icons/phosphor/exports/Broom";
import { CalendarBlank } from "@/components/icons/phosphor/exports/CalendarBlank";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { CaretDown } from "@/components/icons/phosphor/exports/CaretDown";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { Cube } from "@/components/icons/phosphor/exports/Cube";
import { DesktopTower } from "@/components/icons/phosphor/exports/DesktopTower";
import { Factory } from "@/components/icons/phosphor/exports/Factory";
import { Flask } from "@/components/icons/phosphor/exports/Flask";
import { Stack } from "@/components/icons/phosphor/exports/Stack";
import { Tag } from "@/components/icons/phosphor/exports/Tag";
import { Truck } from "@/components/icons/phosphor/exports/Truck";
import { TrendUp } from "@/components/icons/phosphor/exports/TrendUp";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { Wrench } from "@/components/icons/phosphor/exports/Wrench";
import { SlidersHorizontal } from "@/components/icons/phosphor/exports/SlidersHorizontal";
import { toast } from "sonner";
import { useCarrinhoStore } from "@/store/carrinho";
import { recordCatalogSearchClick } from "@/lib/catalog-search-events";
import {
  filterArmamentRelatedCatalogRows,
  isArmamentRelatedCatalogQuery,
  sanitizeCatalogSearchInput,
} from "@/lib/catalog-query-signal";
import { supabase } from "@/lib/supabase";
import { ProductSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CatalogDescriptionDialog } from "@/components/catalog/CatalogDescriptionDialog";
import { OperationalEmptyState } from "@/components/ui/operational";
import {
  analyzeCatalogSearchQuery,
  rerankCatalogSearchResults,
} from "@/lib/catalog-search-ranking";
import {
  deriveGndFromNatureza,
  getCatalogFiscalIssue,
  getCatalogFiscalIssueMessage,
  requiresExplicitNaturezaSelection,
} from "@/lib/catalog-fiscal";
import {
  formatCatalogDisplayText,
  parseCatalogDescription,
} from "@/lib/catalog-description";
import {
  getCatalogExpertNodeDepth,
  getCatalogGroupSymbolFromNode,
  selectCatalogExpertPreviewItem,
  summarizeCatalogExpertItem,
  type CatalogExpertNode,
} from "@/lib/catalog-expert";
import {
  buildCatalogSelectionKey,
  selectNaturezaOptionByExpenseClass,
} from "@/lib/catalog-selection";
import { validateCatalogCartItem } from "@/lib/catalog-cart-validation";
import { classifyGnd } from "@/lib/dfd-gnd";
import { useDfdDraft } from "@/lib/use-dfd-draft";
import { snapshotDfdDraftCartItems } from "@/lib/dfd-draft-cart";
import { normalizeRole, type UserRole } from "@/lib/access";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRouter } from "next/navigation";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
function normalizeCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function compactDescription(value: string, maxLength = 132): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function normalizeTipoObjeto(value: unknown): "material" | "servico" | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (["servico", "servicos"].includes(normalized)) return "servico";
  if (["material", "materiais", "produto", "produtos"].includes(normalized)) {
    return "material";
  }
  return null;
}

function mergeUniqueProducts(current: any[], incoming: any[]) {
  const seen = new Set(
    current.map((product) => `${String(product.id || "")}::${String(product.siad || "")}`),
  );
  const merged = [...current];
  incoming.forEach((product) => {
    const key = `${String(product.id || "")}::${String(product.siad || "")}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(product);
  });
  return merged;
}

function attachCatalogExpertChildren(
  node: CatalogExpertNode,
  parentKey: string,
  children: CatalogExpertNode[],
): CatalogExpertNode {
  if (node.key === parentKey) {
    return {
      ...node,
      children,
      hasMoreChildren: false,
    };
  }

  return {
    ...node,
    children: node.children.map((child) =>
      attachCatalogExpertChildren(child, parentKey, children),
    ),
  };
}

function filterCatalogExpertTree(node: CatalogExpertNode, query: string): CatalogExpertNode | null {
  const normalized = query.toLocaleLowerCase("pt-BR").trim();
  if (!normalized) return node;
  const children = node.children
    .map((child) => filterCatalogExpertTree(child, normalized))
    .filter((child): child is CatalogExpertNode => Boolean(child));
  if (node.label.toLocaleLowerCase("pt-BR").includes(normalized) || children.length > 0) {
    return { ...node, children };
  }
  return null;
}

function findCatalogExpertNodePath(
  node: CatalogExpertNode,
  selectedKey: string,
  path: CatalogExpertNode[] = [],
): CatalogExpertNode[] {
  const nextPath = [...path, node];
  if (node.key === selectedKey) return nextPath;
  for (const child of node.children) {
    const found = findCatalogExpertNodePath(child, selectedKey, nextPath);
    if (found.length > 0) return found;
  }
  return [];
}

function toFavoriteItemId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function getExpenseClassText(value?: string | number | null) {
  const classification = classifyGnd(value);
  if (!classification) return "Classificação não identificada";
  if (classification.expenseClass === "custeio") return "Corrente";
  if (classification.expenseClass === "investimento") return "Capital";
  return "Outra classificação";
}

function getExpenseClassUserSummary(expenseClass?: string | null, itemType?: unknown) {
  const normalizedItemType = normalizeTipoObjeto(itemType);
  if (expenseClass === "custeio") {
    return {
      label: "Corrente",
      title:
        normalizedItemType === "servico"
          ? "Para serviço ou atendimento do dia a dia"
          : "Para consumo, reposição ou uso recorrente",
      description:
        normalizedItemType === "servico"
          ? "Use quando o serviço atende a rotina, manutenção, apoio operacional ou necessidade frequente do setor."
          : "Use quando o item será consumido, reposto ou utilizado como apoio recorrente nas atividades do setor.",
      badgeClassName: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
      panelClassName: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)]/70",
    };
  }

  if (expenseClass === "investimento") {
    return {
      label: "Capital",
      title:
        normalizedItemType === "servico"
          ? "Para implantação, ampliação ou entrega vinculada a investimento"
          : "Para equipamento, bem durável ou investimento",
      description:
        normalizedItemType === "servico"
          ? "Use quando a contratação estiver ligada a implantação, melhoria estrutural ou entrega vinculada a investimento."
          : "Use quando a compra formar patrimônio, ampliar estrutura ou representar aquisição de longa duração.",
      badgeClassName: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
      panelClassName: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)]/70",
    };
  }

  return {
    label: "Outra classificação",
    title: "Exige revisão da natureza",
    description:
      "A classificação fiscal precisa de conferência antes de seguir para a DFD.",
    badgeClassName: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    panelClassName: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]/70",
  };
}

function getExpenseClassOptionLabel(option: NaturezaOption) {
  const classification = classifyGnd(option.gnd);
  const summary = getExpenseClassUserSummary(
    classification?.expenseClass,
    option.classe_despesa,
  );

  return {
    ...summary,
    technicalLabel: classification?.elementLabel || "Classificação técnica",
    technicalCode: classification?.gnd || option.gnd || option.codigo_natureza_despesa || "-",
    naturezaCode: option.codigo_natureza_despesa || "-",
  };
}

function groupNaturezaOptionsByExpenseClass(product: any, options: NaturezaOption[]) {
  const groups = new Map<
    string,
    {
      key: string;
      expenseClass: string;
      label: string;
      title: string;
      description: string;
      badgeClassName: string;
      panelClassName: string;
      options: NaturezaOption[];
    }
  >();

  for (const option of options) {
    const classification = classifyGnd(option.gnd);
    const expenseClass = classification?.expenseClass || "outro";
    const summary = getExpenseClassUserSummary(expenseClass, product?.tipo_objeto || product?.category);
    const current = groups.get(expenseClass);
    if (current) {
      current.options.push(option);
      continue;
    }
    groups.set(expenseClass, {
      key: expenseClass,
      expenseClass,
      label: summary.label,
      title: summary.title,
      description: summary.description,
      badgeClassName: summary.badgeClassName,
      panelClassName: summary.panelClassName,
      options: [option],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const order = ["custeio", "investimento", "outro"];
    return order.indexOf(a.expenseClass) - order.indexOf(b.expenseClass);
  });
}

function getCartItemValidation(entry: any) {
  return {
    ...validateCatalogCartItem(entry),
    unidade: String(entry.item_efisco?.unidade_medida || "").trim(),
    fiscalIssue: getCatalogFiscalIssue(entry.item_efisco || {}),
  };
}

const catalogMeasurementUnits = ["UN", "CX", "PCT", "KG", "L", "M", "M2", "M3"] as const;

function getCatalogMeasurementUnitLabel(unit: string) {
  return ({
    UN: "UN — unidade",
    CX: "CX — caixa",
    PCT: "PCT — pacote",
    KG: "KG — quilograma",
    L: "L — litro",
    M: "M — metro",
    M2: "M² — metro quadrado",
    M3: "M³ — metro cúbico",
  } as Record<string, string>)[unit] || unit;
}

function getCatalogExpenseBadge(value?: string | number | null, item?: any) {
  if (item?.has_mixed_expense_classes) {
    const count = Number(item.natureza_count || 0);
    return {
      label: "Escolha de uso",
      detail:
        count > 1
          ? `${count} opções fiscais possíveis. Escolha pela finalidade da sua demanda.`
          : "Este item pode entrar como corrente ou capital.",
      className: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    };
  }

  const classification = classifyGnd(value);
  if (!classification) {
    return {
      label: "Natureza não identificada",
      detail: "Sem classificação preferencial",
      className: "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-muted)]",
    };
  }

  if (classification.expenseClass === "custeio") {
    return {
      label: "Corrente",
      detail: classification.elementLabel,
      className: "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
    };
  }

  if (classification.expenseClass === "investimento") {
    return {
      label: "Capital",
      detail: classification.elementLabel,
      className: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    };
  }

  return {
    label: "Outra natureza",
    detail: classification.elementLabel,
    className: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
  };
}

type CatalogExpenseStackEntry = {
  key: string;
  label: string;
  detail: string;
  className: string;
  expenseClass: string;
};

function getCatalogExpenseStack(item: any) {
  const gnds = Array.isArray(item?.gnds) ? item.gnds : [];
  const entries: CatalogExpenseStackEntry[] = [];
  const seen = new Set<string>();

  for (const gnd of gnds) {
    const classification = classifyGnd(gnd);
    if (!classification) continue;
    const key = classification.gnd;
    if (seen.has(key)) continue;
    seen.add(key);
    const label =
      classification.expenseClass === "custeio"
        ? "Corrente"
        : classification.expenseClass === "investimento"
          ? "Capital"
          : "Outra";
    const className =
      classification.expenseClass === "custeio"
        ? "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]"
        : classification.expenseClass === "investimento"
          ? "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]"
          : "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]";
    entries.push({
      key,
      label,
      detail: classification.elementLabel,
      className,
      expenseClass: classification.expenseClass || "outra",
    });
  }

  return entries.sort((a, b) => {
    if (a.expenseClass === "custeio" && b.expenseClass !== "custeio") return -1;
    if (b.expenseClass === "custeio" && a.expenseClass !== "custeio") return 1;
    if (a.expenseClass === "investimento" && b.expenseClass !== "investimento") return -1;
    if (b.expenseClass === "investimento" && a.expenseClass !== "investimento") return 1;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

type CatalogExpenseFilter = "all" | "corrente" | "capital";

function productMatchesExpenseFilter(product: any, filter: CatalogExpenseFilter) {
  if (filter === "all") return true;

  const candidates = [
    ...(Array.isArray(product?.gnds) ? product.gnds : []),
    product?.gnd,
    product?.gnd_preferencial,
    product?.gnd_derivado,
    product?.codigo_natureza_despesa,
    product?.codigo_natureza_preferencial,
  ].filter(Boolean);

  return candidates.some((candidate) => {
    const classification = classifyGnd(candidate);
    if (!classification) return false;
    if (filter === "corrente") return classification.expenseClass === "custeio";
    return classification.expenseClass === "investimento";
  });
}

function CatalogGroupSymbolBadge({
  nodeKey,
  label,
  compact = false,
}: {
  nodeKey: string | null;
  label?: unknown;
  compact?: boolean;
}) {
  const symbol = getCatalogGroupSymbolFromNode(nodeKey, label);
  if (!symbol) return null;

  const toneClass = {
    blue: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]",
    teal: "border-[var(--p-color-collab-border)] bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]",
    amber: "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
    violet: "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]",
    rose: "border-[var(--p-color-danger-border)] bg-[var(--p-color-danger-bg)] text-[var(--p-color-danger)]",
    slate: "border-[var(--p-color-border-strong)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-default)]",
  }[symbol.tone];
  const shapeClass = {
    rounded: "rounded-xl",
    circle: "rounded-full",
    diamond: "rotate-45 rounded-lg",
    hex: "rounded-[10px] skew-x-[-8deg]",
  }[symbol.shape];
  const contentClass = cn(
    symbol.shape === "diamond" && "-rotate-45",
    symbol.shape === "hex" && "skew-x-[8deg]",
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border font-mono font-black shadow-sm ring-1 ring-white/70",
        compact ? "h-7 w-7 type-micro" : "h-8 w-9 type-kicker",
        toneClass,
        shapeClass,
      )}
      title={symbol.title}
      aria-label={`Símbolo do grupo ${symbol.title}`}
    >
      <span className={contentClass}>{symbol.token}</span>
    </span>
  );
}

type CatalogCategoryVisual = {
  key: string;
  label: string;
  Icon: React.ElementType;
  iconClassName: string;
  chipClassName: string;
  borderClassName: string;
  topWashClassName: string;
  stackClassName: string;
  hoverClassName: string;
};

function createCatalogVisual(
  key: string,
  label: string,
  Icon: React.ElementType,
  palette: {
    icon: string;
    chip: string;
    border: string;
    wash: string;
    stack: string;
    hover: string;
  },
): CatalogCategoryVisual {
  return {
    key,
    label,
    Icon,
    iconClassName: palette.icon,
    chipClassName: palette.chip,
    borderClassName: palette.border,
    topWashClassName: palette.wash,
    stackClassName: palette.stack,
    hoverClassName: palette.hover,
  };
}

const catalogCategoryVisuals: Record<string, CatalogCategoryVisual> = {
  transporte: createCatalogVisual("transporte", "Transporte/logística", Truck, {
      icon: "bg-[#CFEFE7] text-[#087568]",
      chip: "border-[#B8E3DA] bg-[#E9F8F3] text-[#087568]",
      border: "border-[#B8E3DA]",
      wash: "from-[#E9F8F3] via-white to-white",
      stack: "border-[#B8E3DA] bg-[#DDF4ED]",
      hover: "hover:border-[#64BFB0]",
    }),
  manutencao: createCatalogVisual("manutencao", "Manutenção", Wrench, {
      icon: "bg-[#FFE4C7] text-[#A94E00]",
      chip: "border-[#F4C796] bg-[#FFF2E5] text-[#A94E00]",
      border: "border-[#F4C796]",
      wash: "from-[#FFF1E3] via-white to-white",
      stack: "border-[#F4C796] bg-[#FFE5CA]",
      hover: "hover:border-[#D88B3C]",
    }),
  tic: createCatalogVisual("tic", "TIC", DesktopTower, {
      icon: "bg-[#E4E1FF] text-[#5553B7]",
      chip: "border-[#CAC5FF] bg-[#F0EEFF] text-[#5553B7]",
      border: "border-[#CAC5FF]",
      wash: "from-[#F0EEFF] via-white to-white",
      stack: "border-[#CAC5FF] bg-[#E6E2FF]",
      hover: "hover:border-[#8A82E8]",
    }),
  laboratorio: createCatalogVisual("laboratorio", "Laboratório/reagentes", Flask, {
      icon: "bg-[#FAD8E5] text-[#9B3157]",
      chip: "border-[#F2B8CE] bg-[#FFF0F6] text-[#9B3157]",
      border: "border-[#F2B8CE]",
      wash: "from-[#FFF0F6] via-white to-white",
      stack: "border-[#F2B8CE] bg-[#FADDE8]",
      hover: "hover:border-[#D66C94]",
    }),
  consumo: createCatalogVisual("consumo", "Material de consumo", Package, {
      icon: "bg-[#FFEFB8] text-[#8B6500]",
      chip: "border-[#EED382] bg-[#FFF8DA] text-[#8B6500]",
      border: "border-[#EED382]",
      wash: "from-[#FFF8DA] via-white to-white",
      stack: "border-[#EED382] bg-[#FFF1B8]",
      hover: "hover:border-[#C59B27]",
    }),
  patrimonio: createCatalogVisual("patrimonio", "Patrimônio/equipamento", Cube, {
      icon: "bg-[#DCEEFF] text-[#1765A8]",
      chip: "border-[#B9D9F5] bg-[#EEF7FF] text-[#1765A8]",
      border: "border-[#B9D9F5]",
      wash: "from-[#EEF7FF] via-white to-white",
      stack: "border-[#B9D9F5] bg-[#DDEEFF]",
      hover: "hover:border-[#6AA9DA]",
    }),
  limpeza: createCatalogVisual("limpeza", "Limpeza/conservação", Broom, {
      icon: "bg-[#DBF5D4] text-[#347C38]",
      chip: "border-[#BDE3B6] bg-[#F0FAEC] text-[#347C38]",
      border: "border-[#BDE3B6]",
      wash: "from-[#F0FAEC] via-white to-white",
      stack: "border-[#BDE3B6] bg-[#DDF4D6]",
      hover: "hover:border-[#74B96D]",
    }),
  infraestrutura: createCatalogVisual("infraestrutura", "Obras/infraestrutura", Factory, {
      icon: "bg-[#F5D2C2] text-[#9D3F20]",
      chip: "border-[#E8AD94] bg-[#FFF0EA] text-[#9D3F20]",
      border: "border-[#E8AD94]",
      wash: "from-[#FFF0EA] via-white to-white",
      stack: "border-[#E8AD94] bg-[#F7D8CA]",
      hover: "hover:border-[#C76B49]",
    }),
  expediente: createCatalogVisual("expediente", "Expediente/documentos", Tag, {
      icon: "bg-[#E8EFFA] text-[#254F83]",
      chip: "border-[#C9D8EE] bg-[#F2F6FD] text-[#254F83]",
      border: "border-[#C9D8EE]",
      wash: "from-[#F2F6FD] via-white to-white",
      stack: "border-[#C9D8EE] bg-[#E8EFFA]",
      hover: "hover:border-[#7C9BC7]",
    }),
  educacao: createCatalogVisual("educacao", "Ensino/acervo", BookOpen, {
      icon: "bg-[#EDE7D8] text-[#76551C]",
      chip: "border-[#D8C59F] bg-[#FBF7EC] text-[#76551C]",
      border: "border-[#D8C59F]",
      wash: "from-[#FBF7EC] via-white to-white",
      stack: "border-[#D8C59F] bg-[#EFE4CB]",
      hover: "hover:border-[#B9944E]",
    }),
  seguranca: createCatalogVisual("seguranca", "Segurança/EPI", WarningCircle, {
      icon: "bg-[#FFE1E4] text-[#B52835]",
      chip: "border-[#F3B7BF] bg-[#FFF1F2] text-[#B52835]",
      border: "border-[#F3B7BF]",
      wash: "from-[#FFF1F2] via-white to-white",
      stack: "border-[#F3B7BF] bg-[#FFE4E7]",
      hover: "hover:border-[#DF6C77]",
    }),
  energia: createCatalogVisual("energia", "Energia/instalações", Lightning, {
      icon: "bg-[#FFF2BE] text-[#9C7000]",
      chip: "border-[#EED179] bg-[#FFF9DF] text-[#9C7000]",
      border: "border-[#EED179]",
      wash: "from-[#FFF9DF] via-white to-white",
      stack: "border-[#EED179] bg-[#FFF2BE]",
      hover: "hover:border-[#CFA430]",
    }),
  eventos: createCatalogVisual("eventos", "Eventos/apoio", UsersThree, {
      icon: "bg-[#E6F1FF] text-[#1F63A8]",
      chip: "border-[#BED7F4] bg-[#F0F7FF] text-[#1F63A8]",
      border: "border-[#BED7F4]",
      wash: "from-[#F0F7FF] via-white to-white",
      stack: "border-[#BED7F4] bg-[#E6F1FF]",
      hover: "hover:border-[#77AEE5]",
    }),
  institucional: createCatalogVisual("institucional", "Catálogo", BookOpen, {
      icon: "bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]",
      chip: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]",
      border: "border-[var(--p-color-info-border)]",
      wash: "from-[var(--p-color-info-bg)] via-white to-white",
      stack: "border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)]",
      hover: "hover:border-[var(--p-color-brand-400)]/40",
    }),
};

function normalizeCatalogVisualText(value: unknown) {
  return String(value || "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCatalogCategoryVisual(product: any): CatalogCategoryVisual {
  const haystack = normalizeCatalogVisualText(
    [
      product?.category,
      product?.classe,
      product?.nome_classe,
      product?.nome_grupo,
      product?.grupo,
      product?.codigo_grupo,
      product?.codigo_classe,
      product?.codigo_material_servico,
      product?.nome_material_servico,
      product?.name,
      product?.descricao,
    ].join(" "),
  );

  if (/transporte|carga|veiculo|veiculo|frete|logistic|remocao|rodoviario|combustivel|pneu|lubrificant|passagem|locacao de veiculo/.test(haystack)) {
    return catalogCategoryVisuals.transporte;
  }
  if (/manutencao|conservacao|reparo|conserto|apoio operacional|instalacao|assistencia tecnica|calibracao|peca|ferramenta/.test(haystack)) {
    return catalogCategoryVisuals.manutencao;
  }
  if (/tic|informatica|software|computador|notebook|desktop|monitor|impressora|rede|tecnologia|digital|licenca|servidor|telefonia|processamento de dados/.test(haystack)) {
    return catalogCategoryVisuals.tic;
  }
  if (/laboratorio|reagente|quimic|vidraria|amostra|analise clinica|biologic|microscop|pipeta|ensaio|medicamento|hospitalar|odontolog|veterinari/.test(haystack)) {
    return catalogCategoryVisuals.laboratorio;
  }
  if (/limpeza|higien|conservacao predial|dedetizacao|saneante|lavanderia|jardinagem|coleta de lixo|residuo/.test(haystack)) {
    return catalogCategoryVisuals.limpeza;
  }
  if (/obra|infraestrutura|engenharia|reforma|construcao|predial|alvenaria|eletric|hidraulic|pintura|climatizacao|ar condicionado/.test(haystack)) {
    return catalogCategoryVisuals.infraestrutura;
  }
  if (/equipamento|patrimonio|permanente|maquina|mobiliario|moveis|mesa|cadeira|armario|aparelho|utensilio/.test(haystack)) {
    return catalogCategoryVisuals.patrimonio;
  }
  if (/expediente|papel|caneta|arquivo|formulario|grafico|grafica|impresso|documento|escritorio|carimbo/.test(haystack)) {
    return catalogCategoryVisuals.expediente;
  }
  if (/livro|biblioteca|acervo|didatic|ensino|treinamento|curso|capacitacao|publicacao|periodico/.test(haystack)) {
    return catalogCategoryVisuals.educacao;
  }
  if (/seguranca|vigilancia|epi|protecao|uniforme|alarme|incendio|extintor|sinalizacao|controle de acesso/.test(haystack)) {
    return catalogCategoryVisuals.seguranca;
  }
  if (/energia|eletrico|eletrica|bateria|cabo|luminaria|lampada|gerador|nobreak|tomada|plug/.test(haystack)) {
    return catalogCategoryVisuals.energia;
  }
  if (/evento|cerimonial|hospedagem|alimentacao|coffee|refeicao|buffet|divulgacao|comunicacao|audiovisual/.test(haystack)) {
    return catalogCategoryVisuals.eventos;
  }
  if (/material|consumo|suprimento|insumo|genero alimenticio|descartavel|embalagem/.test(haystack)) {
    return catalogCategoryVisuals.consumo;
  }
  return catalogCategoryVisuals.institucional;
}

function getCatalogUseCount(product: any, expenseStack: CatalogExpenseStackEntry[]) {
  const naturezaCount = Number(product?.natureza_count || 0);
  if (Number.isFinite(naturezaCount) && naturezaCount > 0) return naturezaCount;
  if (expenseStack.length > 0) return expenseStack.length;
  return 1;
}

function findExpenseEntry(
  expenseStack: CatalogExpenseStackEntry[],
  expenseClass: "custeio" | "investimento",
) {
  return expenseStack.find((entry) => entry.expenseClass === expenseClass) || null;
}

type CatalogUsageDecisionOption = {
  key: string;
  label: string;
  description: string;
  expenseClass: CatalogFiscalChoice;
  badge: string;
  Icon: React.ElementType;
  entry: CatalogExpenseStackEntry | null;
};

type CatalogFiscalChoice = "custeio" | "investimento";

function buildUsageDecisionOptions(
  product: any,
  expenseStack: CatalogExpenseStackEntry[],
): CatalogUsageDecisionOption[] {
  const currentEntry = findExpenseEntry(expenseStack, "custeio");
  const capitalEntry = findExpenseEntry(expenseStack, "investimento");

  const options: CatalogUsageDecisionOption[] = [
    {
      key: "corrente",
      label: "Escolher corrente",
      description:
        normalizeTipoObjeto(product?.tipo_objeto || product?.category) === "servico"
          ? "Rotina, manutenção ou apoio operacional."
          : "Consumo, reposição ou uso recorrente.",
      expenseClass: "custeio",
      badge: "Corrente",
      Icon: CalendarBlank,
      entry: currentEntry,
    },
    {
      key: "investimento",
      label: "Escolher capital",
      description:
        normalizeTipoObjeto(product?.tipo_objeto || product?.category) === "servico"
          ? "Implantação, ampliação ou melhoria estrutural."
          : "Equipamento, bem durável ou investimento.",
      expenseClass: "investimento",
      badge: "Capital",
      Icon: TrendUp,
      entry: capitalEntry,
    },
  ];

  return options.filter((option) => Boolean(option.entry));
}

function CatalogCardStackLayers({
  visual,
  count,
  expanded,
}: {
  visual: CatalogCategoryVisual;
  count: number;
  expanded: boolean;
}) {
  if (count <= 1) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-16 overflow-hidden rounded-b-[28px]">
      {[0, 1, 2].map((layer) => (
        <div
          key={layer}
          className={cn(
            "absolute rounded-[24px] border shadow-sm transition-transform duration-300",
            visual.stackClassName,
          )}
          style={{
            left: 8 + layer * 8,
            right: 8 + layer * 8,
            bottom: 6 - layer * 9,
            height: expanded ? 44 : 36,
            opacity: 0.42 - layer * 0.09,
            transform: `translateY(${expanded ? 9 + layer * 4 : 13 + layer * 4}px)`,
          }}
        />
      ))}
    </div>
  );
}

const categories = [
  { id: "all", label: "Tudo", icon: Queue },
  { id: "material", label: "Materiais", icon: PaintRoller },
  { id: "servico", label: "Serviços", icon: BookOpen },
  { id: "kits", label: "Kits Prontos", icon: Package },
];

const CATALOG_EXPENSE_HELP_DISMISSED_KEY = "percata:catalog:expense-help-dismissed";

type FlyingParticle = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midX: number;
  midY: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
};

type NaturezaOption = {
  efisco_item_id: number;
  codigo_efisco: string;
  efisco_item_natureza_id: number;
  codigo_natureza_despesa: string | null;
  natureza_key: string;
  gnd: string | null;
  classe_despesa: string;
};

function buildProductSelectionKey(product: any) {
  const productCode = normalizeCode(product?.siad ?? product?.efiscoCode ?? product?.codigo_efisco ?? product?.codigo_tce ?? product?.id);
  if (!productCode) return null;

  if (
    requiresExplicitNaturezaSelection({
      natureza_count: product?.natureza_count,
      has_mixed_expense_classes: product?.has_mixed_expense_classes,
      codigo_natureza_despesa: product?.codigo_natureza_despesa,
      efisco_item_natureza_id: product?.efisco_item_natureza_id,
    }) &&
    !product?.efisco_item_natureza_id
  ) {
    return null;
  }

  return buildCatalogSelectionKey({
    ...product,
    codigo_tce: productCode,
    codigo_efisco: productCode,
  });
}

function buildNaturezaOptionSelectionKey(product: any, option: NaturezaOption) {
  const productCode = normalizeCode(product?.siad ?? product?.efiscoCode ?? product?.codigo_efisco ?? product?.codigo_tce ?? product?.id);
  if (!productCode) return null;
  return buildCatalogSelectionKey({
    codigo_tce: productCode,
    codigo_efisco: productCode,
    efisco_item_natureza_id: option.efisco_item_natureza_id,
    codigo_natureza_despesa: option.codigo_natureza_despesa,
    gnd: option.gnd,
  });
}

function buildFlightParticles(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): FlyingParticle[] {
  return Array.from({ length: 8 }).map((_, index) => {
    const spread = (Math.random() - 0.5) * 28;
    const arcLift = 48 + Math.random() * 44;
    const midX = startX + (endX - startX) * 0.42 + spread;
    const midY = Math.min(startY, endY) - arcLift;
    const palette = [
      "rgba(22,64,115,0.82)",
      "rgba(15,46,87,0.78)",
      "rgba(236,32,41,0.82)",
      "rgba(77,121,168,0.78)",
    ];

    return {
      id: `${Date.now()}-pt-${index}-${Math.random().toString(36).slice(2)}`,
      startX: startX + (Math.random() - 0.5) * 14,
      startY: startY + (Math.random() - 0.5) * 12,
      endX: endX + (Math.random() - 0.5) * 18,
      endY: endY + (Math.random() - 0.5) * 16,
      midX,
      midY,
      size: 4 + Math.random() * 4,
      delay: index * 0.018,
      duration: 0.62 + Math.random() * 0.22,
      color: palette[index % palette.length],
    };
  });
}

export default function CatalogoPage() {
  const { canCreate } = useSubmissionPolicy();
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortMode, setSortMode] = useState<
    "relevance" | "name" | "code" | "favorites_first"
  >("relevance");
  const [gndFilter, setGndFilter] = useState<CatalogExpenseFilter>("all");
  const [showExpenseHelp, setShowExpenseHelp] = useState(true);
  const [classeFilter, setClasseFilter] = useState("all");
  const [onlyNotInCart, setOnlyNotInCart] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [expertMode, setExpertMode] = useState(false);
  const [expertSelectedId, setExpertSelectedId] = useState<string | null>(null);
  const [expertSelectedNodeKey, setExpertSelectedNodeKey] = useState<string>("base");
  const [expertTaxonomy, setExpertTaxonomy] = useState<CatalogExpertNode | null>(null);
  const [expertProducts, setExpertProducts] = useState<any[]>([]);
  const [expertTotal, setExpertTotal] = useState(0);
  const [expertHasMore, setExpertHasMore] = useState(false);
  const [expertLoadingTree, setExpertLoadingTree] = useState(false);
  const [expertLoadingItems, setExpertLoadingItems] = useState(false);
  const [expertLoadingNodeKeys, setExpertLoadingNodeKeys] = useState<Set<string>>(new Set());
  const [expertOffset, setExpertOffset] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("solicitante");
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteSavingId, setFavoriteSavingId] = useState<number | null>(null);
  const [cartShakeKey, setCartShakeKey] = useState(0);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);
  const [destinationDialogOpen, setDestinationDialogOpen] = useState(false);
  const [collectiveRooms, setCollectiveRooms] = useState<Array<{ id: string; title: string; unit_name?: string }>>([]);
  const [selectedCollectiveRoomId, setSelectedCollectiveRoomId] = useState("");
  const [sendingToCollectiveRoom, setSendingToCollectiveRoom] = useState(false);
  const [expandedCartItemUid, setExpandedCartItemUid] = useState<string | null>(null);
  const [naturezaDialog, setNaturezaDialog] = useState<{
    product: any;
    options: NaturezaOption[];
  } | null>(null);
  const [flyingChip, setFlyingChip] = useState<{
    id: string;
    label: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [flyingParticles, setFlyingParticles] = useState<FlyingParticle[]>([]);
  const catalogDraft = useDfdDraft();
  const cartIconRef = useRef<HTMLDivElement | null>(null);
  const requestTokenRef = useRef(0);
  const { addItem, items, removeItem, updateItem, clearCarrinho } = useCarrinhoStore();

  const triggerCartShake = useCallback(() => {
    setCartShakeKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    try {
      setShowExpenseHelp(
        window.sessionStorage.getItem(CATALOG_EXPENSE_HELP_DISMISSED_KEY) !== "1",
      );
    } catch {
      setShowExpenseHelp(true);
    }
  }, []);

  const dismissExpenseHelp = useCallback(() => {
    setShowExpenseHelp(false);
    try {
      window.sessionStorage.setItem(CATALOG_EXPENSE_HELP_DISMISSED_KEY, "1");
    } catch {
      // noop
    }
  }, []);

  const loadFavorites = useCallback(async (targetUserId: string) => {
    const { data, error } = await supabase
      .from("catalogo_favoritos")
      .select("item_id")
      .eq("user_id", targetUserId);

    if (error) {
      if (
        error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message?.includes("schema cache")
      ) {
        toast.error(
          "Favoritos indisponíveis no banco. Aplique a migration de catálogo para habilitar.",
        );
      } else {
        toast.error("Não foi possível carregar seus favoritos.");
      }
      return;
    }

    const next = new Set<number>(
      (data || [])
        .map((row) => Number(row.item_id))
        .filter((value) => Number.isFinite(value)),
    );
    setFavoriteIds(next);
  }, []);

  useEffect(() => {
    let active = true;
    const loadCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      const nextUserId = data.user?.id ?? null;
      if (!active) return;
      setUserId(nextUserId);
      if (nextUserId) {
        void loadFavorites(nextUserId);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", nextUserId)
          .maybeSingle();
        if (!active) return;
        setUserRole(normalizeRole(profile?.role, data.user?.email));
      } else {
        setUserRole("solicitante");
      }
    };
    loadCurrentUser();
    return () => {
      active = false;
    };
  }, [loadFavorites]);

  const toggleFavorite = useCallback(
    async (product: any) => {
      if (!userId) {
        toast.error("Faça login para marcar favoritos.");
        return;
      }
      const itemId = toFavoriteItemId(product.id);
      if (!itemId) {
        toast.error("Este item não pode ser favoritado.");
        return;
      }

      const isCurrentlyFavorite = favoriteIds.has(itemId);
      setFavoriteSavingId(itemId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyFavorite) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      });

      if (isCurrentlyFavorite) {
        const { error } = await supabase
          .from("catalogo_favoritos")
          .delete()
          .eq("user_id", userId)
          .eq("item_id", itemId);

        if (error) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.add(itemId);
            return next;
          });
          toast.error("Não foi possível remover dos favoritos.");
        }
      } else {
        const { error } = await supabase
          .from("catalogo_favoritos")
          .insert({ user_id: userId, item_id: itemId });

        if (error) {
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
          toast.error("Não foi possível marcar este item como favorito.");
        }
      }

      setFavoriteSavingId(null);
    },
    [favoriteIds, userId],
  );

  useEffect(() => {
    async function fetchKits() {
      if (selectedCat === "kits") {
        setLoading(true);
        const { data } = await supabase.from("kits").select("*");
        setKits(data || []);
        setLoading(false);
      }
    }
    fetchKits();
  }, [selectedCat]);

  const addKitToCart = async (kitId: string) => {
    if (!canCreate) { toast.error("Prazo encerrado. Para corrigir uma DFD, abra a própria solicitação."); return; }
    const kit = kits.find((row) => row.id === kitId);
    const { data: items } = await supabase
      .from("kit_items")
      .select("*, catalogo(*)")
      .eq("kit_id", kitId);

    if (items && items.length > 0) {
      items.forEach((ki) => {
        const efiscoCode = ki.catalogo?.codigo_efisco ?? ki.catalogo?.id;
        if (!efiscoCode) return;
        const fiscalIssue = getCatalogFiscalIssue({
          ...ki.catalogo,
          codigo_natureza_despesa: ki.catalogo.codigo_natureza_preferencial,
          gnd: ki.catalogo.gnd_preferencial,
        });
        if (fiscalIssue && fiscalIssue !== "missing_natureza") {
          toast.error(getCatalogFiscalIssueMessage(fiscalIssue) || "Item fiscalmente inválido.");
          return;
        }
        const gnd =
          ki.catalogo.gnd_preferencial ||
          deriveGndFromNatureza(ki.catalogo.codigo_natureza_preferencial) ||
          "SEM_NATUREZA";
        addItem(
          {
            efisco_item_id: ki.catalogo.id,
            codigo_tce: String(efiscoCode),
            descricao: ki.catalogo.descricao,
            gnd,
            classe: String(ki.catalogo?.classe || "Sem Classe Informada"),
            unidade_medida: String(ki.catalogo?.unidade_medida || "UN"),
            categoria_consumo:
              normalizeTipoObjeto(ki.catalogo.tipo_objeto || ki.catalogo.tipo) !==
              "servico",
            tipo_objeto: ki.catalogo.tipo_objeto,
            codigo_grupo: ki.catalogo.codigo_grupo,
            nome_grupo: ki.catalogo.nome_grupo || ki.catalogo.grupo,
            codigo_classe: ki.catalogo.codigo_classe,
            nome_classe: ki.catalogo.nome_classe || ki.catalogo.classe,
            codigo_material_servico: ki.catalogo.codigo_material_servico,
            nome_material_servico: ki.catalogo.nome_material_servico,
            codigo_natureza_despesa: ki.catalogo.codigo_natureza_preferencial,
            gnd_derivado: gnd,
            natureza_count: Number(ki.catalogo.natureza_count || 0),
            has_mixed_expense_classes: Boolean(ki.catalogo.has_mixed_expense_classes),
            has_missing_natureza: Boolean(ki.catalogo.has_missing_natureza),
            requires_natureza_review: fiscalIssue === "missing_natureza",
          },
          "Kit Institucional",
          {
            quantidade: Math.max(1, Number(ki.quantidade ?? ki.quantidade_sugerida ?? 1)),
            justificativa_item: [
              `Item integrante do kit institucional "${kit?.nome || "DFD modelo"}".`,
              "Aplicação prevista: atender necessidade recorrente de custeio vinculada ao setor, laboratório, disciplina, projeto ou ação informada na DFD.",
              "Ajuste ou complemente esta justificativa caso o uso local seja mais específico.",
            ].join(" "),
            justificativa_quantidade: `Quantidade sugerida pelo kit institucional: ${Math.max(1, Number(ki.quantidade ?? ki.quantidade_sugerida ?? 1))}. Ajuste conforme estoque atual, número de usuários atendidos, frequência de uso e planejamento do setor/laboratório.`,
            source_kit_id: kitId,
            source_kit_nome: kit?.nome || "",
            source_kit_descricao: kit?.descricao || "",
          },
        );
      });
      triggerCartShake();
      toast.success(`${items.length} itens do kit adicionados ao carrinho!`);
    }
  };

  const PAGE_SIZE = 30;
  const SEARCH_PAGE_SIZE = 60;
  const EXPERT_NODE_PAGE_SIZE = 80;

  const cartSelectionSet = useMemo(() => {
    const keys = items
      .map((item) => buildCatalogSelectionKey(item.item_efisco || {}))
      .filter((key): key is string => Boolean(key));
    return new Set(keys);
  }, [items]);

  const cartBlockingSummary = useMemo(() => {
    let invalidItems = 0;
    const reasons: string[] = [];

    items.forEach((item, index) => {
      const itemCode = String(item.item_efisco?.codigo_tce || index + 1);
      const validation = getCartItemValidation(item);
      const itemErrors: string[] = [];
      itemErrors.push(...validation.issues.map((issue) => issue.toLocaleLowerCase("pt-BR")));

      if (itemErrors.length > 0) {
        invalidItems += 1;
        if (reasons.length < 4) {
          reasons.push(`Item ${itemCode}: ${itemErrors.join(", ")}`);
        }
      }
    });

    return {
      invalidItems,
      reasons,
      canProceed: items.length > 0 && invalidItems === 0,
    };
  }, [items]);

  const cartExpenseSummary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const validation = getCartItemValidation(item);
        const classification = classifyGnd(
          item.item_efisco?.gnd || item.item_efisco?.codigo_natureza_despesa,
        );
        if (classification?.expenseClass === "custeio") {
          acc.corrente.count += 1;
          acc.corrente.total += validation.subtotal;
        } else if (classification?.expenseClass === "investimento") {
          acc.capital.count += 1;
          acc.capital.total += validation.subtotal;
        } else {
          acc.outros.count += 1;
        }

        if (validation.ready) {
          acc.prontos += 1;
        } else {
          acc.pendentes += 1;
          if (!acc.firstPendingUid) acc.firstPendingUid = item.uid;
        }

        return acc;
      },
      {
        corrente: { count: 0, total: 0 },
        capital: { count: 0, total: 0 },
        outros: { count: 0 },
        prontos: 0,
        pendentes: 0,
        firstPendingUid: null as string | null,
      },
    );
  }, [items]);

  useEffect(() => {
    if (items.length === 0) {
      setExpandedCartItemUid(null);
      return;
    }

    setExpandedCartItemUid((current) => {
      if (current && items.some((item) => item.uid === current)) {
        return current;
      }
      return cartExpenseSummary.firstPendingUid || items[0]?.uid || null;
    });
  }, [cartExpenseSummary.firstPendingUid, items]);

  const naturezaOptionGroups = useMemo(
    () =>
      naturezaDialog
        ? groupNaturezaOptionsByExpenseClass(
            naturezaDialog.product,
            naturezaDialog.options,
          )
        : [],
    [naturezaDialog],
  );

  const classeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => String(product.classe || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [products],
  );

  const searchIntent = useMemo(() => {
    const normalized = sanitizeCatalogSearchInput(debouncedSearch).toLowerCase();
    if (!normalized) return "empty";
    if (/^[a-z0-9.\-_/]+$/.test(normalized) && !normalized.includes(" ")) {
      return "code";
    }
    if (normalized.length <= 2) return "broad";
    return "text";
  }, [debouncedSearch]);

  const searchAnalysis = useMemo(
    () => analyzeCatalogSearchQuery(debouncedSearch),
    [debouncedSearch],
  );

  const visibleProducts = useMemo(() => {
    let next = [...products];

    if (gndFilter !== "all") {
      next = next.filter((product) => productMatchesExpenseFilter(product, gndFilter));
    }

    if (classeFilter !== "all") {
      next = next.filter((product) => String(product.classe) === classeFilter);
    }

    if (onlyFavorites) {
      next = next.filter((product) => favoriteIds.has(Number(product.id)));
    }

    if (onlyNotInCart) {
      next = next.filter((product) => {
        const key = buildProductSelectionKey(product);
        return !key || !cartSelectionSet.has(key);
      });
    }

    next.sort((a, b) => {
      if (sortMode === "favorites_first") {
        const aFav = favoriteIds.has(Number(a.id)) ? 1 : 0;
        const bFav = favoriteIds.has(Number(b.id)) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return Number(b.rank || 0) - Number(a.rank || 0);
      }
      if (sortMode === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      }
      if (sortMode === "code") {
        return String(a.siad || "").localeCompare(String(b.siad || ""), "pt-BR");
      }
      return Number(b.rank || 0) - Number(a.rank || 0);
    });

    return next;
  }, [
    products,
    gndFilter,
    classeFilter,
    onlyFavorites,
    onlyNotInCart,
    cartSelectionSet,
    favoriteIds,
    sortMode,
  ]);

  useEffect(() => {
    const handler = setTimeout(
      () => setDebouncedSearch(sanitizeCatalogSearchInput(search)),
      350,
    );
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!cartSidebarOpen) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (destinationDialogOpen) {
        setDestinationDialogOpen(false);
        return;
      }
      setCartSidebarOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [cartSidebarOpen, destinationDialogOpen]);

  useEffect(() => {
    if (!cartSidebarOpen) return;
    let active = true;
    async function loadCollectiveRooms() {
      try {
        const response = await fetch("/api/collective-rooms?status=aberta");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Erro ao buscar salas.");
        if (!active) return;
        const rooms = (payload.rooms || []) as Array<{ id: string; title: string; unit_name?: string }>;
        setCollectiveRooms(rooms);
        setSelectedCollectiveRoomId((current) => current || rooms[0]?.id || "");
      } catch (error: any) {
        if (active) toast.error(error?.message || "Erro ao carregar DFDs coletivas.");
      }
    }
    loadCollectiveRooms();
    return () => {
      active = false;
    };
  }, [cartSidebarOpen]);

  const sendCartToCollectiveRoom = useCallback(async () => {
    if (!cartBlockingSummary.canProceed) {
      toast.error(
        `Preencha os campos obrigatórios antes de enviar. ${cartBlockingSummary.reasons.join(" | ")}`,
      );
      return;
    }
    if (!selectedCollectiveRoomId) {
      toast.warning("Selecione uma DFD coletiva aberta.");
      return;
    }

    setSendingToCollectiveRoom(true);
    try {
      for (const item of items) {
        const itemEfisco = item.item_efisco || ({} as any);
        const response = await fetch(
          `/api/collective-rooms/${selectedCollectiveRoomId}/contributions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              item: {
                efisco_item_id: itemEfisco.efisco_item_id,
                efisco_item_natureza_id: itemEfisco.efisco_item_natureza_id,
                codigo_item_efisco: itemEfisco.codigo_tce,
                codigo_tce: itemEfisco.codigo_tce,
                descricao: itemEfisco.descricao,
                unidade_medida: itemEfisco.unidade_medida,
                quantidade: item.quantidade,
                valor_unitario_estimado: item.valor_unitario_estimado,
                justificativa_item: item.justificativa_item || item.justificativa_quantidade,
                link_referencia: item.link_referencia,
                gnd: itemEfisco.gnd,
                gnd_derivado: itemEfisco.gnd_derivado || itemEfisco.gnd,
                codigo_natureza_despesa: itemEfisco.codigo_natureza_despesa,
                natureza_count: itemEfisco.natureza_count,
                has_mixed_expense_classes: itemEfisco.has_mixed_expense_classes,
                has_missing_natureza: itemEfisco.has_missing_natureza,
                requires_natureza_review: itemEfisco.requires_natureza_review,
                tipo_objeto: itemEfisco.tipo_objeto,
                codigo_grupo: itemEfisco.codigo_grupo,
                nome_grupo: itemEfisco.nome_grupo,
                codigo_classe: itemEfisco.codigo_classe,
                nome_classe: itemEfisco.nome_classe,
              },
            }),
          },
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Erro ao enviar item.");
      }
      toast.success("Itens enviados para a DFD coletiva.");
      clearCarrinho();
      setCartSidebarOpen(false);
      router.push(`/dfds-coletivas/${selectedCollectiveRoomId}`);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar itens para a DFD coletiva.");
    } finally {
      setSendingToCollectiveRoom(false);
    }
  }, [
    cartBlockingSummary.canProceed,
    cartBlockingSummary.reasons,
    clearCarrinho,
    items,
    router,
    selectedCollectiveRoomId,
  ]);

  const saveCartAsDraft = useCallback(async () => {
    if (items.length === 0) {
      toast.warning("Adicione ao menos um item antes de salvar o rascunho.");
      return;
    }

    const saved = await catalogDraft.saveImmediate(
      {
        groupingMode: "grupo",
        groupForms: {},
        cartItems: snapshotDfdDraftCartItems(items),
        showGuide: true,
        savedAt: new Date().toISOString(),
      },
      "catalogo",
    );

    if (saved.ok) {
      toast.success(
        saved.location === "server"
          ? "Rascunho salvo no PERCATA. Para retomar, acesse Nova DFD."
          : "Rascunho salvo neste navegador. O servidor do PERCATA está indisponível no momento.",
      );
      return;
    }

    toast.error(catalogDraft.lastError || "Não foi possível salvar o rascunho. Tente novamente.");
  }, [catalogDraft, items]);

  const fetchProductsPage = useCallback(
    async (targetPage: number, isNewSearch = false) => {
      const requestToken = ++requestTokenRef.current;
      if (selectedCat === "kits") {
        setProducts([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      if (isNewSearch) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const sanitizedSearch = sanitizeCatalogSearchInput(debouncedSearch);
      if (isArmamentRelatedCatalogQuery(sanitizedSearch)) {
        if (requestToken !== requestTokenRef.current) return;
        setProducts([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const isEmptySearch = !sanitizedSearch;
      const pageSize = isEmptySearch ? PAGE_SIZE : SEARCH_PAGE_SIZE;
      const result = await fetch(
        `/api/catalog-search?q=${encodeURIComponent(
          sanitizedSearch,
        )}&category=${encodeURIComponent(selectedCat)}&context=catalogo&limit=${pageSize}&offset=${
          targetPage * pageSize
        }`,
      ).then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        return {
          data: payload.items || [],
          error: response.ok ? null : payload,
          hasMore: Boolean(payload.hasMore),
        };
      });

      const { data, error } = result as {
        data: any[] | null;
        error: any;
        hasMore?: boolean;
      };
      const apiHasMore = "hasMore" in result ? Boolean(result.hasMore) : false;

      if (error) {
        if (requestToken !== requestTokenRef.current) return;
        toast.error("Falha ao consultar catálogo inteligente.");
        if (isNewSearch) {
          setProducts([]);
        }
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      if (data) {
        if (requestToken !== requestTokenRef.current) return;
        const visibleData = filterArmamentRelatedCatalogRows(data);
        const newProducts = visibleData.map((p: any, idx: number) => {
          const normalizedCode =
            normalizeCode(p.codigo_efisco) ??
            normalizeCode(p.codigo_tce) ??
            normalizeCode(p.id) ??
            `CUSTOM-${targetPage * pageSize + idx + 1}`;
          const codigoNatureza =
            p.codigo_natureza_preferencial || p.codigo_natureza_despesa || null;
          const gnd =
            p.gnd_preferencial ||
            p.gnd ||
            p.gnd_derivado ||
            deriveGndFromNatureza(codigoNatureza) ||
            "";

          return {
            efisco_item_id: p.efisco_item_id || p.id,
            efisco_item_natureza_id: p.efisco_item_natureza_id,
            efiscoCode: normalizedCode,
            id: String(p.id ?? normalizedCode),
            siad: normalizedCode,
            siadLabel: normalizedCode,
            name: String(p.descricao || "Descrição não informada"),
            summary: compactDescription(
              String(p.descricao || "Descrição não informada"),
              122,
            ),
            classe: String(
              p.nome_classe || p.classe || p.nome_grupo || p.grupo || "Sem Classe Informada",
            ),
            gnd,
            unidade_medida: String(p.unidade_medida || "UN"),
            category:
              normalizeTipoObjeto(p.tipo_objeto || p.tipo || p.categoria) ===
              "servico"
                ? "Serviço"
                : "Material",
            tipo_objeto: p.tipo_objeto,
            codigo_grupo: p.codigo_grupo,
            nome_grupo: p.nome_grupo || p.grupo,
            codigo_classe: p.codigo_classe,
            nome_classe: p.nome_classe || p.classe,
            codigo_material_servico: p.codigo_material_servico,
            nome_material_servico: p.nome_material_servico,
            codigo_natureza_despesa: codigoNatureza,
            natureza_count: Number(p.natureza_count || 0),
            has_mixed_expense_classes: Boolean(p.has_mixed_expense_classes),
            has_missing_natureza: Boolean(p.has_missing_natureza),
            gnds: Array.isArray(p.gnds) ? p.gnds : [],
            naturezas: Array.isArray(p.naturezas) ? p.naturezas : [],
            rank: Number(p.rank || 0),
          };
        });
        const rankedProducts = isEmptySearch
          ? newProducts
          : rerankCatalogSearchResults(debouncedSearch, newProducts);

        setProducts((prev) =>
          isNewSearch ? rankedProducts : mergeUniqueProducts(prev, rankedProducts),
        );
        setHasMore(isEmptySearch ? data.length === pageSize : apiHasMore);
      }
      if (requestToken !== requestTokenRef.current) return;
      setLoading(false);
      setLoadingMore(false);
    },
    [debouncedSearch, selectedCat],
  );

  const fetchProductsPageRef = useRef(fetchProductsPage);

  useEffect(() => {
    fetchProductsPageRef.current = fetchProductsPage;
  }, [fetchProductsPage]);

  useEffect(() => {
    setPage(0);
    if (selectedCat === "kits") {
      setProducts([]);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    setProducts([]);
    setHasMore(true);
    setLoadingMore(false);
    fetchProductsPage(0, true);
  }, [debouncedSearch, selectedCat, fetchProductsPage]);

  useEffect(() => {
    if (page > 0) fetchProductsPageRef.current(page, false);
  }, [page]);

  const addResolvedProductToCart = useCallback(
    (product: any, sourceEl?: HTMLElement | null) => {
      if (!canCreate) { toast.error("Prazo encerrado. Para corrigir uma DFD, abra a própria solicitação."); return; }
      const productCode = normalizeCode(
        product.siad ?? product.efiscoCode ?? product.id,
      );
      if (!productCode) {
        toast.error("Item sem código e-Fisco válido.");
        return;
      }

      const selectionKey = buildProductSelectionKey(product);
      if (selectionKey && cartSelectionSet.has(selectionKey)) {
        toast.info("Esta opção já está na seleção.");
        return;
      }

      addItem(
        {
          efisco_item_id: product.efisco_item_id,
          efisco_item_natureza_id: product.efisco_item_natureza_id,
          codigo_tce: productCode,
          descricao: product.name,
          gnd: product.gnd as any,
          classe: String(product.classe || "Sem Classe Informada"),
          unidade_medida: String(product.unidade_medida || "UN"),
          categoria_consumo: normalizeTipoObjeto(product.tipo_objeto || product.category) !== "servico",
          tipo_objeto:
            product.tipo_objeto ||
            (normalizeTipoObjeto(product.category) === "servico" ? "SERVIÇO" : "MATERIAL"),
          codigo_grupo: product.codigo_grupo,
          nome_grupo: product.nome_grupo,
          codigo_classe: product.codigo_classe,
          nome_classe: product.nome_classe,
          codigo_material_servico: product.codigo_material_servico,
          nome_material_servico: product.nome_material_servico,
          codigo_natureza_despesa: product.codigo_natureza_despesa,
          gnd_derivado: product.gnd,
          natureza_count: product.natureza_count,
          has_mixed_expense_classes: product.has_mixed_expense_classes,
          has_missing_natureza: product.has_missing_natureza,
          requires_natureza_review: product.requires_natureza_review,
        },
        "Não definido",
      );

      void recordCatalogSearchClick({
        actionType: "add_to_cart",
        queryText: debouncedSearch,
        category: selectedCat,
        context: "catalogo",
        source: "catalog_search",
        resultPosition:
          Number.isFinite(Number(product.searchPosition)) && Number(product.searchPosition) >= 0
            ? Number(product.searchPosition)
            : null,
        catalogId: product.id,
        codigoEfisco: product.efiscoCode || product.siad,
        itemDescricao: product.name,
      });

      if (sourceEl) {
        const source = sourceEl.getBoundingClientRect();
        const target = cartIconRef.current?.getBoundingClientRect();
        const fallbackTarget = {
          left: window.innerWidth - 80,
          top: window.innerHeight - 80,
          width: 24,
          height: 24,
        };
        const end = target || fallbackTarget;
        const startX = source.left + source.width / 2 - 26;
        const startY = source.top + source.height / 2 - 12;
        const endX = end.left + end.width / 2 - 18;
        const endY = end.top + end.height / 2 - 10;
        setFlyingChip({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          label: String(product.siadLabel || productCode),
          startX,
          startY,
          endX,
          endY,
        });
        setFlyingParticles((prev) => [
          ...prev,
          ...buildFlightParticles(startX, startY, endX, endY),
        ]);
      }

      triggerCartShake();
      toast.success("Item adicionado ao carrinho.");
    },
    [addItem, cartSelectionSet, debouncedSearch, selectedCat, triggerCartShake, canCreate],
  );

  const handleAddProduct = useCallback(
    async (product: any, sourceEl?: HTMLElement | null) => {
      const productCode = normalizeCode(
        product.siad ?? product.efiscoCode ?? product.id,
      );
      if (!productCode) {
        toast.error("Item sem código e-Fisco válido.");
        return;
      }
      const selectionKey = buildProductSelectionKey(product);
      if (selectionKey && cartSelectionSet.has(selectionKey)) {
        toast.info("Esta opção já está na seleção.");
        return;
      }

      const fiscalIssue = getCatalogFiscalIssue({
        ...product,
        codigo_efisco: productCode,
        codigo_natureza_despesa: product.codigo_natureza_despesa,
        efisco_item_id: product.efisco_item_id,
        efisco_item_natureza_id: product.efisco_item_natureza_id,
      });

      if (!fiscalIssue) {
        addResolvedProductToCart(product, sourceEl);
        return;
      }

      if (fiscalIssue === "missing_natureza") {
        addResolvedProductToCart({
          ...product,
          gnd: "SEM_NATUREZA",
          gnd_derivado: "SEM_NATUREZA",
          codigo_natureza_despesa: null,
          natureza_count: 0,
          has_missing_natureza: true,
          requires_natureza_review: true,
        }, sourceEl);
        toast.warning(
          "Item sem natureza adicionado. Ele será separado em DFD própria para revisão da equipe.",
        );
        return;
      }

      try {
        const params = new URLSearchParams();
        if (product.efisco_item_id) {
          params.set("efisco_item_id", String(product.efisco_item_id));
        }
        params.set("codigo_efisco", productCode);
        const response = await fetch(`/api/catalog-item-naturezas?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Não foi possível carregar naturezas.");
        }
        const options = ((payload.items || []) as NaturezaOption[]).filter(
          (option) => option.codigo_natureza_despesa && option.gnd,
        );
        if (options.length === 0) {
          toast.error(getCatalogFiscalIssueMessage(fiscalIssue) || "Item fiscalmente inválido.");
          return;
        }
        if (fiscalIssue === "mixed_expense_classes") {
          const selectedExpenseClass = product.selected_expense_class as
            | CatalogFiscalChoice
            | undefined;
          if (selectedExpenseClass) {
            const option = selectNaturezaOptionByExpenseClass(options, selectedExpenseClass);
            if (!option) {
              toast.error(
                selectedExpenseClass === "investimento"
                  ? "Não encontramos uma natureza de capital para este item."
                  : "Não encontramos uma natureza corrente para este item.",
              );
              return;
            }
            const resolvedCode = option.codigo_efisco || productCode;
            addResolvedProductToCart(
              {
                ...product,
                siad: resolvedCode,
                efiscoCode: resolvedCode,
                codigo_tce: resolvedCode,
                codigo_efisco: resolvedCode,
                efisco_item_id: option.efisco_item_id,
                efisco_item_natureza_id: option.efisco_item_natureza_id,
                codigo_natureza_despesa: option.codigo_natureza_despesa,
                gnd: option.gnd,
                gnd_derivado: option.gnd,
                natureza_count: 1,
                has_mixed_expense_classes: false,
                has_missing_natureza: false,
                requires_natureza_review: false,
              },
              sourceEl,
            );
            toast.success(
              `Item adicionado como ${
                selectedExpenseClass === "investimento" ? "capital" : "corrente"
              }.`,
            );
            return;
          }
          setNaturezaDialog({ product, options });
          return;
        }
        if (options.length === 1) {
          const option = options[0];
          addResolvedProductToCart(
            {
              ...product,
              efisco_item_id: option.efisco_item_id,
              efisco_item_natureza_id: option.efisco_item_natureza_id,
              codigo_natureza_despesa: option.codigo_natureza_despesa,
              gnd: option.gnd,
              gnd_derivado: option.gnd,
              natureza_count: 1,
              has_mixed_expense_classes: false,
              has_missing_natureza: false,
            },
            sourceEl,
          );
          return;
        }
        setNaturezaDialog({ product, options });
      } catch (error: any) {
        toast.error(error?.message || "Não foi possível carregar naturezas.");
      }
    },
    [addResolvedProductToCart, cartSelectionSet],
  );

  const canUseExpertMode = userRole === "admin" || userRole === "superadmin";
  const expertNodeProducts = useMemo(() => {
    let next = [...expertProducts];

    if (onlyFavorites) {
      next = next.filter((product) => favoriteIds.has(Number(product.id)));
    }

    if (onlyNotInCart) {
      next = next.filter((product) => {
        const key = buildProductSelectionKey(product);
        return !key || !cartSelectionSet.has(key);
      });
    }

    return next.sort((a, b) => {
      if (sortMode === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      }
      if (sortMode === "code") {
        return String(a.siad || "").localeCompare(String(b.siad || ""), "pt-BR");
      }
      return String(a.siad || "").localeCompare(String(b.siad || ""), "pt-BR");
    });
  }, [cartSelectionSet, expertProducts, favoriteIds, onlyFavorites, onlyNotInCart, sortMode]);
  const expertSelectedProduct = useMemo(
    () => selectCatalogExpertPreviewItem(expertNodeProducts, expertSelectedId),
    [expertNodeProducts, expertSelectedId],
  );
  const displayCount =
    selectedCat === "kits"
      ? kits.length
      : expertMode && canUseExpertMode
        ? expertNodeProducts.length
        : visibleProducts.length;
  const totalFound =
    selectedCat === "kits"
      ? kits.length
      : expertMode && canUseExpertMode
        ? expertTotal || expertTaxonomy?.count || 0
        : products.length;
  const favoritesCount = favoriteIds.size;

  const handleExpertModeToggle = useCallback(() => {
    setExpertMode((current) => {
      const next = !current;
      if (next) {
        setSearch("");
        setDebouncedSearch("");
        setSelectedCat("all");
        setGndFilter("all");
        setClasseFilter("all");
        setPage(0);
        setExpertSelectedNodeKey("base");
        setExpertSelectedId(null);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!canUseExpertMode && expertMode) setExpertMode(false);
  }, [canUseExpertMode, expertMode]);

  const loadExpertTaxonomy = useCallback(async () => {
    setExpertLoadingTree(true);
    try {
      const response = await fetch("/api/catalog-expert/taxonomy?parentKey=base");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel carregar a arvore tecnica.");
      }
      setExpertTaxonomy(payload.taxonomy || null);
      setExpertTotal(Number(payload.total || payload.taxonomy?.count || 0));
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível carregar a árvore técnica.");
      setExpertTaxonomy(null);
      setExpertTotal(0);
    } finally {
      setExpertLoadingTree(false);
    }
  }, []);

  const loadExpertNodeChildren = useCallback(
    async (parentKey: string) => {
      if (!parentKey || parentKey === "base") return;
      if (expertLoadingNodeKeys.has(parentKey)) return;
      const targetNode = (() => {
        const stack = expertTaxonomy ? [expertTaxonomy] : [];
        while (stack.length > 0) {
          const node = stack.shift()!;
          if (node.key === parentKey) return node;
          stack.push(...node.children);
        }
        return null;
      })();
      if (!targetNode?.hasMoreChildren || targetNode.children.length > 0) return;

      setExpertLoadingNodeKeys((prev) => new Set(prev).add(parentKey));
      try {
        const params = new URLSearchParams({ parentKey });
        const response = await fetch(`/api/catalog-expert/taxonomy?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Nao foi possivel carregar este ramo.");
        }
        const children = Array.isArray(payload.children) ? payload.children : [];
        setExpertTaxonomy((current) =>
          current ? attachCatalogExpertChildren(current, parentKey, children) : current,
        );
      } catch (error: any) {
        toast.error(error?.message || "Não foi possível carregar este ramo.");
      } finally {
        setExpertLoadingNodeKeys((prev) => {
          const next = new Set(prev);
          next.delete(parentKey);
          return next;
        });
      }
    },
    [expertLoadingNodeKeys, expertTaxonomy],
  );

  const loadExpertNodeItems = useCallback(
    async (nodeKey: string, offset = 0, append = false) => {
      setExpertLoadingItems(true);
      try {
        const params = new URLSearchParams({
          nodeKey,
          limit: String(EXPERT_NODE_PAGE_SIZE),
          offset: String(offset),
        });
        const response = await fetch(`/api/catalog-expert/items?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Nao foi possivel carregar itens do no tecnico.");
        }
        const items = Array.isArray(payload.items) ? payload.items : [];
        setExpertProducts((prev) => (append ? mergeUniqueProducts(prev, items) : items));
        setExpertTotal(Number(payload.total || 0));
        setExpertHasMore(Boolean(payload.hasMore));
        setExpertOffset(offset + items.length);
      } catch (error: any) {
        toast.error(error?.message || "Não foi possível carregar itens do nó técnico.");
        if (!append) {
          setExpertProducts([]);
          setExpertTotal(0);
          setExpertHasMore(false);
          setExpertOffset(0);
        }
      } finally {
        setExpertLoadingItems(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!expertMode || !canUseExpertMode) return;
    if (!expertTaxonomy) void loadExpertTaxonomy();
  }, [canUseExpertMode, expertMode, expertTaxonomy, loadExpertTaxonomy]);

  useEffect(() => {
    if (!expertMode || !canUseExpertMode) return;
    if (getCatalogExpertNodeDepth(expertSelectedNodeKey) !== "class") {
      setExpertProducts([]);
      setExpertTotal(0);
      setExpertHasMore(false);
      setExpertOffset(0);
      return;
    }
    void loadExpertNodeItems(expertSelectedNodeKey, 0, false);
  }, [canUseExpertMode, expertMode, expertSelectedNodeKey, loadExpertNodeItems]);

  useEffect(() => {
    if (!expertNodeProducts.some((product) => String(product.id) === String(expertSelectedId))) {
      setExpertSelectedId(null);
    }
  }, [expertNodeProducts, expertSelectedId]);

  const handleProceedToDfd = useCallback(() => {
    if (!cartBlockingSummary.canProceed) {
      setCartSidebarOpen(true);
      toast.warning(
        cartBlockingSummary.reasons.length > 0
          ? `Revise a seleção antes de continuar. ${cartBlockingSummary.reasons.join(" | ")}`
          : "Revise a seleção antes de continuar.",
      );
      return;
    }
    router.push("/nova-dfd");
  }, [cartBlockingSummary.canProceed, cartBlockingSummary.reasons, router]);

  return (
    <div className="p-6 space-y-8 pb-40 min-h-screen bg-[var(--p-color-bg-muted)]">
      <AnimatePresence>
        {naturezaDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--p-color-scrim-strong)] px-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl border border-black/10"
            >
              <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 md:p-6">
                <div className="max-w-3xl">
                  <p className="type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-brand-400)]">
                    Escolha de uso
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-500)] md:text-2xl">
                    Como esse item entra na sua demanda?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                    Escolha primeiro pela finalidade de uso. O código técnico continua disponível,
                    mas fica em segundo plano para não atrapalhar a decisão.
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs text-[var(--p-color-fg-subtle)]">
                    {naturezaDialog.product.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNaturezaDialog(null)}
                  className="h-9 w-9 rounded-full border border-black/10 text-[var(--p-color-fg-subtle)] hover:bg-[var(--p-color-surface-soft)]"
                  aria-label="Fechar"
                >
                  <X size={16} className="mx-auto" />
                </button>
              </div>

              <div className="max-h-[72vh] overflow-y-auto p-4 md:p-6">
                <div className="grid gap-4 lg:grid-cols-2">
                  {naturezaOptionGroups.map((group) => (
                    <section
                      key={group.key}
                      className={cn(
                        "rounded-[28px] border p-4 shadow-sm",
                        group.panelClassName,
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 type-kicker font-semibold uppercase tracking-widest",
                              group.badgeClassName,
                            )}
                          >
                            {group.label}
                          </span>
                          <h3 className="mt-3 font-display text-lg font-semibold text-[var(--p-color-brand-600)]">
                            {group.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                            {group.description}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/80 px-3 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-brand-500)]">
                          {group.options.length} opção{group.options.length > 1 ? "ões" : ""}
                        </span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {(() => {
                          const option = group.options[0];
                          const optionKey = buildNaturezaOptionSelectionKey(
                            naturezaDialog.product,
                            option,
                          );
                          const optionInCart = Boolean(optionKey && cartSelectionSet.has(optionKey));
                          const optionLabel = getExpenseClassOptionLabel(option);

                          return (
                            <button
                              type="button"
                              disabled={optionInCart}
                              onClick={() => {
                                addResolvedProductToCart({
                                  ...naturezaDialog.product,
                                  efisco_item_id: option.efisco_item_id,
                                  efisco_item_natureza_id: option.efisco_item_natureza_id,
                                  codigo_natureza_despesa: option.codigo_natureza_despesa,
                                  gnd: option.gnd,
                                  gnd_derivado: option.gnd,
                                  natureza_count: 1,
                                  has_mixed_expense_classes: false,
                                  has_missing_natureza: false,
                                });
                                setNaturezaDialog(null);
                              }}
                              className={cn(
                                "w-full rounded-2xl border bg-white px-4 py-4 text-left transition-colors",
                                optionInCart
                                  ? "cursor-not-allowed border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-subtle)]"
                                  : "border-white/70 hover:border-[var(--p-color-brand-400)]/25 hover:bg-[var(--p-color-surface-soft)]",
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p
                                    className={cn(
                                      "text-sm font-semibold",
                                      optionInCart
                                        ? "text-[var(--p-color-fg-subtle)]"
                                        : "text-[var(--p-color-brand-500)]",
                                    )}
                                  >
                                    {optionLabel.label}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                                    {optionLabel.technicalLabel} · {group.options.length} natureza(s) possível(is)
                                  </p>
                                </div>
                                <span className="rounded-full bg-[var(--p-color-surface-soft)] px-2 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-muted)]">
                                  {optionLabel.naturezaCode}
                                </span>
                              </div>
                            </button>
                          );
                        })()}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {destinationDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--p-color-scrim-strong)] px-4"
            role="presentation"
          >
            <motion.section
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="destination-dialog-title"
              className="w-full max-w-[520px] rounded-3xl border border-black/10 bg-white p-5 shadow-2xl md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-brand-400)]">
                    Etapa final
                  </p>
                  <h2 id="destination-dialog-title" className="mt-1 font-display text-xl font-semibold text-[var(--p-color-brand-500)] md:text-2xl">
                    Para onde deseja enviar esta demanda?
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                    Escolha o destino que corresponde a esta necessidade.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDestinationDialogOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-[var(--p-color-fg-subtle)] hover:bg-[var(--p-color-surface-soft)]"
                  aria-label="Fechar escolha de destino"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationDialogOpen(false);
                    setCartSidebarOpen(false);
                    router.push("/nova-dfd");
                  }}
                  className="group rounded-2xl border border-[var(--p-color-brand-400)]/25 bg-[var(--p-color-info-bg)] p-4 text-left transition-colors hover:border-[var(--p-color-brand-400)] hover:bg-white"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-brand-500)] text-white">
                      <ArrowRight size={18} weight="bold" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[var(--p-color-brand-500)]">Criar DFD individual</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--p-color-fg-muted)]">Para uma demanda específica da sua unidade.</span>
                    </span>
                  </div>
                </button>

                <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-collab)] text-white">
                      <UsersThree size={18} weight="bold" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--p-color-brand-500)]">Enviar para DFD coletiva</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">Para uma necessidade compartilhada com outras unidades.</p>
                    </div>
                  </div>
                  <label className="mt-4 block type-kicker font-semibold uppercase tracking-widest text-black/40">
                    DFD coletiva aberta
                    <select
                      value={selectedCollectiveRoomId}
                      onChange={(event) => setSelectedCollectiveRoomId(event.target.value)}
                      disabled={collectiveRooms.length === 0}
                      className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-fg-strong)] outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {collectiveRooms.length === 0 ? (
                        <option value="">Nenhuma sala aberta disponível</option>
                      ) : (
                        collectiveRooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.title} {room.unit_name ? `· ${room.unit_name}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={sendCartToCollectiveRoom}
                    disabled={sendingToCollectiveRoom || collectiveRooms.length === 0}
                    className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--p-color-collab)] text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[var(--p-color-collab-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UsersThree size={15} weight="bold" />
                    {sendingToCollectiveRoom ? "Enviando..." : "Enviar para sala"}
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search strip */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-[0_14px_36px_rgba(15,35,70,0.06)]"
        >
          <p className="type-kicker font-bold uppercase tracking-[0.18em] text-[var(--p-color-brand-500)]">
            Pesquisa inteligente
          </p>
          <div className="relative mt-3">
            <MagnifyingGlass
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--p-color-brand-700)]/55"
              size={20}
              weight="bold"
            />
            <input
              type="text"
              placeholder="Pesquise por nome, código e-Fisco, categoria ou palavra-chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar no catálogo e-Fisco"
              className="h-14 w-full rounded-[20px] border border-[var(--p-color-border-strong)] bg-white px-12 pr-16 text-sm font-semibold text-[var(--p-color-fg-strong)] outline-none transition-all placeholder:text-[var(--p-color-fg-muted)] focus:border-[var(--p-color-brand-400)] focus:ring-4 focus:ring-[var(--p-color-brand-400)]/10"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-2xl border border-[var(--p-color-border)] bg-white text-[var(--p-color-brand-500)] shadow-sm"
              aria-label="Ajustar filtros da pesquisa"
            >
              <SlidersHorizontal size={18} weight="bold" />
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex min-h-[106px] items-center justify-between gap-4 rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-[0_14px_36px_rgba(15,35,70,0.06)]"
        >
          {expertMode && canUseExpertMode ? (
            <div className="min-w-0">
              <p className="type-kicker font-bold uppercase tracking-[0.18em] text-[var(--p-color-brand-500)]">
                Estratégia da busca
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--p-color-brand-700)]">
                Navegação por tipo, grupo, classe e código e-Fisco.
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--p-color-fg-muted)]">
                {expertTaxonomy?.count || expertTotal || 0} itens na base técnica.
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="type-kicker font-bold uppercase tracking-[0.18em] text-[var(--p-color-brand-500)]">
                Estratégia da busca
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[var(--p-color-brand-700)]">
                Resultados por classe, grupo ou código e-Fisco para respostas mais rápidas e consistentes.
              </p>
              {searchIntent === "text" &&
              (searchAnalysis.primaryTerms.length > 0 ||
                searchAnalysis.specificationTerms.length > 0) ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {searchAnalysis.primaryTerms.slice(0, 2).map((term) => (
                    <span
                      key={`primary-${term}`}
                      className="rounded-full bg-[var(--p-color-brand-500)] px-2.5 py-1 type-caption font-bold text-white"
                    >
                      Foco: {term}
                    </span>
                  ))}
                  {searchAnalysis.specificationTerms.slice(0, 2).map((term) => (
                    <span
                      key={`spec-${term}`}
                      className="rounded-full border border-[var(--p-color-border)] bg-white px-2.5 py-1 type-caption font-bold text-[var(--p-color-brand-500)]"
                    >
                      Refino: {term}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
          <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)] sm:flex">
            <CheckCircle size={28} weight="duotone" />
          </span>
        </motion.div>
      </div>

      {!expertMode && showExpenseHelp && (
        <section className="rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-surface-soft)] p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]">
                <BookOpen size={20} weight="duotone" />
              </span>
              <div>
                <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-400)]">
                  Como escolher o uso do item
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold text-[var(--p-color-brand-500)]">
                  Pense primeiro na finalidade, não no código
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--p-color-fg-muted)]">
                  Quando aparecer mais de uma opção para o mesmo item, escolha pela forma como ele será usado no setor. O código técnico continua disponível, mas ele não precisa ser o ponto de partida da decisão.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissExpenseHelp}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--p-color-info-border)] bg-white px-3 text-xs font-semibold text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]"
            >
              <X size={14} weight="bold" />
              Ocultar nesta aba
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)]/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[var(--p-color-success-border)] bg-white px-3 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-success)]">
                  Corrente
                </span>
                <span className="type-caption font-semibold text-[var(--p-color-success)]">Uso do dia a dia</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--p-color-fg-strong)]">
                Para consumo, reposição, manutenção ou apoio recorrente.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                Exemplos: material de uso frequente, reposição de estoque, pequenos apoios operacionais e serviços ligados à rotina do setor.
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)]/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-[var(--p-color-insight-border)] bg-white px-3 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-insight)]">
                  Capital
                </span>
                <span className="type-caption font-semibold text-[var(--p-color-insight)]">Investimento ou bem durável</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-[var(--p-color-fg-strong)]">
                Para equipamento, ampliação de estrutura ou aquisição duradoura.
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                Exemplos: equipamentos, bens permanentes, itens de longa duração e aquisições que ampliam a capacidade instalada.
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-[var(--p-color-border)] bg-white px-4 py-3 text-sm text-[var(--p-color-fg-muted)]">
            Se o mesmo item aparecer nas duas formas, o sistema vai pedir que você escolha a <strong>finalidade de uso</strong>. A referência técnica fica disponível apenas como apoio.
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none bg-white border border-[var(--p-color-border)] rounded-2xl p-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCat(cat.id);
              setPage(0);
              setClasseFilter("all");
              setGndFilter("all");
              setOnlyFavorites(false);
            }}
            aria-pressed={selectedCat === cat.id}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-display font-semibold text-xs uppercase tracking-wider whitespace-nowrap",
              selectedCat === cat.id
                ? "bg-[var(--p-color-brand-400)] text-white shadow-md"
                : "bg-white text-[var(--p-color-fg-muted)] hover:bg-black/5 border border-[var(--p-color-border)]",
            )}
          >
            <cat.icon size={16} weight="bold" />
            {cat.label}
          </button>
        ))}
      </div>

      {selectedCat !== "kits" && (
        <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-2">
          <div className="h-10 px-3 rounded-xl border border-black/10 bg-[var(--p-color-surface-muted)] type-caption font-semibold uppercase tracking-wider text-[var(--p-color-brand-400)] flex items-center">
            Exibindo {displayCount} de {totalFound} itens
          </div>

          {canUseExpertMode && (
            <button
              type="button"
              onClick={handleExpertModeToggle}
              aria-pressed={expertMode}
              className={cn(
                "h-10 px-4 rounded-xl border type-kicker font-semibold uppercase tracking-widest transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-1.5",
                expertMode
                  ? "border-[var(--p-color-brand-500)]/20 bg-[var(--p-color-brand-500)] text-white hover:bg-[var(--p-color-brand-700)]"
                  : "border-[var(--p-color-brand-500)]/15 bg-white text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]",
              )}
            >
              <SlidersHorizontal size={14} weight="bold" />
              {expertMode ? "Busca rápida" : "Modo técnico"}
            </button>
          )}

          <select
            value={sortMode}
            onChange={(event) =>
              setSortMode(
                event.target.value as
                  | "relevance"
                  | "name"
                  | "code"
                  | "favorites_first",
              )
            }
            className="h-10 min-w-[180px] rounded-xl border border-black/10 px-3 text-xs font-semibold text-[var(--p-color-brand-500)] bg-white outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
            aria-label="Ordenação dos itens"
          >
            <option value="relevance">Ordenar: relevância</option>
            <option value="favorites_first">Ordenar: favoritos primeiro</option>
            <option value="name">Ordenar: nome</option>
            <option value="code">Ordenar: código e-Fisco</option>
          </select>

          {!expertMode ? (
            <>
              <select
                value={gndFilter}
                onChange={(event) =>
                  setGndFilter(event.target.value as CatalogExpenseFilter)
                }
                className="h-10 min-w-[160px] rounded-xl border border-black/10 px-3 text-xs font-semibold text-[var(--p-color-brand-500)] bg-white outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                aria-label="Filtro por tipo de despesa"
              >
                <option value="all">Uso do recurso: todos</option>
                <option value="corrente">Uso corrente</option>
                <option value="capital">Uso de capital</option>
              </select>

              <select
                value={classeFilter}
                onChange={(event) => setClasseFilter(event.target.value)}
                className="h-10 min-w-[200px] rounded-xl border border-black/10 px-3 text-xs font-semibold text-[var(--p-color-brand-500)] bg-white outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                aria-label="Filtro por classe"
              >
                <option value="all">Classe: todas</option>
                {classeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="h-10 rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-3 type-kicker font-bold uppercase tracking-widest text-[var(--p-color-brand-500)] flex items-center">
              Filtros substituídos pelo acordeon E-Fisco
            </div>
          )}

          <button
            type="button"
            onClick={() => setOnlyFavorites((prev) => !prev)}
            aria-pressed={onlyFavorites}
            className={cn(
              "h-10 px-4 rounded-xl border type-kicker font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5",
              onlyFavorites
                ? "border-[var(--p-color-danger)] bg-[var(--p-color-danger)] text-white"
                : "border-black/10 bg-white text-[var(--p-color-danger)] hover:bg-[var(--p-color-danger-bg)]",
            )}
          >
            <Heart size={14} weight={onlyFavorites ? "fill" : "regular"} />
            {onlyFavorites
              ? `Somente favoritos (${favoritesCount})`
              : `Filtrar favoritos (${favoritesCount})`}
          </button>

          <button
            type="button"
            onClick={() => setOnlyNotInCart((prev) => !prev)}
            aria-pressed={onlyNotInCart}
            className={cn(
              "h-10 px-4 rounded-xl border type-kicker font-semibold uppercase tracking-widest transition-colors",
              onlyNotInCart
                ? "border-[var(--p-color-brand-400)] bg-[var(--p-color-brand-400)] text-white"
                : "border-black/10 bg-white text-[var(--p-color-brand-400)] hover:bg-[var(--p-color-surface-subtle)]",
            )}
          >
            {onlyNotInCart ? "Somente não adicionados" : "Ocultar já adicionados"}
          </button>
        </div>
      )}

      {/* Masonry Layout Grid */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading && page === 0 && !(expertMode && canUseExpertMode) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <ProductSkeleton key={i} />
              ))}
            </div>
          ) : selectedCat === "kits" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {kits.map((kit) => (
                <motion.div
                  key={kit.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border-2 border-[var(--p-color-brand-500)]/5 p-8 rounded-[40px] shadow-sm hover:shadow-xl hover:border-[var(--p-color-brand-500)]/20 transition-all group shrink-0"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-[var(--p-color-brand-500)] text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Package size={28} weight="fill" />
                    </div>
                    <span className="rounded-full bg-[var(--p-color-surface-muted)] px-3 py-1 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-fg-subtle)]">
                      {kit.categoria}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tighter uppercase text-[var(--p-color-brand-500)] mb-2">
                    {kit.nome}
                  </h3>
                  <p className="mb-8 line-clamp-3 text-xs font-medium leading-relaxed text-[var(--p-color-fg-subtle)]">
                    {kit.descricao ||
                      "Este kit contém os itens essenciais homologados pela PROPLAN para esta atividade."}
                  </p>
                  <CatalogDescriptionDialog title={kit.nome} description={kit.descricao || "Kit de itens para compor uma solicitação."} />
                  <Button
                    onClick={() => addKitToCart(kit.id)}
                    className="w-full h-14 rounded-2xl bg-[var(--p-color-brand-500)] text-white font-semibold uppercase tracking-tight hover:bg-[var(--p-color-brand-500)]/90 shadow-xl shadow-upe-accent-washed-blue/60"
                  >
                    Adicionar Kit Completo
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : expertMode && canUseExpertMode ? (
            <div className="space-y-10">
              {expertTaxonomy ? (
                <ExpertCatalogView
                  products={expertNodeProducts}
                  taxonomy={expertTaxonomy}
                  selectedNodeKey={expertSelectedNodeKey}
                  selectedProduct={expertSelectedProduct}
                  cartSelectionSet={cartSelectionSet}
                  loadingItems={expertLoadingItems}
                  loadingNodeKeys={expertLoadingNodeKeys}
                  totalItems={expertTotal}
                  onSelectNode={(nodeKey) => {
                    setExpertSelectedNodeKey(nodeKey);
                    setExpertSelectedId(null);
                    void loadExpertNodeChildren(nodeKey);
                  }}
                  onLoadChildren={loadExpertNodeChildren}
                  onSelectProduct={(product) => setExpertSelectedId(String(product.id))}
                  onAdd={handleAddProduct}
                  canAdd={canCreate}
                />
              ) : (
                <OperationalEmptyState
                  icon={<SlidersHorizontal size={42} weight="duotone" className="text-[var(--p-color-brand-500)]" />}
                  title={expertLoadingTree ? "Carregando árvore técnica" : "Árvore técnica indisponível"}
                  description={
                    expertLoadingTree
                      ? "Estamos montando a estrutura completa por tipo, grupo e classe."
                      : "Não foi possível carregar a árvore completa do e-Fisco agora."
                  }
                  className="py-14"
                />
              )}

              {expertHasMore && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={() => loadExpertNodeItems(expertSelectedNodeKey, expertOffset, true)}
                    disabled={expertLoadingItems}
                    className="px-8 py-3 rounded-full bg-white border border-[var(--p-color-border)] font-display font-semibold text-xs tracking-widest text-[var(--p-color-brand-400)] hover:bg-[var(--p-color-brand-400)] hover:text-white transition-all shadow-sm"
                  >
                    {expertLoadingItems ? "CARREGANDO RECORTE..." : "CARREGAR MAIS DO NÓ"}
                  </button>
                </div>
              )}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start [grid-auto-flow:dense]">
                {visibleProducts.map((product, idx) => {
                  const productSelectionKey = buildProductSelectionKey(product);
                  return (
                    <ProductCard
                      key={`${product.id}-${product.siad}`}
                      product={{ ...product, searchPosition: idx }}
                      index={idx % 30}
                      userRole={userRole}
                      inCart={Boolean(
                        productSelectionKey && cartSelectionSet.has(productSelectionKey),
                      )}
                      isFavorite={favoriteIds.has(Number(product.id))}
                      favoritePending={favoriteSavingId === Number(product.id)}
                      onAdd={handleAddProduct}
                      canAdd={canCreate}
                      onToggleFavorite={toggleFavorite}
                    />
                  );
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={() => {
                      if (loading || loadingMore || !hasMore) return;
                      setPage((currentPage) => currentPage + 1);
                    }}
                    disabled={loading || loadingMore}
                    aria-busy={loadingMore}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--p-color-border)] bg-white px-8 text-xs font-bold uppercase tracking-wider text-[var(--p-color-brand-500)] shadow-sm transition-all hover:border-[var(--p-color-brand-400)] hover:bg-[var(--p-color-info-bg)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadingMore ? "CARREGANDO MAIS..." : "CARREGAR MAIS ITENS"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <OperationalEmptyState
              icon={
                <img
                  src="/guidance/catalog-no-results.png"
                  alt=""
                  className="aspect-[16/9] w-36 object-contain"
                />
              }
              title={products.length > 0 ? "Nenhum resultado para os filtros ativos" : "Nenhum resultado relevante"}
              description="Tente buscar por código e-Fisco exato, ajustar tipo de despesa, classe do item ou marcar itens recorrentes como favoritos para acesso rápido."
              className="py-14"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Floating Checkout */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[min(1120px,calc(100%-32px))]"
        >
          <div className="rounded-[28px] border border-[var(--p-color-border)] bg-white/95 p-4 shadow-2xl shadow-[var(--p-color-brand-500)]/18 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <button
                type="button"
                onClick={() => setCartSidebarOpen(true)}
                className="flex min-w-0 items-center gap-4 text-left"
                aria-label="Abrir resumo da seleção"
              >
                <motion.div
                  ref={cartIconRef}
                  key={cartShakeKey}
                  initial={{ rotate: 0, scale: 1 }}
                  animate={{
                    rotate: [0, -10, 8, -5, 3, 0],
                    scale: [1, 1.12, 1],
                  }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                  className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]"
                >
                  <Queue size={30} weight="bold" />
                  <span className="absolute -right-2 -top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--p-color-collab)] px-2 text-xs font-bold text-white shadow-lg">
                    {items.length}
                  </span>
                </motion.div>
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-[var(--p-color-brand-700)]">
                    {items.length} {items.length === 1 ? "item selecionado" : "itens selecionados"}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--p-color-fg-muted)]">
                    Revise os itens antes de continuar para a DFD.
                  </p>
                </div>
              </button>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCartSidebarOpen(true)}
                  className="h-12 rounded-2xl px-5 text-sm font-semibold text-[var(--p-color-action)] transition-colors hover:bg-[var(--p-color-info-bg)]"
                >
                  Revisar seleção
                </button>
                <button
                  type="button"
                  onClick={clearCarrinho}
                  className="h-12 rounded-2xl px-5 text-sm font-semibold text-[var(--p-color-danger)] transition-colors hover:bg-[var(--p-color-danger-bg)]"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={handleProceedToDfd}
                  className="flex h-12 items-center justify-center gap-3 rounded-2xl bg-[var(--p-color-action)] px-6 text-sm font-bold text-white shadow-[var(--p-shadow-action)] transition-all hover:bg-[var(--p-color-action-hover)] active:scale-[0.98]"
                >
                  Continuar para DFD
                  <ArrowRight size={18} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {flyingParticles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              opacity: 0,
              scale: 0.45,
              x: particle.startX,
              y: particle.startY,
            }}
            animate={{
              opacity: [0, 0.9, 0],
              scale: [0.45, 1, 0.2],
              x: [particle.startX, particle.midX, particle.endX],
              y: [particle.startY, particle.midY, particle.endY],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: particle.duration,
              delay: particle.delay,
              ease: "easeInOut",
            }}
            onAnimationComplete={() =>
              setFlyingParticles((prev) => prev.filter((p) => p.id !== particle.id))
            }
            className="fixed top-0 left-0 z-[74] pointer-events-none rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              boxShadow: `0 0 10px ${particle.color}`,
            }}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {flyingChip && (
          <motion.div
            key={flyingChip.id}
            initial={{
              opacity: 0.95,
              scale: 1,
              x: flyingChip.startX,
              y: flyingChip.startY,
            }}
            animate={{
              opacity: [0.95, 0.9, 0],
              scale: [1, 0.95, 0.55],
              x: flyingChip.endX,
              y: flyingChip.endY,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.72, ease: "easeInOut" }}
            onAnimationComplete={() =>
              setFlyingChip((current) =>
                current?.id === flyingChip.id ? null : current,
              )
            }
            className="fixed top-0 left-0 z-[75] pointer-events-none"
          >
              <motion.div
                initial={{ opacity: 0.5, scaleX: 1 }}
                animate={{ opacity: [0.55, 0.25, 0], scaleX: [1, 1.3, 1.5] }}
                transition={{ duration: 0.68, ease: "easeOut" }}
                className="absolute -left-10 top-1/2 -translate-y-1/2 w-11 h-1 rounded-full bg-gradient-to-r from-[var(--p-color-brand-400)]/80 to-transparent blur-[1px]"
              />
            <div className="px-2.5 py-1 rounded-lg bg-[var(--p-color-brand-400)] text-white type-kicker font-semibold uppercase tracking-widest shadow-xl">
              + {flyingChip.label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartSidebarOpen(false)}
              className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]"
            />

            <motion.aside
              initial={{ opacity: 0, x: 520, y: 28 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 520, y: 28 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-[80] max-h-[92dvh] w-full overflow-y-auto rounded-t-[24px] border border-black/10 bg-white shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:h-screen md:max-h-none md:max-w-[460px] md:rounded-none md:border-l"
            >
              <div className="flex min-h-[72px] items-center justify-between border-b border-black/5 px-4 py-3 md:min-h-[92px] md:px-6">
                <div>
                  <p className="type-kicker uppercase tracking-[0.2em] text-black/35 font-semibold">
                    Resumo para envio
                  </p>
                  <h3 className="font-display text-xl font-semibold text-[var(--p-color-brand-500)] uppercase tracking-tight md:text-2xl">
                    Seleção da DFD
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCartSidebarOpen(false)}
                  aria-label="Fechar carrinho"
                  className="w-10 h-10 rounded-xl bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-400)] flex items-center justify-center hover:bg-[var(--p-color-info-border)]"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="space-y-2 border-b border-black/5 bg-[var(--p-color-bg-muted)] p-3 md:p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--p-color-border)] bg-white px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]">
                      <Package size={17} weight="duotone" />
                    </span>
                    <div>
                      <p className="type-kicker uppercase tracking-widest text-black/35 font-semibold">Itens</p>
                      <p className="text-sm font-semibold text-[var(--p-color-brand-500)]">{items.length} selecionado(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-[var(--p-color-border)] bg-white px-3 py-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]">
                      <span className="text-base font-semibold">$</span>
                    </span>
                    <div className="min-w-0">
                      <p className="type-kicker uppercase tracking-widest text-black/35 font-semibold">Total estimado</p>
                      <p className="truncate text-sm font-semibold text-[var(--p-color-brand-500)]">
                      {items
                        .reduce(
                          (acc, item) =>
                            acc +
                            Number(item.quantidade || 0) *
                              Number(item.valor_unitario_estimado || 0),
                          0,
                        )
                        .toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                    </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--p-color-success-border)] bg-white px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle size={18} weight="fill" className="shrink-0 text-[var(--p-color-success)]" />
                    <div>
                      <p className="type-caption font-semibold text-[var(--p-color-success)]">
                        {cartBlockingSummary.canProceed ? "Pronto para seguir" : "Em preenchimento"}
                      </p>
                      <p className="text-[11px] leading-4 text-[var(--p-color-fg-muted)]">
                        {cartBlockingSummary.canProceed ? "Todos os itens estão completos." : "Revise os campos obrigatórios dos itens."}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--p-color-warning-bg)] px-2 py-1 type-micro font-semibold text-[var(--p-color-warning)]">
                    {cartBlockingSummary.invalidItems} pendência(s)
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-3 md:p-4">
                <div className="flex items-center justify-between px-1">
                  <p className="type-caption font-semibold text-[var(--p-color-brand-500)]">Itens selecionados ({items.length})</p>
                  <button
                    type="button"
                    onClick={() => setExpandedCartItemUid(items[0]?.uid || null)}
                    className="type-micro font-semibold text-[var(--p-color-brand-500)] hover:underline"
                  >
                    Abrir item
                  </button>
                </div>
                {items.map((entry, index) => {
                  const validation = getCartItemValidation(entry);
                  const expenseInfo = getExpenseClassUserSummary(
                    classifyGnd(
                      entry.item_efisco?.gnd || entry.item_efisco?.codigo_natureza_despesa,
                    )?.expenseClass,
                    entry.item_efisco?.tipo_objeto,
                  );
                  const isExpanded = expandedCartItemUid === entry.uid;

                  return (
                    <div
                      key={entry.uid}
                      className={cn(
                        "overflow-hidden rounded-xl border",
                        validation.ready
                          ? "border-[var(--p-color-border)] bg-white"
                          : "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)]",
                      )}
                    >
                      <div className="flex items-start gap-2 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedCartItemUid(isExpanded ? null : entry.uid)}
                          aria-label={`${isExpanded ? "Recolher" : "Expandir"} item ${entry.item_efisco.codigo_tce}`}
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--p-color-brand-500)] hover:bg-white/80"
                        >
                          <CaretDown size={15} weight="bold" className={cn("transition-transform", !isExpanded && "-rotate-90")} />
                        </button>
                        <div className="min-w-0">
                          <p className="line-clamp-1 type-kicker font-semibold text-[var(--p-color-brand-500)]">
                            {entry.item_efisco.codigo_tce} <span className="font-normal text-[var(--p-color-fg-muted)]">· {entry.item_efisco.descricao}</span>
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-[var(--p-color-fg-muted)]">
                            {validation.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Quantidade: {entry.quantidade}
                          </p>
                        </div>
                        <div className="ml-auto flex shrink-0 items-center gap-1.5">
                          <span className={cn("rounded-full px-2 py-1 type-micro font-semibold", validation.ready ? "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]" : "bg-white/80 text-[var(--p-color-warning)]")}>
                            {validation.ready ? "Completo" : "Pendente"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeItem(entry.uid)}
                            aria-label={`Remover ${entry.item_efisco.descricao} do carrinho`}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--p-color-danger)] hover:bg-[var(--p-color-danger-bg)]"
                          >
                            <Trash size={14} weight="bold" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-black/5 bg-white px-3 pb-3 pt-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-1 type-micro font-semibold uppercase tracking-widest",
                            validation.ready
                              ? "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]"
                              : "border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] text-[var(--p-color-warning)]",
                          )}
                        >
                          <WarningCircle size={12} weight="fill" />
                          {validation.ready ? "Pronto para seguir" : `Pendente: ${validation.issues.join(", ")}`}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-1 type-micro font-semibold uppercase tracking-widest",
                            expenseInfo.badgeClassName,
                          )}
                        >
                          {expenseInfo.label}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-black/5 bg-white/85 px-3 py-2">
                          <p className="type-kicker uppercase tracking-widest text-black/35 font-semibold">
                            Qtd
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--p-color-brand-500)]">
                            {entry.quantidade} {entry.item_efisco.unidade_medida || "UN"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-black/5 bg-white/85 px-3 py-2">
                          <p className="type-kicker uppercase tracking-widest text-black/35 font-semibold">
                            Subtotal
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[var(--p-color-brand-500)]">
                            {validation.subtotal.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </p>
                        </div>
                      </div>

                      <p className="mt-2 text-xs font-medium leading-5 text-[var(--p-color-fg-muted)]">
                        Preencha os dados abaixo para liberar o envio da DFD.
                      </p>

                        <div className="mt-3 border-t border-black/5 pt-3">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <label className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                              Unidade de medida
                              <select
                                value={String(entry.item_efisco.unidade_medida || "UN").toUpperCase()}
                                onChange={(event) =>
                                  updateItem(index, {
                                    item_efisco: {
                                      ...entry.item_efisco,
                                      unidade_medida: event.target.value,
                                    },
                                  })
                                }
                                className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-fg-strong)] outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                              >
                                {catalogMeasurementUnits.map((unit) => (
                                  <option key={unit} value={unit}>
                                    {getCatalogMeasurementUnitLabel(unit)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                              Quantidade
                              <input
                                type="number"
                                min={1}
                                value={entry.quantidade}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value);
                                  if (!Number.isFinite(nextValue)) return;
                                  updateItem(index, {
                                    quantidade: Math.max(1, Math.trunc(nextValue)),
                                  });
                                }}
                                className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-fg-strong)] outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                              />
                            </label>
                            <label className="type-kicker font-semibold uppercase tracking-widest text-black/35">
                              Valor unitário (R$)
                              <input
                                type="number"
                                min={0.01}
                                step="0.01"
                                value={entry.valor_unitario_estimado || ""}
                                onChange={(event) => {
                                  const nextValue = Number(event.target.value);
                                  updateItem(index, {
                                    valor_unitario_estimado:
                                      Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0,
                                  });
                                }}
                                className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-fg-strong)] outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                              />
                            </label>
                            <label className="type-kicker font-semibold uppercase tracking-widest text-black/35 sm:col-span-2">
                              Link de referência de preço
                              <input
                                type="url"
                                value={entry.link_referencia || ""}
                                onChange={(event) => updateItem(index, { link_referencia: event.target.value })}
                                placeholder="https://..."
                                className="mt-1 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--p-color-fg-strong)] outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                              />
                            </label>
                            <label className="type-kicker font-semibold uppercase tracking-widest text-black/35 sm:col-span-2">
                              Justificativa do item
                              <textarea
                                rows={3}
                                value={entry.justificativa_item || ""}
                                onChange={(event) => updateItem(index, { justificativa_item: event.target.value })}
                                placeholder="Explique a necessidade deste item."
                                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[var(--p-color-fg-strong)] outline-none focus:ring-2 focus:ring-[var(--p-color-brand-400)]/20"
                              />
                            </label>
                          </div>
                          <p className="mt-3 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-muted)] px-3 py-3 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                            Subtotal calculado: {validation.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. O total é calculado automaticamente pela quantidade e pelo valor unitário.
                          </p>
                        </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3 border-t border-black/5 bg-white p-3 md:p-6">
                {cartBlockingSummary.invalidItems > 0 ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-[var(--p-color-warning-border)] bg-[var(--p-color-warning-bg)] px-3 py-3 text-[var(--p-color-warning)] sm:flex-row sm:items-center sm:justify-between">
                    <p className="type-caption">
                      {cartBlockingSummary.invalidItems} item(ns) com pendências obrigatórias.
                    </p>
                    {cartExpenseSummary.firstPendingUid ? (
                      <button
                        type="button"
                        onClick={() => setExpandedCartItemUid(cartExpenseSummary.firstPendingUid)}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--p-color-warning-border)] bg-white px-3 type-kicker font-semibold uppercase tracking-widest text-[var(--p-color-warning)]"
                      >
                        Abrir pendência
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] px-3 py-2 type-caption text-[var(--p-color-success)]">
                    Campos obrigatórios preenchidos. Fluxo liberado para Nova DFD.
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={saveCartAsDraft}
                    disabled={catalogDraft.status === "saving" || items.length === 0}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--p-color-brand-400)]/30 bg-white px-4 text-xs font-semibold uppercase tracking-widest text-[var(--p-color-brand-500)] transition hover:bg-[var(--p-color-info-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Stack size={16} weight="bold" />
                    {catalogDraft.status === "saving" ? "Salvando..." : "Salvar rascunho"}
                  </button>
                  <Button
                    onClick={() => {
                      if (!cartBlockingSummary.canProceed) {
                        toast.error(
                          `Preencha os campos obrigatórios antes de continuar. ${cartBlockingSummary.reasons.join(" | ")}`,
                        );
                        return;
                      }
                      setDestinationDialogOpen(true);
                    }}
                    className="h-12 rounded-2xl bg-[var(--p-color-brand-500)] hover:bg-[var(--p-color-action-hover)] text-white font-semibold uppercase tracking-widest text-xs"
                  >
                    Escolher destino
                    <ArrowRight size={16} className="ml-2" weight="bold" />
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpertCatalogView({
  products,
  taxonomy,
  selectedNodeKey,
  selectedProduct,
  cartSelectionSet,
  loadingItems,
  loadingNodeKeys,
  totalItems,
  onSelectNode,
  onLoadChildren,
  onSelectProduct,
  onAdd,
  canAdd,
}: {
  products: any[];
  taxonomy: CatalogExpertNode;
  selectedNodeKey: string;
  selectedProduct: any | null;
  cartSelectionSet: Set<string>;
  loadingItems: boolean;
  loadingNodeKeys: Set<string>;
  totalItems: number;
  onSelectNode: (nodeKey: string) => void;
  onLoadChildren: (nodeKey: string) => void;
  onSelectProduct: (product: any) => void;
  canAdd: boolean;
  onAdd: (product: any, sourceEl?: HTMLElement | null) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [treeSearch, setTreeSearch] = useState("");
  const rows = useMemo(
    () =>
      products.map((product, index) => ({
        product: { ...product, searchPosition: index },
        summary: summarizeCatalogExpertItem(product),
      })),
    [products],
  );
  const selectedRow =
    rows.find((row) => selectedProduct && String(row.product.id) === String(selectedProduct.id)) ||
    rows[0] ||
    null;
  const selectedDepth = getCatalogExpertNodeDepth(selectedNodeKey);
  const selectedSummary = selectedRow?.summary || null;
  const selectedSelectionKey = selectedRow
    ? buildProductSelectionKey(selectedRow.product)
    : null;
  const selectedInCart = Boolean(
    selectedSelectionKey && cartSelectionSet.has(selectedSelectionKey),
  );
  const visibleTaxonomy = useMemo(
    () => filterCatalogExpertTree(taxonomy, treeSearch) || { ...taxonomy, children: [] },
    [taxonomy, treeSearch],
  );
  const selectedPath = useMemo(
    () => findCatalogExpertNodePath(taxonomy, selectedNodeKey).filter((node) => node.key !== "base"),
    [selectedNodeKey, taxonomy],
  );
  const selectedTitle = selectedPath.at(-1)?.label || "Selecione uma classe";
  const selectedGroupNode = selectedPath.find(
    (node) => getCatalogExpertNodeDepth(node.key) === "group",
  );

  const renderTaxonomyNode = (node: CatalogExpertNode, depth = 0) => {
    const selected = selectedNodeKey === node.key;
    const nodeDepth = getCatalogExpertNodeDepth(node.key);
    const hasChildren = node.children.length > 0 || Boolean(node.hasMoreChildren);
    const loadingChildren = loadingNodeKeys.has(node.key);
    const openByDefault = depth <= 1 || selected || products.length === node.count;

    if (!hasChildren) {
      return (
        <button
          key={node.key}
          type="button"
          onClick={() => onSelectNode(node.key)}
          className={cn(
            "grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-xs transition-colors",
            selected
              ? "bg-[var(--p-color-brand-500)] font-bold text-white shadow-sm"
              : "text-[var(--p-color-fg-default)] hover:bg-[var(--p-color-surface-muted)]",
          )}
          style={{ paddingLeft: `${10 + Math.min(depth * 8, 28)}px` }}
        >
          <span className="h-px w-px" />
          <span className="flex min-w-0 items-center gap-2 whitespace-normal break-words leading-snug [overflow-wrap:anywhere]">
            {nodeDepth === "group" && (
              <CatalogGroupSymbolBadge nodeKey={node.key} label={node.label} compact />
            )}
            {node.label}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 type-kicker font-bold ring-1 ring-black/5",
              selected ? "bg-white/15 text-white" : "bg-white text-[var(--p-color-brand-400)]",
            )}
          >
            {node.count}
          </span>
        </button>
      );
    }

    return (
      <details key={node.key} open={openByDefault} className="group space-y-1">
        <summary
          className={cn(
            "grid cursor-pointer list-none grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2.5 py-2.5 text-xs transition-colors marker:hidden [&::-webkit-details-marker]:hidden",
            selected
              ? "bg-[var(--p-color-brand-500)] font-bold text-white shadow-sm"
              : depth === 0
                ? "bg-[var(--p-color-info-bg)] font-bold text-[var(--p-color-brand-500)]"
                : "text-[var(--p-color-fg-default)] hover:bg-[var(--p-color-surface-muted)]",
          )}
          style={{ paddingLeft: `${10 + Math.min(depth * 8, 28)}px` }}
          onClick={(event) => {
            event.preventDefault();
            const details = event.currentTarget.parentElement as HTMLDetailsElement | null;
            if (details) details.open = !details.open;
            onSelectNode(node.key);
            if (node.hasMoreChildren && node.children.length === 0) {
              onLoadChildren(node.key);
            }
          }}
        >
          <CaretRight
            size={12}
            weight="bold"
            className="shrink-0 transition-transform group-open:rotate-90"
          />
          <span className="flex min-w-0 items-center gap-2 whitespace-normal break-words leading-snug [overflow-wrap:anywhere]">
            {nodeDepth === "group" && (
              <CatalogGroupSymbolBadge nodeKey={node.key} label={node.label} compact />
            )}
            {node.label}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 type-kicker font-bold ring-1 ring-black/5",
              selected ? "bg-white/15 text-white" : "bg-white text-[var(--p-color-brand-400)]",
            )}
          >
            {node.count}
          </span>
        </summary>
        <div className="space-y-1">
          {node.children.map((child) => renderTaxonomyNode(child, depth + 1))}
          {loadingChildren && (
            <div
              className="rounded-xl px-2.5 py-2 text-xs font-semibold text-[var(--p-color-fg-muted)]"
              style={{ paddingLeft: `${10 + Math.min((depth + 1) * 8, 28)}px` }}
            >
              Carregando...
            </div>
          )}
        </div>
      </details>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]"
    >
      <section className="min-h-[640px] rounded-[24px] border border-[var(--p-color-border)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="type-kicker font-bold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
              Estrutura E-Fisco
            </p>
            <h3 className="mt-1 font-display text-lg font-bold text-[var(--p-color-brand-700)]">
              Árvore técnica
            </h3>
          </div>
          <span className="rounded-full border border-[var(--p-color-border)] px-2.5 py-1 type-kicker font-bold text-[var(--p-color-fg-muted)]">
            {taxonomy.count}
          </span>
        </div>
        <label className="mb-3 flex h-11 items-center gap-2 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 text-xs font-semibold text-[var(--p-color-fg-muted)]">
          <MagnifyingGlass size={16} weight="bold" className="shrink-0 text-[var(--p-color-brand-400)]" />
          <input
            value={treeSearch}
            onChange={(event) => setTreeSearch(event.target.value)}
            placeholder="Buscar na árvore técnica"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--p-color-fg-subtle)]"
            aria-label="Buscar na árvore técnica"
          />
          <span className="hidden rounded-lg bg-white px-2 py-1 type-kicker font-bold text-[var(--p-color-fg-muted)] sm:inline">
            Ctrl K
          </span>
        </label>
        <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-info-bg)] px-3 py-2 type-kicker font-bold text-[var(--p-color-brand-500)]">
          <span>Base</span>
          {selectedPath.map((node) => (
            <React.Fragment key={node.key}>
              <CaretRight size={10} weight="bold" className="text-[var(--p-color-fg-muted)]" />
              <span className="max-w-[220px] truncate">{node.label}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="max-h-[505px] overflow-y-auto pr-1">
          {visibleTaxonomy.children.length > 0 || !treeSearch ? (
            renderTaxonomyNode(visibleTaxonomy)
          ) : (
            <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-4 text-sm font-semibold text-[var(--p-color-fg-muted)]">
              Nenhum ramo carregado corresponde à busca.
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-[24px] border border-[var(--p-color-border)] bg-white shadow-sm">
        <div className="border-b border-[var(--p-color-border)] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="type-kicker font-bold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
                Itens do nó selecionado
              </p>
              <h3 className="mt-1 flex items-center gap-2 font-display text-lg font-bold leading-snug text-[var(--p-color-brand-700)]">
                {selectedGroupNode && (
                  <CatalogGroupSymbolBadge
                    nodeKey={selectedGroupNode.key}
                    label={selectedGroupNode.label}
                  />
                )}
                <span className="min-w-0 text-[var(--p-color-brand-500)]">{selectedTitle}</span>
                <span className="font-sans text-sm font-semibold text-[var(--p-color-fg-muted)]">
                  {" "}· {totalItems} itens encontrados
                </span>
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Código", "Descrição", "Tipo de despesa", "Classe"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 py-1 type-kicker font-bold uppercase tracking-widest text-[var(--p-color-fg-muted)]"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[112px_minmax(260px,1fr)_120px_76px] gap-3 border-b border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-4 py-3 type-kicker font-bold uppercase tracking-widest text-[var(--p-color-fg-muted)]">
              <span>Código</span>
              <span>Descrição resumida</span>
              <span>Tipo</span>
              <span>Ações</span>
            </div>
            <div className="divide-y divide-[var(--p-color-border)]">
              {loadingItems && rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm font-semibold text-[var(--p-color-fg-muted)]">
                  Carregando itens deste nó...
                </div>
              ) : rows.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm font-semibold text-[var(--p-color-fg-muted)]">
                  {selectedDepth === "class"
                    ? "Nenhum item visível com os filtros pessoais ativos."
                    : "Abra grupo e classe. Os itens aparecem quando uma classe for selecionada."}
                </div>
              ) : rows.map(({ product, summary }) => {
                const selectionKey = buildProductSelectionKey(product);
                const inCart = Boolean(selectionKey && cartSelectionSet.has(selectionKey));
                const isSelected =
                  selectedRow && String(selectedRow.product.id) === String(product.id);

                return (
                  <button
                    type="button"
                    key={`${product.id}-${product.siad}`}
                    onClick={() => {
                      onSelectProduct(product);
                      setDrawerOpen(true);
                    }}
                    className={cn(
                      "grid w-full grid-cols-[112px_minmax(260px,1fr)_120px_76px] gap-3 px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "bg-[var(--p-color-info-bg)] shadow-[var(--p-shadow-selection-collab)]"
                        : "bg-white hover:bg-[var(--p-color-surface-soft)]",
                    )}
                  >
                    <span className="pt-0.5 font-mono text-sm font-bold text-[var(--p-color-brand-500)]">
                      {summary.code}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-sm font-bold text-[var(--p-color-brand-700)]">
                        {summary.term}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-xs font-medium leading-relaxed text-[var(--p-color-fg-muted)]">
                        {summary.details || "Sem descrição complementar."}
                      </span>
                    </span>
                    <span className="pt-0.5 text-xs font-bold text-[var(--p-color-fg-default)]">
                      {getExpenseClassText(product.gnd || product.gnd_derivado)}
                    </span>
                    <span className="flex items-start justify-end gap-2">
                      <span
                        className={cn(
                          "inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 type-kicker font-bold",
                          inCart
                            ? "border-[var(--p-color-collab)]/30 bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]"
                            : "border-[var(--p-color-border)] bg-white text-[var(--p-color-action)]",
                        )}
                      >
                        {inCart ? <Check size={13} weight="bold" /> : <ArrowRight size={14} weight="bold" />}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {drawerOpen && selectedSummary && selectedRow && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[68] bg-[var(--p-color-scrim-soft)] backdrop-blur-[2px]"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: 560 }}
              animate={{ x: 0 }}
              exit={{ x: 560 }}
              transition={{ type: "spring", damping: 30, stiffness: 280 }}
              className="fixed right-0 top-0 z-[69] flex h-screen w-full max-w-[640px] flex-col border-l border-[var(--p-color-border)] bg-white shadow-2xl"
            >
              <div className="flex h-[86px] items-center justify-between border-b border-[var(--p-color-border)] px-6">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-[var(--p-color-brand-500)]">
                    {selectedSummary.code}
                  </p>
                  <h3 className="truncate font-display text-xl font-bold text-[var(--p-color-brand-700)]">
                    Ficha completa do item
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--p-color-surface-muted)] text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-surface-subtle)]"
                  aria-label="Fechar ficha completa"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-6">
                <section className="space-y-3">
                  <p className="type-kicker font-bold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
                    Resumo
                  </p>
                  <h4 className="font-display text-2xl font-bold leading-tight text-[var(--p-color-brand-700)]">
                    {selectedSummary.term}
                  </h4>
                  <p className="text-sm font-medium leading-relaxed text-[var(--p-color-fg-default)]">
                    {selectedSummary.details || selectedSummary.fullDescription}
                  </p>
                  <div className="rounded-2xl border border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] p-3 text-sm font-semibold text-[var(--p-color-success)]">
                    Classificações preservadas para a DFD.
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="type-kicker font-bold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
                    Atributos
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      ["Código e-Fisco", selectedSummary.code],
                      ["Tipo", selectedSummary.typeLabel],
                      ["Tipo de despesa", getExpenseClassText(selectedRow.product.gnd || selectedRow.product.gnd_derivado)],
                      ["Grupo", selectedSummary.groupLabel],
                      ["Classe", selectedSummary.classLabel],
                      [
                        "Naturezas",
                        selectedSummary.hasMixedExpenseClasses
                          ? "Múltiplas classificações"
                          : selectedSummary.needsNaturezaChoice
                            ? "Escolha obrigatória"
                            : "Sem alerta",
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-[var(--p-color-border)] p-4">
                        <p className="type-kicker font-bold uppercase tracking-widest text-[var(--p-color-fg-muted)]">
                          {label}
                        </p>
                        <p className="mt-2 text-sm font-bold text-[var(--p-color-brand-500)]">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <p className="type-kicker font-bold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
                    Descrição oficial
                  </p>
                  <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-4">
                    <p className="whitespace-pre-wrap break-words text-sm font-medium leading-7 text-[var(--p-color-fg-strong)] [overflow-wrap:anywhere]">
                      {selectedSummary.fullDescription}
                    </p>
                  </div>
                </section>

                <section className="space-y-3 pb-3">
                  <p className="type-kicker font-bold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
                    DFD
                  </p>
                  <div className="rounded-2xl border border-[var(--p-color-border)] p-4">
                    <p className="text-sm font-medium leading-relaxed text-[var(--p-color-fg-default)]">
                      Ao adicionar, o item mantém código e-Fisco, classificação, grupo, classe e
                      sinalizadores de natureza para revisão da chefia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => onAdd(selectedRow.product, event.currentTarget)}
                    disabled={selectedInCart || !canAdd}
                    className={cn(
                      "h-12 w-full rounded-2xl text-sm font-bold",
                      selectedInCart
                        ? "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]"
                        : "bg-[var(--p-color-action)] text-white hover:bg-[var(--p-color-action-hover)]",
                    )}
                  >
                    {!canAdd ? "Prazo encerrado" : selectedInCart ? "Item já selecionado" : "Adicionar à seleção"}
                  </button>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProductCard({
  product,
  index,
  userRole,
  inCart,
  isFavorite,
  favoritePending,
  onAdd,
  canAdd,
  onToggleFavorite,
}: {
  product: any;
  index: number;
  userRole: UserRole;
  inCart: boolean;
  isFavorite: boolean;
  favoritePending: boolean;
  canAdd: boolean;
  onAdd: (product: any, sourceEl?: HTMLElement | null) => void;
  onToggleFavorite: (product: any) => void;
}) {
  const fullDescription = String(product.name || "Descrição não informada")
    .replace(/\s+/g, " ")
    .trim();
  const parsedDescription = parseCatalogDescription(fullDescription);
  const displayTerm = formatCatalogDisplayText(parsedDescription.term);
  const displayDetails = formatCatalogDisplayText(parsedDescription.details);
  const visual = getCatalogCategoryVisual(product);
  const CategoryIcon = visual.Icon;
  const displayedDescription =
    displayDetails || compactDescription(fullDescription, 168);
  const expenseBadge = getCatalogExpenseBadge(
    product.gnd || product.gnd_derivado || product.codigo_natureza_despesa,
    product,
  );
  const directClassification = classifyGnd(
    product.gnd || product.gnd_derivado || product.codigo_natureza_despesa,
  );
  const directExpenseEntry: CatalogExpenseStackEntry | null = directClassification
    ? {
        key: directClassification.gnd,
        label:
          directClassification.expenseClass === "investimento"
            ? "Capital"
            : directClassification.expenseClass === "custeio"
              ? "Corrente"
              : "Outra",
        detail: directClassification.elementLabel,
        className: expenseBadge.className,
        expenseClass: directClassification.expenseClass || "outra",
      }
    : null;
  const catalogExpenseStack = getCatalogExpenseStack(product);
  const expenseStack =
    catalogExpenseStack.length > 0
      ? catalogExpenseStack
      : directExpenseEntry
        ? [directExpenseEntry]
        : [];
  const requiresFiscalChoice =
    product.has_mixed_expense_classes || Number(product.natureza_count || 0) > 1;
  const usageOptions = buildUsageDecisionOptions(product, expenseStack);
  const canUseSimpleFiscalChoice = userRole === "solicitante" || userRole === "chefia";
  const hasFiscalChoices =
    canUseSimpleFiscalChoice && requiresFiscalChoice && usageOptions.length > 1;
  const useCount = Math.max(
    getCatalogUseCount(product, expenseStack),
    usageOptions.length,
  );
  const hasMultipleUses = hasFiscalChoices;
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [selectedUsageKey, setSelectedUsageKey] = useState(
    usageOptions[0]?.key || "corrente",
  );
  const selectedUsage =
    usageOptions.find((option) => option.key === selectedUsageKey) ||
    usageOptions[0] ||
    null;
  const selectedUsageSummary = getExpenseClassUserSummary(
    selectedUsage?.expenseClass,
    product.tipo_objeto || product.category,
  );
  const selectedUsageIsCapital = selectedUsage?.expenseClass === "investimento";
  const recommendationLabel = selectedUsage
    ? selectedUsageIsCapital
      ? "Capital"
      : "Corrente"
    : expenseBadge.label;
  const typeLabel =
    normalizeTipoObjeto(product.tipo_objeto || product.category) === "servico"
      ? "Serviço"
      : "Material";
  const codeLabel =
    product.efiscoCode || product.siadLabel || product.codigo_efisco || product.codigo_tce || product.siad || "sem código";
  const primaryClosedLabel = "Comparar";
  const openUsageChoices = () => setIsUsageOpen(true);
  const primaryOpenLabel = "Escolher este uso";
  const chooseSelectedUsage = (sourceEl: HTMLElement | null) => {
    if (!selectedUsage) return;
    onAdd({
      ...product,
      selected_expense_class: selectedUsage.expenseClass,
    }, sourceEl);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.01 }}
      className="break-inside-avoid relative min-w-0 pb-2"
    >
      <CatalogCardStackLayers visual={visual} count={useCount} expanded={isUsageOpen} />

      <motion.div
        layout
            className={cn(
              "group relative z-10 min-w-0 overflow-hidden rounded-[24px] border bg-[#FFFDF9] shadow-[0_14px_34px_rgba(15,35,70,0.08)] transition-all",
              visual.borderClassName,
              visual.hoverClassName,
              inCart && "border-[var(--p-color-brand-400)] shadow-[0_18px_38px_rgba(0,79,190,0.12)]",
              isUsageOpen && "border-[var(--p-color-brand-500)] shadow-[0_18px_44px_rgba(0,61,150,0.14)]",
            )}
          >
            <div className={cn("absolute inset-x-0 top-0 h-16 bg-gradient-to-br", visual.topWashClassName)} />

            <div className="relative flex min-h-[318px] flex-col gap-3.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm", visual.iconClassName)}>
                  <CategoryIcon size={23} weight="duotone" />
                </div>
            <div className="flex items-center gap-2">
              {product.rank > 0.05 && (
                <span className="rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-2.5 py-1 type-micro font-bold uppercase tracking-wider text-[var(--p-color-brand-500)]">
                  Relevante
                </span>
              )}
              <button
                type="button"
                onClick={() => onToggleFavorite(product)}
                aria-label={
                  isFavorite
                    ? `Remover ${product.name} dos favoritos`
                    : `Marcar ${product.name} como favorito`
                }
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border bg-white/95 shadow-sm transition-colors",
                  isFavorite
                    ? "border-[#F2C94C] text-[#D28A00]"
                    : "border-[var(--p-color-border)] text-[var(--p-color-fg-muted)] hover:border-[#F2C94C] hover:text-[#D28A00]",
                )}
                disabled={favoritePending}
              >
                <Heart size={18} weight={isFavorite ? "fill" : "regular"} />
              </button>
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-2.5 py-1 text-[var(--p-color-brand-500)]">
              <Hash size={13} weight="bold" />
              <span className="font-mono text-xs font-bold tracking-tight">{codeLabel}</span>
            </span>

            <div className="space-y-2">
                  <h3
                    title={fullDescription}
                    className="line-clamp-2 font-display text-[16px] font-bold leading-snug tracking-tight text-[var(--p-color-brand-700)] group-hover:text-[var(--p-color-brand-500)]"
                  >
                    {displayTerm}
                  </h3>
                  <p className="line-clamp-2 min-h-[40px] text-sm font-medium leading-5 text-[var(--p-color-fg-muted)]">
                    {displayedDescription}
                  </p>
                  <CatalogDescriptionDialog title={displayTerm} description={fullDescription} code={String(codeLabel)} />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-[var(--p-color-fg-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <Tag size={14} weight="duotone" />
                {typeLabel}
              </span>
              <span className="h-1 w-1 rounded-full bg-[var(--p-color-border-strong)]" />
              <span className="line-clamp-1">{product.classe || product.category || "Sem classe"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--p-color-border)] pt-3">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                selectedUsageIsCapital
                  ? "border-[var(--p-color-insight-border)] bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]"
                  : "border-[var(--p-color-success-border)] bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
              )}
            >
              <CheckCircle size={14} weight="fill" />
              Recomendado: {recommendationLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--p-color-brand-500)]">
              <Stack size={14} weight="duotone" />
              {useCount} {useCount === 1 ? "uso" : "usos"}
            </span>
            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold", visual.chipClassName)}>
              {visual.label}
            </span>
          </div>

          <AnimatePresence initial={false}>
            {isUsageOpen && hasFiscalChoices && selectedUsage ? (
              <motion.div
                key="usage-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                    <div className="space-y-3 border-t border-[var(--p-color-border)] pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-display text-base font-bold text-[var(--p-color-brand-700)]">
                      Como este item será utilizado?
                    </h4>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--p-color-info-border)] bg-white px-3 py-1 text-xs font-bold text-[var(--p-color-brand-500)]">
                      <Stack size={15} weight="duotone" />
                          {usageOptions.length} possibilidades
                        </span>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                    {usageOptions.map((option) => {
                      const OptionIcon = option.Icon;
                      const active = option.key === selectedUsage.key;
                      const isCapital = option.expenseClass === "investimento";
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setSelectedUsageKey(option.key)}
                              aria-pressed={active}
                              className={cn(
                                "relative min-h-[82px] rounded-2xl border bg-white p-3 text-left transition-all",
                            active
                              ? "border-[var(--p-color-success)] bg-[var(--p-color-success-bg)]/55 shadow-sm"
                              : "border-[var(--p-color-border)] hover:border-[var(--p-color-brand-400)]/40 hover:bg-[var(--p-color-surface-soft)]",
                            isCapital && active && "border-[var(--p-color-insight)] bg-[var(--p-color-insight-bg)]/60",
                          )}
                        >
                          {active ? (
                            <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--p-color-success)] text-white shadow-md">
                              <Check size={15} weight="bold" />
                            </span>
                          ) : null}
                          <div className="flex items-start gap-3">
                            <span
                              className={cn(
                                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                isCapital
                                  ? "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]"
                                  : "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
                              )}
                            >
                              <OptionIcon size={20} weight="duotone" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold leading-tight text-[var(--p-color-brand-700)]">
                                {option.label}
                              </span>
                              <span className="mt-1 block text-[11px] font-medium leading-4 text-[var(--p-color-fg-muted)]">
                                {option.description}
                              </span>
                              <span
                                className={cn(
                                  "mt-2 inline-flex rounded-full px-2 py-0.5 type-micro font-bold uppercase tracking-wider",
                                  isCapital
                                    ? "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]"
                                    : "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
                                )}
                              >
                                {option.badge}
                              </span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                      <div className="rounded-2xl border border-[var(--p-color-border)] bg-white/80 p-3">
                        <div className="flex gap-3">
                      <span
                        className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                          selectedUsageIsCapital
                            ? "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]"
                            : "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
                        )}
                      >
                            <selectedUsage.Icon size={22} weight="duotone" />
                      </span>
                      <div className="min-w-0">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                            selectedUsageIsCapital
                              ? "bg-[var(--p-color-insight-bg)] text-[var(--p-color-insight)]"
                              : "bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]",
                          )}
                        >
                          Pode entrar como {selectedUsageIsCapital ? "capital" : "corrente"}
                        </span>
                            <h5 className="mt-2 font-display text-base font-bold leading-tight text-[var(--p-color-brand-700)]">
                              {selectedUsageIsCapital
                                ? "Indicado para implantação ou ampliação"
                                : "Indicado para rotina e manutenção"}
                            </h5>
                            <p className="mt-1.5 text-xs font-medium leading-5 text-[var(--p-color-fg-muted)]">
                              {selectedUsageIsCapital
                                ? "Use quando a contratação estiver ligada a implantação, melhoria estrutural ou entrega vinculada a investimento."
                                : "Use quando o serviço atender à rotina, manutenção, apoio operacional ou necessidade frequente do setor."}
                            </p>
                            <p className="mt-2 border-t border-[var(--p-color-border)] pt-2 text-xs font-medium text-[var(--p-color-fg-muted)]">
                          Detalhe técnico:{" "}
                          <strong className="text-[var(--p-color-brand-700)]">
                            {selectedUsage.entry?.detail || selectedUsageSummary.title}
                          </strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--p-color-border)] pt-3">
                {hasFiscalChoices ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isUsageOpen) {
                        setIsUsageOpen(false);
                        return;
                      }
                      openUsageChoices();
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl px-2 text-xs font-bold uppercase tracking-wider text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]"
                  >
                    {isUsageOpen ? "Cancelar" : "Ver usos"}
                    <CaretDown
                      size={14}
                      weight="bold"
                      className={cn("transition-transform", isUsageOpen && "rotate-180")}
                    />
                  </button>
                ) : (
                  <span className="inline-flex h-10 items-center rounded-xl px-2 text-xs font-bold uppercase tracking-wider text-[var(--p-color-fg-muted)]">
                    Uso direto
                  </span>
                )}

            <button
              type="button"
              onClick={(event) => {
                if (inCart) return;
                if (hasMultipleUses && !isUsageOpen) {
                  openUsageChoices();
                  return;
                }
                if (hasMultipleUses && isUsageOpen && selectedUsage) {
                  chooseSelectedUsage(event.currentTarget);
                  return;
                }
                onAdd(product, event.currentTarget);
              }}
              aria-label={
                inCart
                  ? `Item ${product.name} já está no carrinho`
                  : `Adicionar ${product.name} ao carrinho`
              }
              disabled={!canAdd}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95",
                inCart
                  ? "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]"
                  : isUsageOpen
                    ? "bg-[var(--p-color-brand-500)] text-white hover:bg-[var(--p-color-brand-700)]"
                    : "border border-[var(--p-color-border)] bg-white text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]",
              )}
            >
              {!canAdd ? "Prazo encerrado" : inCart ? (
                <>
                  <Check size={15} weight="bold" />
                  No carrinho
                </>
              ) : hasMultipleUses && !isUsageOpen ? (
                <>
                  <ArrowUpRight size={15} weight="bold" />
                  {primaryClosedLabel}
                </>
              ) : hasMultipleUses && isUsageOpen ? (
                <>
                  {primaryOpenLabel}
                  <ArrowRight size={15} weight="bold" />
                </>
              ) : (
                <>
                  <Plus size={15} weight="bold" />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
