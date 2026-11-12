"use client";
import { DfdCorrectionEditor } from "@/components/dfd/DfdCorrectionEditor";
import { collectiveContinueAction } from "@/lib/collective-continue-action";
import { correctionHistoryDetails } from "@/lib/dfd-correction-history";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ButtonHTMLAttributes,
  Dispatch,
  FormEvent,
  MouseEvent,
  ReactNode,
  RefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { recordCatalogSearchClick } from "@/lib/catalog-search-events";
import { ArrowLeft } from "@/components/icons/phosphor/exports/ArrowLeft";
import { ArrowRight } from "@/components/icons/phosphor/exports/ArrowRight";
import { Buildings } from "@/components/icons/phosphor/exports/Buildings";
import { CaretDown } from "@/components/icons/phosphor/exports/CaretDown";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { ClipboardText } from "@/components/icons/phosphor/exports/ClipboardText";
import { Info } from "@/components/icons/phosphor/exports/Info";
import { CurrencyDollar } from "@/components/icons/phosphor/exports/CurrencyDollar";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { DotsThreeVertical } from "@/components/icons/phosphor/exports/DotsThreeVertical";
import { FloppyDisk } from "@/components/icons/phosphor/exports/FloppyDisk";
import { Hash } from "@/components/icons/phosphor/exports/Hash";
import { LinkSimple } from "@/components/icons/phosphor/exports/LinkSimple";
import { LockSimple } from "@/components/icons/phosphor/exports/LockSimple";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { PaperPlaneTilt } from "@/components/icons/phosphor/exports/PaperPlaneTilt";
import { Plus } from "@/components/icons/phosphor/exports/Plus";
import { ShoppingCart } from "@/components/icons/phosphor/exports/ShoppingCart";
import { ShieldWarning } from "@/components/icons/phosphor/exports/ShieldWarning";
import { Trash } from "@/components/icons/phosphor/exports/Trash";
import { UsersThree } from "@/components/icons/phosphor/exports/UsersThree";
import { X } from "@/components/icons/phosphor/exports/X";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { classifyGnd } from "@/lib/dfd-gnd";
import {
  deriveGndFromNatureza,
  getCatalogFiscalIssue,
  getCatalogFiscalIssueMessage,
} from "@/lib/catalog-fiscal";
import { buildCatalogSelectionKey } from "@/lib/catalog-selection";
import {
  buildCollectiveContributionKey,
  splitCollectiveItemsByExpenseClass,
} from "@/lib/collective-dfd";
import {
  COLLECTIVE_CATALOG_SEARCH_LIMIT,
  COLLECTIVE_CATALOG_SEARCH_WINDOW,
  buildCollectiveCatalogPageState,
  sanitizeCollectiveCatalogSearch,
  summarizeCollectiveCatalogItemForDisplay,
} from "@/lib/collective-catalog-search";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";
import {
  getFriendlyErrorMessage,
  UX_SUCCESS,
  UX_WARNING,
} from "@/lib/ux-feedback";
import {
  DFD_PLANNING_FIELD_HELPERS,
  DFD_PLANNING_FIELD_LABELS,
  DFD_PLANNING_FIELD_ORDER,
  formatPlanningSubsidiesForText,
  sanitizePlanningSubsidies,
  type DfdPlanningFieldKey,
  type DfdPlanningSubsidies,
} from "@/lib/dfd-planning";
import { protectSpreadsheetCell } from "@/lib/admin-reports";
import {
  captureCartAnimationOrigin,
  type CartAnimationOrigin,
} from "@/lib/cart-animation-origin";
import { AvatarStack, type AvatarStackMember } from "@/components/user/AvatarStack";
import { MechanicalValue } from "@/components/ui/MechanicalValue";

type RoomStatus =
  | "proposta"
  | "aberta"
  | "em_consolidacao_chefia"
  | "pronta_para_conversao"
  | "convertida"
  | "arquivada";
type FlowStage = "proposta" | "adicionar" | "consolidar" | "revisao" | "finalizar";
type ReviewTab = "itens" | "informacoes" | "anexos";
type CatalogExpenseFilter = "todos" | "corrente" | "capital" | "consumo" | "permanente";
type CatalogTypeFilter = "todos" | "material" | "servico";
type GovernanceActionMode = "confirm" | "edit" | "return_for_correction";
type ReturnFieldKey = "quantidade" | "valor_unitario_estimado" | "justificativa_item" | "link_referencia";
type FiscalAlternative = {
  efisco_item_id?: string | number | null;
  codigo_efisco?: string | null;
  efisco_item_natureza_id?: string | number | null;
  codigo_natureza_despesa?: string | null;
  natureza_key?: string | null;
  gnd?: string | null;
  classe_despesa?: string | null;
};
type ReturnInstruction = {
  returnComment: string;
  returnFields: ReturnFieldKey[];
  createdAt: string;
};
type ContributionSnapshot = {
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_item: string;
  link_referencia: string;
};
type CorrectionComparison = {
  contributionId: string;
  fields: Array<{
    key: ReturnFieldKey;
    label: string;
    before: string;
    after: string;
  }>;
};

type ContributionDraft = {
  quantidade: number;
  valor_unitario_estimado: string;
  unidade_medida: string;
  link_referencia: string;
  justificativa_item: string;
  justificativa_quantidade: string;
};

type Participant = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_avatar_url: string | null;
  quantidade: number;
  total: number;
};

type Contribution = {
  id: string;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  user_avatar_url?: string | null;
  efisco_item_id?: string | number | null;
  efisco_item_natureza_id?: string | number | null;
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  descricao: string;
  unidade_medida?: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_item?: string | null;
  justificativa_quantidade?: string | null;
  link_referencia?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  codigo_natureza_despesa?: string | null;
  nome_grupo?: string | null;
  nome_classe?: string | null;
  status?: string | null;
  can_edit?: boolean;
  adjusted_by_chefia?: boolean;
  adjusted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  fiscal_options?: FiscalAlternative[];
};

type AggregatedItem = {
  efisco_item_id?: string | number | null;
  efisco_item_natureza_id?: string | number | null;
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  descricao?: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  unidade_medida?: string | null;
  justificativa_item?: string | null;
  justificativa_quantidade?: string | null;
  gnd?: string | null;
  gnd_derivado?: string | null;
  codigo_natureza_despesa?: string | null;
  nome_classe?: string | null;
  nome_grupo?: string | null;
  contributors?: Array<{
    user_id: string;
    user_name?: string | null;
    user_email?: string | null;
    user_avatar_url?: string | null;
    quantidade: number;
  }>;
  fiscal_options?: FiscalAlternative[];
};

type GovernanceModalState = {
  mode: GovernanceActionMode;
  item: AggregatedItem;
  contributions: Contribution[];
};

type RoomEvent = {
  id: string;
  message: string;
  event_type: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type RoomDetail = {
  room: {
    id: string;
    title: string;
    description: string | null;
    scope: string | null;
    planning_subsidies?: DfdPlanningSubsidies | null;
    status: RoomStatus;
    unit_name: string;
    campus_name?: string | null;
    unit_type?: "departamento" | "laboratorio" | string | null;
    can_edit_metadata: boolean;
    can_admin_correct?: boolean;
    can_publish?: boolean;
    can_reopen?: boolean;
    can_contribute?: boolean;
    can_convert: boolean;
    actor_role?: "membro" | "chefia" | "admin" | "superadmin";
    is_proposal_owner?: boolean;
    published_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  participants: Participant[];
  contributions: Contribution[];
  items: AggregatedItem[];
  linkedDfds: Array<{ dfd_id: string; expense_class: string | null }>;
  events: RoomEvent[];
};

type CatalogItem = {
  id: string | number;
  efisco_item_id?: string | number | null;
  efisco_item_natureza_id?: string | number | null;
  codigo_efisco?: string | null;
  codigo_tce?: string | null;
  descricao: string;
  tipo_objeto?: string | null;
  nome_grupo?: string | null;
  grupo?: string | null;
  nome_classe?: string | null;
  classe?: string | null;
  codigo_grupo?: string | null;
  codigo_classe?: string | null;
  codigo_natureza_preferencial?: string | null;
  gnd_preferencial?: string | null;
  natureza_count?: number | null;
  has_mixed_expense_classes?: boolean;
  has_missing_natureza?: boolean;
  requires_natureza_review?: boolean;
  unidade_medida?: string | null;
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

type CartDraftItem = ContributionDraft & {
  cartId: string;
  item: CatalogItem;
  addedAt: number;
};

type FlyingCartItem = {
  id: string;
  label: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const STATUS_LABELS: Record<RoomStatus, string> = {
  proposta: "Proposta",
  aberta: "Aberta",
  em_consolidacao_chefia: "Consolidação da chefia",
  pronta_para_conversao: "Pronta para conversão",
  convertida: "Convertida",
  arquivada: "Arquivada",
};

const RETURN_FIELD_OPTIONS: Array<{ id: ReturnFieldKey; label: string; description: string }> = [
  {
    id: "quantidade",
    label: "Quantidade",
    description: "Número de unidades solicitadas.",
  },
  {
    id: "valor_unitario_estimado",
    label: "Valor unitário",
    description: "Preço estimado para cada unidade.",
  },
  {
    id: "justificativa_item",
    label: "Justificativa",
    description: "Finalidade e critério da necessidade.",
  },
  {
    id: "link_referencia",
    label: "Link de referência",
    description: "Fonte usada para estimar ou especificar o item.",
  },
];

const RETURN_FIELD_LABELS = RETURN_FIELD_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.label;
    return acc;
  },
  {} as Record<ReturnFieldKey, string>,
);

function isReturnFieldKey(value: unknown): value is ReturnFieldKey {
  return typeof value === "string" && value in RETURN_FIELD_LABELS;
}

function readReturnInstruction(event: RoomEvent) {
  if (event.event_type !== "contribution_returned_by_chefia" || !event.metadata) return null;
  const metadata = event.metadata;
  const contributionId = typeof metadata.contribution_id === "string" ? metadata.contribution_id : "";
  if (!contributionId) return null;
  const returnComment =
    typeof metadata.return_comment === "string" ? metadata.return_comment.trim() : "";
  const returnFields = Array.isArray(metadata.return_fields)
    ? metadata.return_fields.filter(isReturnFieldKey)
    : [];
  return {
    contributionId,
    instruction: {
      returnComment,
      returnFields,
      createdAt: event.created_at,
    } satisfies ReturnInstruction,
  };
}

function readContributionSnapshot(value: unknown): ContributionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    quantidade: Number(record.quantidade || 0),
    valor_unitario_estimado: Number(record.valor_unitario_estimado || 0),
    justificativa_item: String(record.justificativa_item || ""),
    link_referencia: String(record.link_referencia || ""),
  };
}

function snapshotFieldChanged(
  field: ReturnFieldKey,
  before: ContributionSnapshot,
  after: ContributionSnapshot,
) {
  if (field === "quantidade" || field === "valor_unitario_estimado") {
    return Number(before[field] || 0) !== Number(after[field] || 0);
  }
  return String(before[field] || "").trim() !== String(after[field] || "").trim();
}

function formatSnapshotField(field: ReturnFieldKey, snapshot: ContributionSnapshot) {
  if (field === "valor_unitario_estimado") return formatCurrency(snapshot.valor_unitario_estimado);
  if (field === "quantidade") return String(snapshot.quantidade || 0);
  const value = String(snapshot[field] || "").trim();
  return value || "Vazio";
}

function readCorrectionComparison(event: RoomEvent): CorrectionComparison | null {
  if (event.event_type !== "contribution_corrected" || !event.metadata) return null;
  const metadata = event.metadata;
  const contributionId = typeof metadata.contribution_id === "string" ? metadata.contribution_id : "";
  const returnSnapshot = readContributionSnapshot(metadata.return_snapshot);
  const correctionSnapshot = readContributionSnapshot(metadata.correction_snapshot);
  if (!contributionId || !returnSnapshot || !correctionSnapshot) return null;

  return {
    contributionId,
    fields: RETURN_FIELD_OPTIONS.filter((field) =>
      snapshotFieldChanged(field.id, returnSnapshot, correctionSnapshot),
    ).map((field) => ({
      key: field.id,
      label: field.label,
      before: formatSnapshotField(field.id, returnSnapshot),
      after: formatSnapshotField(field.id, correctionSnapshot),
    })),
  };
}

function formatReturnFieldLabels(returnFields: ReturnFieldKey[]) {
  return returnFields.map((field) => RETURN_FIELD_LABELS[field]).join(", ");
}

const FLOW_STEPS: Array<{
  id: FlowStage;
  title: string;
  description: string;
}> = [
  {
    id: "proposta",
    title: "Proposta",
    description: "Rascunho aguardando publicação da chefia",
  },
  {
    id: "adicionar",
    title: "Sala aberta",
    description: "Pares contribuem com itens e justificativas",
  },
  {
    id: "consolidar",
    title: "Consolidação da chefia",
    description: "A chefia consolida, reescreve e decide o recorte",
  },
  {
    id: "revisao",
    title: "Prévia de conversão",
    description: "Verifique a saída prevista antes de gerar as DFDs oficiais",
  },
  {
    id: "finalizar",
    title: "Histórico",
    description: "Acompanhe o que a sala gerou",
  },
];

export default function DfdColetivaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = String(params?.id || "");
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [savingContributionId, setSavingContributionId] = useState<string | null>(null);
  const [adminCorrectionOpen, setAdminCorrectionOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeStage, setActiveStage] = useState<FlowStage>("adicionar");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("itens");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<CatalogExpenseFilter>("todos");
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<CatalogTypeFilter>("todos");
  const [naturezaDialog, setNaturezaDialog] = useState<{
    item: CatalogItem;
    options: NaturezaOption[];
  } | null>(null);
  const [cartItems, setCartItems] = useState<CartDraftItem[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [selectionDrawerOpen, setSelectionDrawerOpen] = useState(false);
  const [selectionDrawerSection, setSelectionDrawerSection] = useState<"cart" | "requested">("cart");
  const [savingCart, setSavingCart] = useState(false);
  const [flyingCartItems, setFlyingCartItems] = useState<FlyingCartItem[]>([]);
  const [cartPulseKey, setCartPulseKey] = useState(0);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [showCollectiveFlowGuide, setShowCollectiveFlowGuide] = useState(false);
  const [showConsolidationWarning, setShowConsolidationWarning] = useState(false);
  const [governanceModal, setGovernanceModal] = useState<GovernanceModalState | null>(null);
  const [deleteLockedNotice, setDeleteLockedNotice] = useState<Contribution | null>(null);
  const cartTargetRef = useRef<HTMLButtonElement | null>(null);
  const roomStatus = detail?.room.status;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/collective-rooms/${roomId}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar DFD coletiva.");
      setDetail(payload);
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos carregar esta sala coletiva agora. Tente atualizar em instantes.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (roomId) loadDetail();
  }, [loadDetail, roomId]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;
        setViewerUserId(data.user?.id || null);
      })
      .catch(() => {
        if (!mounted) return;
        setViewerUserId(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!roomStatus) return;
    if (roomStatus === "proposta") {
      setActiveStage("proposta");
      return;
    }
    if (roomStatus === "aberta") {
      setActiveStage("adicionar");
      return;
    }
    if (roomStatus === "em_consolidacao_chefia") {
      setActiveStage("consolidar");
      return;
    }
    if (roomStatus === "pronta_para_conversao") {
      setActiveStage("revisao");
      return;
    }
    if (roomStatus === "convertida" || roomStatus === "arquivada") {
      setActiveStage("finalizar");
      return;
    }
  }, [roomStatus]);

  useEffect(() => {
    const searchTerm = sanitizeCollectiveCatalogSearch(catalogSearch);
    // A new term always starts at page 1. Reset immediately so a pending
    // request cannot inherit the previous page offset while the debounce runs.
    setCatalogPage(0);
    const timer = window.setTimeout(() => {
      setCatalogQuery(searchTerm);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [catalogSearch]);

  useEffect(() => {
    const searchTerm = sanitizeCollectiveCatalogSearch(catalogQuery);
    if (!searchTerm) {
      setCatalogItems([]);
      setCatalogHasMore(false);
      return;
    }

    let active = true;
    async function fetchCatalogPage() {
      setCatalogLoading(true);
      // The search API returns a ranked candidate window. Paginating that
      // window locally avoids sending offset=12 through the SQL fallback,
      // which can otherwise produce an empty second page for a valid search.
      const pageStart = catalogPage * COLLECTIVE_CATALOG_SEARCH_LIMIT;
      const pageEnd = pageStart + COLLECTIVE_CATALOG_SEARCH_LIMIT;
      try {
        const response = await fetch(
          `/api/catalog-search?q=${encodeURIComponent(searchTerm)}&category=${catalogTypeFilter === "todos" ? "all" : catalogTypeFilter}&context=dfd_coletiva&limit=${COLLECTIVE_CATALOG_SEARCH_WINDOW}&offset=0`,
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Falha na busca.");
        if (!active) return;
        const rows = (payload.items || []) as CatalogItem[];
        const rankedRows = rerankCatalogSearchResults(searchTerm, rows);
        setCatalogItems(rankedRows.slice(pageStart, pageEnd));
        setCatalogHasMore(rankedRows.length > pageEnd);
      } catch {
        if (!active) return;
        toast.error("Não conseguimos buscar no catálogo agora. Tente termos mais simples ou tente novamente.");
        setCatalogItems([]);
        setCatalogHasMore(false);
      } finally {
        if (active) setCatalogLoading(false);
      }
    }

    fetchCatalogPage();
    return () => {
      active = false;
    };
  }, [catalogPage, catalogQuery, catalogTypeFilter]);

  useEffect(() => {
    setCatalogPage(0);
  }, [catalogTypeFilter]);

  const catalogPageState = buildCollectiveCatalogPageState(
    catalogPage,
    catalogItems.length,
  );

  const totalValue = useMemo(
    () =>
      (detail?.items || []).reduce(
        (acc, item) => acc + getItemSubtotal(item),
        0,
      ),
    [detail?.items],
  );

  const breakdown = useMemo(() => summarizeItemsByExpense(detail?.items || []), [detail?.items]);
  const previewExpenseGroups = useMemo(
    () => splitCollectiveItemsByExpenseClass((detail?.items || []) as any),
    [detail?.items],
  );

  const filteredCatalogItems = useMemo(
    () =>
      catalogItems.filter((item) => {
        if (catalogFilter === "todos") return true;
        const badge = getCatalogExpenseBadge(
          item.gnd_preferencial ||
            deriveGndFromNatureza(item.codigo_natureza_preferencial),
        );
        if (catalogFilter === "corrente") return badge.kind === "corrente";
        if (catalogFilter === "capital") return badge.kind === "capital";
        if (catalogFilter === "consumo") return badge.elementCode === "30";
        if (catalogFilter === "permanente") return badge.elementCode === "52";
        return true;
      }),
    [catalogFilter, catalogItems],
  );

  const checklist = useMemo(() => {
    const items = detail?.items || [];
    return {
      hasItems: items.length > 0,
      quantities: items.every((item) => Number(item.quantidade || 0) > 0),
      values: items.every((item) => Number(item.valor_unitario_estimado || 0) > 0),
      participants: (detail?.participants.length || 0) > 0,
      metadata: Boolean(detail?.room.description || detail?.room.scope),
    };
  }, [detail]);
  const canEdit = Boolean(detail?.room.can_edit_metadata);
  const canEditFiscal =
    detail?.room.actor_role === "admin" || detail?.room.actor_role === "superadmin";
  const isOpen = detail?.room.status === "aberta";
  const canContributeInOpenRoom = isOpen && Boolean(detail?.room.can_contribute);
  const hasReturnedContributions = useMemo(
    () =>
      (detail?.contributions || []).some(
        (contribution) => String(contribution.status || "") === "devolvida",
      ),
    [detail?.contributions],
  );
  const contributionsByItemKey = useMemo(() => {
    const grouped = new Map<string, Contribution[]>();
    for (const contribution of detail?.contributions || []) {
      if (String(contribution.status || "") === "arquivada") continue;
      const key = buildCollectiveContributionKey(contribution);
      const current = grouped.get(key) || [];
      current.push(contribution);
      grouped.set(key, current);
    }
    return grouped;
  }, [detail?.contributions]);
  const returnInstructionsByContributionId = useMemo(() => {
    const instructions = new Map<string, ReturnInstruction>();
    for (const event of detail?.events || []) {
      const parsed = readReturnInstruction(event);
      if (!parsed || instructions.has(parsed.contributionId)) continue;
      instructions.set(parsed.contributionId, parsed.instruction);
    }
    return instructions;
  }, [detail?.events]);
  const activeCartItem = useMemo(
    () =>
      cartItems.find((item) => item.cartId === activeCartId) ||
      cartItems[cartItems.length - 1] ||
      null,
    [activeCartId, cartItems],
  );
  const cartItemKeys = useMemo(
    () => new Set(cartItems.map((cartItem) => getCatalogItemKey(cartItem.item))),
    [cartItems],
  );
  const activeCatalogItemKey = activeCartItem
    ? getCatalogItemKey(activeCartItem.item)
    : null;
  const naturezaDialogOptions = useMemo(
    () => naturezaDialog?.options || [],
    [naturezaDialog],
  );
  const participantAvatarMembers = useMemo<AvatarStackMember[]>(
    () =>
      (detail?.participants || []).map((participant) => ({
        id: participant.user_id,
        name: participant.user_name || participant.user_email || "Participante",
        email: participant.user_email || null,
        avatarUrl: participant.user_avatar_url || null,
      })),
    [detail?.participants],
  );
  const selectedSubtotal = activeCartItem ? getDraftSubtotal(activeCartItem) : 0;
  const pendingCartValue = useMemo(
    () => cartItems.reduce((acc, item) => acc + getDraftSubtotal(item), 0),
    [cartItems],
  );
  const myRequestedContributions = useMemo(() => {
    if (!detail || !viewerUserId) return [];
    return detail.contributions
      .filter(
        (contribution) =>
          String(contribution.user_id || "") === String(viewerUserId) &&
          String(contribution.status || "") !== "arquivada",
      )
      .sort((a, b) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      });
  }, [detail, viewerUserId]);
  const canDeleteRequestedContribution =
    detail?.room.actor_role === "admin" || detail?.room.actor_role === "superadmin";
  const canConsolidateRoom =
    detail?.room.actor_role === "chefia" ||
    detail?.room.actor_role === "admin" ||
    detail?.room.actor_role === "superadmin";
  const itemsFromOtherPeople = useMemo(() => {
    if (!detail) return [];
    return detail.items.filter((item) =>
      (item.contributors || []).some(
        (contributor) => String(contributor.user_id || "") !== String(viewerUserId || ""),
      ),
    );
  }, [detail, viewerUserId]);

  function finalizeMyContributions() {
    setSelectionDrawerOpen(false);
    toast.success("Seus pedidos enviados permanecem na sala para consolidação pela chefia.");
    router.push("/dfds-coletivas");
  }

  async function handleConsolidateAction() {
    if (!canConsolidateRoom) {
      finalizeMyContributions();
      return;
    }
    if (detail?.room.status === "aberta") {
      await updateRoomStatus(
        "em_consolidacao_chefia",
        "Coautoria encerrada. A chefia assumiu a consolidação.",
      );
      setSelectionDrawerOpen(false);
      setActiveStage("consolidar");
      return;
    }
    setSelectionDrawerOpen(false);
    setActiveStage("consolidar");
  }

  function requestConsolidationAdvance() {
    if (cartItems.length > 0) {
      setSelectionDrawerSection("cart");
      setSelectionDrawerOpen(true);
      toast.info("Envie os itens do carrinho para a sala antes de continuar.");
      return;
    }
    if (detail?.room.status !== "aberta" || !canConsolidateRoom) {
      void handleConsolidateAction();
      return;
    }
    setSelectionDrawerOpen(false);
    setShowConsolidationWarning(true);
  }

  async function confirmConsolidationAdvance() {
    setShowConsolidationWarning(false);
    await handleConsolidateAction();
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    const form = new FormData(event.currentTarget);
    setSavingMeta(true);
    try {
      const response = await fetch(`/api/collective-rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          description: form.get("description"),
          scope: form.get("scope"),
          planning_subsidies: readPlanningSubsidiesFromForm(form),
          status: form.get("status") || detail.room.status,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao salvar DFD coletiva.");
      toast.success("DFD coletiva atualizada.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao salvar DFD coletiva.");
    } finally {
      setSavingMeta(false);
    }
  }

  async function updateRoomStatus(status: RoomStatus, successMessage: string) {
    if (!detail) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/collective-rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao atualizar status.");
      toast.success(successMessage);
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar status.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  function openGovernanceAction(mode: GovernanceActionMode, item: AggregatedItem) {
    const key = buildCollectiveContributionKey(item);
    const contributions = contributionsByItemKey.get(key) || [];
    if (contributions.length === 0) {
      toast.error("Não encontramos as contribuições vinculadas a este item.");
      return;
    }
    setGovernanceModal({ mode, item, contributions });
  }

  async function submitGovernanceAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!governanceModal) return;
    const form = new FormData(event.currentTarget);
    const contributionId = String(form.get("contribution_id") || "").trim();
    if (!contributionId) {
      toast.warning("Selecione a contribuição afetada.");
      return;
    }

    const payload =
      governanceModal.mode === "edit"
        ? {
            action: governanceModal.mode,
            quantidade: form.get("quantidade"),
            valor_unitario_estimado: form.get("valor_unitario_estimado"),
            justificativa_item: form.get("justificativa_item"),
            justificativa_quantidade: form.get("justificativa_quantidade"),
            link_referencia: form.get("link_referencia"),
          }
        : {
            action: governanceModal.mode,
            return_comment: form.get("return_comment"),
            return_fields: form.getAll("return_fields"),
          };
    if (governanceModal.mode === "edit" && form.has("codigo_item_efisco")) {
      Object.assign(payload, {
        codigo_item_efisco: form.get("codigo_item_efisco"),
        codigo_natureza_despesa: form.get("codigo_natureza_despesa"),
        gnd: form.get("gnd"),
      });
    }

    setSavingContributionId(contributionId);
    try {
      const response = await fetch(`/api/collective-rooms/${roomId}/contributions/${contributionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Erro ao processar item.");
      toast.success(
        governanceModal.mode === "confirm"
          ? "Item confirmado pela chefia."
          : governanceModal.mode === "return_for_correction"
            ? "Item devolvido para correção."
            : "Item ajustado pela chefia.",
      );
      setGovernanceModal(null);
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao processar item.");
    } finally {
      setSavingContributionId(null);
    }
  }

  async function saveReturnedContributionCorrection(
    event: FormEvent<HTMLFormElement>,
    contributionId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSavingContributionId(contributionId);
    try {
      const response = await fetch(`/api/collective-rooms/${roomId}/contributions/${contributionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          quantidade: form.get("quantidade"),
          valor_unitario_estimado: form.get("valor_unitario_estimado"),
          justificativa_item: form.get("justificativa_item"),
          justificativa_quantidade: form.get("justificativa_quantidade"),
          link_referencia: form.get("link_referencia"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || "Erro ao enviar correção.");
      toast.success("Correção enviada para a chefia revisar.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao enviar correção.");
    } finally {
      setSavingContributionId(null);
    }
  }

  function addResolvedCatalogItemToCart(
    item: CatalogItem & { searchPosition?: number },
    animationOrigin?: CartAnimationOrigin | null,
  ) {
    const key = getCatalogItemKey(item);
    const existing = cartItems.find((cartItem) => getCatalogItemKey(cartItem.item) === key);

    if (animationOrigin) {
      launchCartAnimation(animationOrigin, item.descricao);
    }

    if (existing) {
      setActiveCartId(existing.cartId);
      setSelectionDrawerSection("cart");
      setSelectionDrawerOpen(true);
      setCartPulseKey((current) => current + 1);
      toast.info("Item já está no carrinho.");
      return;
    }

    const nextItem = createCartDraftItem(item);
    setCartItems((current) => [...current, nextItem]);
    setActiveCartId(nextItem.cartId);
    setSelectionDrawerSection("cart");
    setSelectionDrawerOpen(true);
    setCartPulseKey((current) => current + 1);

    void recordCatalogSearchClick({
      actionType: "add_to_collective_cart",
      queryText: catalogQuery,
      category: "all",
      context: "dfd_coletiva",
      source: "catalog_search",
      resultPosition:
        Number.isFinite(Number(item.searchPosition)) && Number(item.searchPosition) >= 0
          ? Number(item.searchPosition)
          : null,
      catalogId: item.id,
      codigoEfisco: item.codigo_efisco || item.codigo_tce,
      itemDescricao: item.descricao,
    });
  }

  function resolveCatalogItemWithNatureza(
    item: CatalogItem,
    option: NaturezaOption,
  ): CatalogItem {
    return {
      ...item,
      efisco_item_id: option.efisco_item_id,
      efisco_item_natureza_id: option.efisco_item_natureza_id,
      codigo_natureza_preferencial: option.codigo_natureza_despesa,
      gnd_preferencial: option.gnd,
      natureza_count: 1,
      has_mixed_expense_classes: false,
      has_missing_natureza: false,
      requires_natureza_review: false,
    };
  }

  function addMixedExpenseClassVariantsToCart(item: CatalogItem, options: NaturezaOption[]) {
    const mixedOptions = ["custeio", "investimento"]
      .map((expenseClass) =>
        options.find((option) => classifyGnd(option.gnd)?.expenseClass === expenseClass),
      )
      .filter((option): option is NaturezaOption => Boolean(option));

    if (mixedOptions.length < 2) return false;

    let addedCount = 0;
    for (const option of mixedOptions) {
      const resolvedItem = resolveCatalogItemWithNatureza(item, option);
      const optionKey = getCatalogItemKey(resolvedItem);
      if (cartItems.some((cartItem) => getCatalogItemKey(cartItem.item) === optionKey)) continue;
      addResolvedCatalogItemToCart(resolvedItem);
      addedCount += 1;
    }

    if (addedCount > 0) {
      toast.success("Item misto adicionado em corrente e capital. A DFD coletiva será separada em duas DFDs na conversão.");
    } else {
      toast.info("As naturezas corrente e capital já estão no carrinho.");
    }
    return true;
  }

  async function addCatalogItemToCart(
    item: CatalogItem & { searchPosition?: number },
    event?: MouseEvent<HTMLButtonElement>,
  ) {
    const animationOrigin = captureCartAnimationOrigin(event?.currentTarget);
    const productCode = String(item.codigo_efisco || item.codigo_tce || item.id || "").trim();
    if (!productCode) {
      toast.error("Item sem código e-Fisco válido.");
      return;
    }

    const fiscalIssue = getCatalogFiscalIssue({
      ...item,
      codigo_efisco: productCode,
      codigo_tce: productCode,
      codigo_natureza_despesa: item.codigo_natureza_preferencial,
      gnd: item.gnd_preferencial,
      gnd_derivado: item.gnd_preferencial,
      efisco_item_id: item.efisco_item_id,
      efisco_item_natureza_id: item.efisco_item_natureza_id,
    });

    if (!fiscalIssue) {
      addResolvedCatalogItemToCart(item, animationOrigin);
      return;
    }

    if (fiscalIssue === "missing_natureza") {
      addResolvedCatalogItemToCart(
        {
          ...item,
          codigo_natureza_preferencial: null,
          gnd_preferencial: "SEM_NATUREZA",
          natureza_count: 0,
          has_missing_natureza: true,
          requires_natureza_review: true,
        },
        animationOrigin,
      );
      toast.warning(
        "Item sem natureza adicionado. Ele será separado em DFD própria para revisão da equipe.",
      );
      return;
    }

    try {
      const params = new URLSearchParams({ codigo_efisco: productCode });
      if (item.efisco_item_id) params.set("efisco_item_id", String(item.efisco_item_id));
      const response = await fetch(`/api/catalog-item-naturezas?${params.toString()}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Não foi possível carregar naturezas.");
      }
      const options = ((payload.items || []) as NaturezaOption[]).filter(
        (option) => option.codigo_natureza_despesa && option.gnd,
      );
      if (options.length === 0) {
        toast.error(getCatalogFiscalIssueMessage(fiscalIssue) || "Item fiscalmente inválido.");
        return;
      }
      if (fiscalIssue === "mixed_expense_classes") {
        if (addMixedExpenseClassVariantsToCart(item, options)) {
          if (animationOrigin) launchCartAnimation(animationOrigin, item.descricao);
          return;
        }
      }
      if (options.length === 1) {
        addResolvedCatalogItemToCart(resolveCatalogItemWithNatureza(item, options[0]), animationOrigin);
        return;
      }
      setNaturezaDialog({ item, options });
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível carregar naturezas.");
    }
  }

  function addAggregatedItemToCart(item: AggregatedItem) {
    if (!canContributeInOpenRoom) {
      toast.warning("Esta sala não está aberta para novas contribuições.");
      return;
    }

    const mappedItem: CatalogItem = {
      id: String(item.codigo_item_efisco || item.codigo_tce || createClientId("agg")),
      codigo_efisco: item.codigo_item_efisco || item.codigo_tce || null,
      codigo_tce: item.codigo_tce || item.codigo_item_efisco || null,
      descricao: item.descricao || "Item sem descrição",
      nome_grupo: item.nome_grupo || null,
      nome_classe: item.nome_classe || null,
      codigo_natureza_preferencial: item.codigo_natureza_despesa || null,
      gnd_preferencial: item.gnd || item.gnd_derivado || null,
      unidade_medida: "UN",
    };

    const key = getCatalogItemKey(mappedItem);
    const existing = cartItems.find((cartItem) => getCatalogItemKey(cartItem.item) === key);
    if (existing) {
      setActiveCartId(existing.cartId);
      setSelectionDrawerSection("cart");
      setSelectionDrawerOpen(true);
      setCartPulseKey((current) => current + 1);
      return;
    }

    const seededDraft: CartDraftItem = {
      ...createCartDraftItem(mappedItem),
      quantidade: 1,
      valor_unitario_estimado:
        Number(item.valor_unitario_estimado || 0) > 0
          ? String(item.valor_unitario_estimado)
          : "",
      unidade_medida: item.unidade_medida || "UN",
      link_referencia: "",
      justificativa_item:
        "Complemento de quantidade para item já existente na DFD coletiva.",
      justificativa_quantidade: "",
    };
    setCartItems((current) => [...current, seededDraft]);
    setActiveCartId(seededDraft.cartId);
    setSelectionDrawerSection("cart");
    setSelectionDrawerOpen(true);
    setCartPulseKey((current) => current + 1);
    toast.success(UX_SUCCESS.itemPrepared);
  }

  function seedContributionInCart(contribution: Contribution) {
    if (!canContributeInOpenRoom) {
      toast.warning("Esta sala não está aberta para novas contribuições.");
      return;
    }
    const mappedItem: CatalogItem = {
      id: String(contribution.codigo_item_efisco || contribution.codigo_tce || createClientId("contrib")),
      codigo_efisco: contribution.codigo_item_efisco || contribution.codigo_tce || null,
      codigo_tce: contribution.codigo_tce || contribution.codigo_item_efisco || null,
      descricao: contribution.descricao || "Item sem descrição",
      nome_grupo: contribution.nome_grupo || null,
      nome_classe: contribution.nome_classe || null,
      codigo_natureza_preferencial: contribution.codigo_natureza_despesa || null,
      gnd_preferencial: contribution.gnd || contribution.gnd_derivado || null,
      unidade_medida: contribution.unidade_medida || "UN",
    };
    const key = getCatalogItemKey(mappedItem);
    const existing = cartItems.find((cartItem) => getCatalogItemKey(cartItem.item) === key);
    if (existing) {
      setActiveCartId(existing.cartId);
      setSelectionDrawerSection("cart");
      setSelectionDrawerOpen(true);
      return;
    }
    const seededDraft: CartDraftItem = {
      ...createCartDraftItem(mappedItem),
      quantidade: 1,
      valor_unitario_estimado:
        Number(contribution.valor_unitario_estimado || 0) > 0
          ? String(contribution.valor_unitario_estimado)
          : "",
      unidade_medida: contribution.unidade_medida || "UN",
      justificativa_item:
        contribution.justificativa_item ||
        "Complemento de quantidade para item já solicitado.",
      justificativa_quantidade: contribution.justificativa_quantidade || "",
      link_referencia: contribution.link_referencia || "",
    };
    setCartItems((current) => [...current, seededDraft]);
    setActiveCartId(seededDraft.cartId);
    setSelectionDrawerSection("cart");
    setSelectionDrawerOpen(true);
    setCartPulseKey((current) => current + 1);
  }

  async function deleteRequestedContribution(contribution: Contribution) {
    if (!detail) return;
    if (!canDeleteRequestedContribution) {
      setDeleteLockedNotice(contribution);
      return;
    }
    if (!window.confirm("Arquivar esta solicitação? Esta ação remove o item da sala coletiva.")) return;

    try {
      const response = await fetch(
        `/api/collective-rooms/${roomId}/contributions/${contribution.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Não foi possível remover a solicitação.");
      toast.success("Solicitação removida da sala.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover solicitação.");
    }
  }

  function launchCartAnimation(source: CartAnimationOrigin, label: string) {
    const target = cartTargetRef.current?.getBoundingClientRect();
    const item: FlyingCartItem = {
      id: createClientId("fly"),
      label,
      startX: source.left + source.width / 2,
      startY: source.top + source.height / 2,
      endX: target ? target.left + target.width / 2 : window.innerWidth / 2,
      endY: target ? target.top + target.height / 2 : window.innerHeight - 48,
    };
    setFlyingCartItems((current) => [...current, item]);
  }

  function updateActiveCartDraft(update: SetStateAction<ContributionDraft>) {
    if (!activeCartItem) return;
    setCartItems((current) =>
      current.map((cartItem) => {
        if (cartItem.cartId !== activeCartItem.cartId) return cartItem;
        const nextDraft = resolveContributionDraftUpdate(cartItem, update);
        return { ...cartItem, ...nextDraft };
      }),
    );
  }

  function removeCartItem(cartId: string) {
    setCartItems((current) => current.filter((cartItem) => cartItem.cartId !== cartId));
    setActiveCartId((current) => {
      if (current !== cartId) return current;
      const nextItem = cartItems.find((cartItem) => cartItem.cartId !== cartId);
      return nextItem?.cartId || null;
    });
  }

  async function addContribution(event: FormEvent) {
    event.preventDefault();
    if (cartItems.length === 0) {
      toast.warning(UX_WARNING.addAtLeastOneItem);
      return;
    }

    const invalidItem = cartItems.find(
      (cartItem) =>
        Number(cartItem.quantidade || 0) <= 0 ||
        Number(cartItem.valor_unitario_estimado || 0) <= 0 ||
        cartItem.justificativa_item.trim().length === 0,
    );
    if (invalidItem) {
      setActiveCartId(invalidItem.cartId);
      setSelectionDrawerSection("cart");
      setSelectionDrawerOpen(true);
      toast.warning("Falta pouco: preencha quantidade, valor unitário e justificativa dos itens no carrinho. A base de cálculo pode ser complementada depois pela chefia.");
      return;
    }

    setSavingCart(true);
    try {
      for (const cartItem of cartItems) {
        const selectedItem = cartItem.item;
        const response = await fetch(`/api/collective-rooms/${roomId}/contributions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item: {
              ...selectedItem,
              codigo_item_efisco: selectedItem.codigo_efisco || selectedItem.codigo_tce,
              codigo_tce: selectedItem.codigo_efisco || selectedItem.codigo_tce,
              gnd:
                selectedItem.gnd_preferencial ||
                deriveGndFromNatureza(selectedItem.codigo_natureza_preferencial),
              gnd_derivado:
                selectedItem.gnd_preferencial ||
                deriveGndFromNatureza(selectedItem.codigo_natureza_preferencial),
              codigo_natureza_despesa: selectedItem.codigo_natureza_preferencial,
              quantidade: cartItem.quantidade,
              valor_unitario_estimado: Number(cartItem.valor_unitario_estimado || 0),
              unidade_medida: cartItem.unidade_medida,
              link_referencia: cartItem.link_referencia,
              justificativa_item: cartItem.justificativa_item,
              justificativa_quantidade: cartItem.justificativa_quantidade,
            },
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Erro ao adicionar item.");

        void recordCatalogSearchClick({
          actionType: "add_to_collective_room",
          queryText: catalogQuery,
          category: "all",
          context: "dfd_coletiva",
          source: "collective_room",
          catalogId: selectedItem.id,
          codigoEfisco: selectedItem.codigo_efisco || selectedItem.codigo_tce,
          itemDescricao: selectedItem.descricao,
        });
      }
      toast.success(`${cartItems.length} item(ns) adicionados à sala coletiva.`);
      setCartItems([]);
      setActiveCartId(null);
      setCatalogSearch("");
      setCatalogItems([]);
      setActiveStage("consolidar");
      setSelectionDrawerOpen(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos adicionar os itens agora. Revise o carrinho e tente novamente.",
        ),
      );
    } finally {
      setSavingCart(false);
    }
  }

  async function convertRoom() {
    if (!window.confirm("Gerar DFD oficial a partir desta DFD coletiva?")) return;
    setConverting(true);
    try {
      const response = await fetch(`/api/collective-rooms/${roomId}/convert`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao converter.");
      toast.success(`${payload.dfds?.length || 0} DFD(s) oficial(is) gerada(s) para a chefia analisar.`);
      setActiveStage("finalizar");
      await loadDetail();
    } catch (error: any) {
      toast.error(
        getFriendlyErrorMessage(
          error,
          "Não conseguimos converter a sala agora. Revise se ela está pronta para conversão.",
        ),
      );
    } finally {
      setConverting(false);
    }
  }

  function submitCatalogSearch(event: FormEvent) {
    event.preventDefault();
    setCatalogQuery(sanitizeCollectiveCatalogSearch(catalogSearch));
    setCatalogPage(0);
  }

  function clearCatalogSearch() {
    setCatalogSearch("");
    setCatalogQuery("");
    setCatalogItems([]);
    setCatalogPage(0);
    setSelectionDrawerOpen(false);
  }

  function exportCollectiveCsv() {
    if (!detail) return;
    const planningSubsidies = sanitizePlanningSubsidies(detail.room.planning_subsidies);
    const planningHeader = formatPlanningSubsidiesForText(planningSubsidies);
    const csvCell = (value: unknown) =>
      `"${String(protectSpreadsheetCell(value)).replace(/"/g, '""')}"`;
    const rows = [
      [
        "Sala",
        "Status da sala",
        "Item",
        "Código",
        "Grupo",
        "Classe",
        "GND",
        "Natureza",
        "Quantidade consolidada",
        "Valor unitário estimado",
        "Valor total consolidado",
        "Usuário",
        "E-mail",
        "Quantidade do usuário",
        "Justificativa do item",
        "Valor total do usuário",
        "Subsídios de planejamento",
        ...DFD_PLANNING_FIELD_ORDER.map((field) => DFD_PLANNING_FIELD_LABELS[field]),
      ],
      ...detail.items.flatMap((item) => {
        const contributors = item.contributors?.length
          ? item.contributors
          : [{ user_id: "", user_name: "", user_email: "", quantidade: 0 }];
        return contributors.map((contributor) => [
          detail.room.title || "",
          detail.room.status || "",
          item.descricao || "",
          item.codigo_item_efisco || item.codigo_tce || "",
          item.nome_grupo || "",
          item.nome_classe || "",
          item.gnd || item.gnd_derivado || "",
          item.codigo_natureza_despesa || "",
          Number(item.quantidade || 0),
          Number(item.valor_unitario_estimado || 0),
          Number(getItemSubtotal(item)),
          contributor.user_name || contributor.user_email || "Usuário não identificado",
          contributor.user_email || "",
          Number(contributor.quantidade || 0),
          item.justificativa_item || "",
          Number(contributor.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
          planningHeader,
          ...DFD_PLANNING_FIELD_ORDER.map((field) => planningSubsidies[field] || ""),
        ]);
      }),
    ];
    const csv = rows
      .map((row) => row.map(csvCell).join(";"))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dfd-coletiva-${detail.room.title || detail.room.id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--p-color-surface-soft)] p-6">
        <div className="mx-auto h-[70vh] max-w-[1440px] animate-pulse rounded-lg bg-white" />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-[var(--p-color-surface-soft)] p-6">
        <div className="mx-auto max-w-4xl rounded-lg border border-[var(--p-color-border-muted)] bg-white p-8 text-center">
          <p className="font-semibold text-[var(--p-color-brand-600)]">DFD coletiva não encontrada.</p>
          <button
            onClick={() => router.push("/dfds-coletivas")}
            className="mt-4 rounded-md bg-[var(--p-color-action)] px-4 py-2 text-sm font-semibold text-white"
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  const campusVisual = /ouricuri/i.test(String(detail.room.campus_name || ""))
    ? { label: "Ouricuri", image: "/campus/ouricuri.png", tint: "bg-[#fff5ef] border-[#f4c7ad]" }
    : { label: "Petrolina", image: "/campus/petrolina.png", tint: "bg-[#eff8ff] border-[#b8dcf5]" };
  const unitTypeLabel = detail.room.unit_type === "laboratorio" ? "Laboratório" : "Departamento";

  return (
    <main className="min-h-screen bg-[var(--semantic-neutral-soft)] px-5 py-6 text-[var(--p-color-fg)]">
      <AnimatePresence>
        {naturezaDialog && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNaturezaDialog(null)}
              className="fixed inset-0 z-[95] bg-[var(--p-color-fg)]/45"
            />
            <motion.section
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed left-1/2 top-1/2 z-[100] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--p-color-border-muted)] bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.24)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[var(--p-color-brand-600)]">
                    Escolha a natureza deste item
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                    Este item possui mais de uma classificação fiscal possível. Selecione a opção correta antes de enviar para a sala.
                  </p>
                  <p className="mt-2 text-xs text-[var(--p-color-fg-muted)]">
                    {naturezaDialog.item.descricao}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setNaturezaDialog(null)}
                  className="rounded-full border border-[var(--p-color-border)] p-2 text-[var(--p-color-fg-muted)]"
                  aria-label="Fechar"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <div className="mt-5 grid gap-3">
                {naturezaDialogOptions.map((option) => {
                  const badge = getCatalogExpenseBadge(option.gnd || option.codigo_natureza_despesa);
                  const resolvedItem = resolveCatalogItemWithNatureza(naturezaDialog.item, option);
                  const optionKey = getCatalogItemKey(resolvedItem);
                  const optionInCart = cartItems.some(
                    (cartItem) => getCatalogItemKey(cartItem.item) === optionKey,
                  );
                  return (
                    <button
                      key={String(option.efisco_item_natureza_id || option.natureza_key)}
                      type="button"
                      disabled={optionInCart}
                      onClick={() => {
                        addResolvedCatalogItemToCart(resolvedItem);
                        setNaturezaDialog(null);
                      }}
                      className={cn(
                        "rounded-2xl border px-4 py-4 text-left transition",
                        optionInCart
                          ? "cursor-not-allowed border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-subtle)]"
                          : "border-[var(--p-color-border-muted)] bg-white hover:border-[var(--p-color-action)] hover:bg-[var(--p-color-info-bg)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--p-color-brand-600)]">
                            {badge.label}
                          </p>
                          <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                            {badge.detail} · Natureza {option.codigo_natureza_despesa || "-"}
                          </p>
                        </div>
                        <span className={cn("rounded-full border px-2 py-1 type-kicker font-semibold uppercase", badge.className)}>
                          {option.gnd || option.codigo_natureza_despesa || "-"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          </>
        )}
      </AnimatePresence>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <Link
          href="/dfds-coletivas"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[var(--p-color-action)] no-underline"
        >
          <ArrowLeft size={17} weight="bold" /> Voltar para DFDs coletivas
        </Link>

        <section className="ux-panel relative overflow-hidden rounded-[22px] p-5">
          <div className="ux-accent-rule absolute inset-x-0 top-0 h-1" />
          <div className={`mb-3 flex w-fit max-w-full items-center gap-2 rounded-full border px-2 py-1.5 ${campusVisual.tint}`}>
            <img src={campusVisual.image} alt="" aria-hidden="true" className="h-7 w-7 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--p-color-brand-700)]">{campusVisual.label}</p>
            </div>
            <Buildings size={15} weight="duotone" className="shrink-0 text-[var(--p-color-action)]" />
          </div>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="ux-kicker">DFD coletiva</p>
              <h1 className="ux-title mt-1 truncate text-2xl font-semibold">
                {detail.room.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--p-color-fg-muted)]">
                <StatusBadge status={detail.room.status} />
                <span>{detail.room.unit_name}</span>
                <span className="text-[var(--p-color-fg-subtle)]">•</span>
                <span>{unitTypeLabel}</span>
                <span className="text-[var(--p-color-fg-subtle)]">•</span>
                <span>{detail.room.campus_name || "Campus não informado"}</span>
                <span className="text-[var(--p-color-fg-subtle)]">•</span>
                <span>Criada em {formatDateTime(detail.room.created_at)}</span>
                {detail.room.published_at && (
                  <>
                    <span className="text-[var(--p-color-fg-subtle)]">•</span>
                    <span>Publicada em {formatDateTime(detail.room.published_at)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
              <AvatarStack
                members={participantAvatarMembers}
                total={detail.participants.length}
                label={
                  detail.participants.length > 0
                    ? `${detail.participants.length} participante(s) nesta sala`
                    : "Aguardando participantes"
                }
                size="md"
                className="justify-start lg:justify-end"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <HeaderMetric icon={<UsersThree size={26} weight="duotone" />} label="Pessoas" value={detail.participants.length} />
                <HeaderMetric icon={<Package size={26} weight="duotone" />} label="Itens consolidados" value={detail.items.length} />
                <HeaderMetric
                  icon={<CurrencyDollar size={26} weight="bold" />}
                  label="Valor total estimado"
                  value={formatCurrency(totalValue)}
                />
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                {detail.room.can_admin_correct && <button type="button" className="ux-btn-primary rounded-xl px-5 py-3 text-sm font-semibold" onClick={() => setAdminCorrectionOpen(true)}>Corrigir DFD coletiva</button>}
                <DfdCorrectionEditor dfdId={roomId} administrative collective open={adminCorrectionOpen} onOpenChange={setAdminCorrectionOpen} onSaved={() => { void loadDetail(); }} />
                <button
                  type="button"
                  onClick={() => setShowCollectiveFlowGuide(true)}
                  className="ux-btn-secondary inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold"
                >
                  <Info size={17} weight="bold" /> Como funciona
                </button>
                <button
                  type="button"
                  onClick={exportCollectiveCsv}
                  className="ux-btn-secondary inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold"
                >
                  <DownloadSimple size={17} weight="bold" /> Exportar
                </button>
                {detail.room.can_convert && (
                  <button
                    type="button"
                    onClick={convertRoom}
                    disabled={converting || detail.items.length === 0}
                    className="ux-btn-primary inline-flex h-11 min-w-[168px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockSimple size={17} weight="bold" />
                    {converting ? "Gerando..." : "Gerar DFD oficial"}
                  </button>
                )}
                {detail.room.can_publish && (
                  <button
                    type="button"
                    onClick={() => updateRoomStatus("aberta", "Sala publicada para o setor.")}
                    disabled={updatingStatus}
                    className="ux-btn-collab inline-flex h-11 min-w-[168px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UsersThree size={17} weight="bold" />
                    {updatingStatus ? "Publicando..." : "Publicar sala"}
                  </button>
                )}
                {detail.room.can_reopen && (
                  <button
                    type="button"
                    onClick={() => updateRoomStatus("aberta", "Sala reaberta para novas contribuições.")}
                    disabled={updatingStatus}
                    className="ux-btn-secondary inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ArrowRight size={17} weight="bold" />
                    {updatingStatus ? "Reabrindo..." : "Reabrir sala"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <FlowStepper
          activeStage={activeStage}
          itemsCount={detail.items.length}
          status={detail.room.status}
          onStageChange={setActiveStage}
        />

        {activeStage === "proposta" && (
          <ProposalPanel
            detail={detail}
            canPublish={Boolean(detail.room.can_publish)}
            updatingStatus={updatingStatus}
            onPublish={() => updateRoomStatus("aberta", "Sala publicada para o setor.")}
          />
        )}

        {activeStage === "adicionar" && (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <RequestedRoomItemsPanel
              detail={detail}
              canContribute={canContributeInOpenRoom}
              onRequestContribution={addAggregatedItemToCart}
              viewerUserId={viewerUserId}
            />
            <CatalogPanel
              catalogSearch={catalogSearch}
              setCatalogSearch={setCatalogSearch}
              submitCatalogSearch={submitCatalogSearch}
              clearCatalogSearch={clearCatalogSearch}
              catalogItems={filteredCatalogItems}
              rawCatalogItems={catalogItems}
              catalogLoading={catalogLoading}
              catalogQuery={catalogQuery}
              cartItemKeys={cartItemKeys}
              activeCatalogItemKey={activeCatalogItemKey}
              addItemToCart={addCatalogItemToCart}
              catalogPageState={catalogPageState}
              catalogHasMore={catalogHasMore}
              setCatalogPage={setCatalogPage}
              catalogFilter={catalogFilter}
              setCatalogFilter={setCatalogFilter}
              catalogTypeFilter={catalogTypeFilter}
              setCatalogTypeFilter={setCatalogTypeFilter}
            />
          </section>
        )}

        {activeStage === "consolidar" && (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <ConsolidationPanel
              detail={detail}
              canContribute={canContributeInOpenRoom}
              canManageConsolidation={canEdit}
              canEditFiscal={canEditFiscal}
              updatingStatus={updatingStatus}
              savingContributionId={savingContributionId}
              hasReturnedContributions={hasReturnedContributions}
              returnInstructionsByContributionId={returnInstructionsByContributionId}
              onRequestContribution={addAggregatedItemToCart}
              onOpenGovernanceAction={openGovernanceAction}
              onSaveReturnedCorrection={saveReturnedContributionCorrection}
              onContinue={() => {
                void requestConsolidationAdvance();
              }}
              viewerUserId={viewerUserId}
            />
            <ConsolidationSummary
              detail={detail}
              totalValue={totalValue}
              breakdown={breakdown}
              checklist={checklist}
              canEdit={canEdit}
              updatingStatus={updatingStatus}
              onContinue={async () => {
                if (detail.room.status === "aberta") {
                  await updateRoomStatus(
                    "em_consolidacao_chefia",
                    "Coautoria encerrada. A chefia assumiu a consolidação.",
                  );
                  return;
                }
                if (detail.room.status === "em_consolidacao_chefia") {
                  if (hasReturnedContributions) {
                    toast.warning("Corrija ou confirme os itens devolvidos antes de abrir a prévia.");
                    return;
                  }
                  await updateRoomStatus(
                    "pronta_para_conversao",
                    "Consolidação concluída. Sala pronta para prévia de conversão.",
                  );
                  return;
                }
                setActiveStage("revisao");
              }}
              onSaveAndExit={() => router.push("/dfds-coletivas")}
            />
          </section>
        )}

        {activeStage === "revisao" && (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <ReviewPanel
              detail={detail}
              reviewTab={reviewTab}
              setReviewTab={setReviewTab}
              saveMetadata={saveMetadata}
              savingMeta={savingMeta}
              canEditMetadata={Boolean(detail.room.can_edit_metadata)}
              viewerUserId={viewerUserId}
            />
            <ApprovalSummary
              detail={detail}
              totalValue={totalValue}
              breakdown={breakdown}
              checklist={checklist}
              previewExpenseGroups={previewExpenseGroups}
              actorRole={detail.room.actor_role}
              canConvert={detail.room.can_convert}
              canAdvance={!detail.room.can_convert && detail.room.status === "em_consolidacao_chefia"}
              updatingStatus={updatingStatus}
              onAdvanceToReady={() =>
                updateRoomStatus(
                  "pronta_para_conversao",
                  "Sala marcada como pronta para conversão.",
                )
              }
              converting={converting}
              onConvert={convertRoom}
              onSaveAndExit={() => router.push("/dfds-coletivas")}
            />
          </section>
        )}

        {activeStage === "finalizar" && (
          <section>
            <section className="rounded-lg border border-[var(--p-color-border-muted)] bg-white p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex max-w-3xl flex-col items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--p-color-success-bg)] text-[var(--p-color-success)]">
                  <CheckCircle size={28} weight="fill" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--p-color-brand-600)]">DFD coletiva finalizada</h2>
                <p className="text-sm leading-6 text-[var(--p-color-fg-muted)]">
                  Esta sala já cumpriu o papel de reunir e consolidar a demanda. Use os links abaixo para acompanhar
                  as DFDs oficiais geradas a partir desta construção coletiva.
                </p>
                {detail.linkedDfds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.linkedDfds.map((link) => (
                      <Link
                        key={link.dfd_id}
                        href={`/dfd/${link.dfd_id}`}
                        className="rounded-md bg-[var(--p-color-info-bg)] px-4 py-2 text-sm font-semibold text-[var(--p-color-action)] no-underline"
                      >
                        {link.expense_class || "DFD"} · abrir
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </section>
        )}

        {(activeStage === "adicionar" || (activeStage === "consolidar" && canContributeInOpenRoom)) && (
          <>
            <SelectionFloatingBar
              activeCartItem={activeCartItem}
              pendingCount={cartItems.length}
              consolidatedCount={detail.items.length}
              roomStatus={detail.room.status}
              requestedCount={myRequestedContributions.length}
              canConsolidate={canConsolidateRoom}
              totalValue={totalValue}
              pendingCartValue={pendingCartValue}
              cartPulseKey={cartPulseKey}
              cartTargetRef={cartTargetRef}
              onOpen={() => {
                setSelectionDrawerSection("cart");
                setSelectionDrawerOpen(true);
              }}
              onOpenRequested={() => {
                setSelectionDrawerSection("requested");
                setSelectionDrawerOpen(true);
              }}
              onContinue={() => {
                requestConsolidationAdvance();
              }}
            />
            <FlyingCartItems
              items={flyingCartItems}
              onComplete={(id) =>
                setFlyingCartItems((current) => current.filter((item) => item.id !== id))
              }
            />
            <SelectedItemDrawer
              open={selectionDrawerOpen}
              onClose={() => setSelectionDrawerOpen(false)}
              cartItems={cartItems}
              activeCartItem={activeCartItem}
              section={selectionDrawerSection}
              setActiveCartId={setActiveCartId}
              updateActiveCartDraft={updateActiveCartDraft}
              removeCartItem={removeCartItem}
              contributions={myRequestedContributions}
              canDeleteContribution={canDeleteRequestedContribution}
              onAddMoreContribution={seedContributionInCart}
              onDeleteContribution={deleteRequestedContribution}
              itemsFromOthers={itemsFromOtherPeople}
              onRequestFromOtherItem={addAggregatedItemToCart}
              addContribution={addContribution}
              subtotal={selectedSubtotal}
              disabled={!canContributeInOpenRoom || savingCart}
              savingCart={savingCart}
              detail={detail}
              pendingCartValue={pendingCartValue}
              canConsolidate={canConsolidateRoom}
              onContinue={() => {
                requestConsolidationAdvance();
              }}
            />
          </>
        )}
        <CollectiveFlowGuideModal
          open={showCollectiveFlowGuide}
          onClose={() => setShowCollectiveFlowGuide(false)}
        />
        <ConsolidationWarningModal
          open={showConsolidationWarning}
          updating={updatingStatus}
          onClose={() => setShowConsolidationWarning(false)}
          onConfirm={() => {
            void confirmConsolidationAdvance();
          }}
        />
        <CollectiveItemGovernanceModal
          state={governanceModal}
          savingContributionId={savingContributionId}
          canEditFiscal={canEditFiscal}
          onClose={() => setGovernanceModal(null)}
          onSubmit={submitGovernanceAction}
        />
        <DeleteLockedNoticeModal
          contribution={deleteLockedNotice}
          onClose={() => setDeleteLockedNotice(null)}
        />
      </div>
    </main>
  );
}

function FlowStepper({
  activeStage,
  itemsCount,
  status,
  onStageChange,
}: {
  activeStage: FlowStage;
  itemsCount: number;
  status: RoomStatus;
  onStageChange: (stage: FlowStage) => void;
}) {
  const activeIndex = FLOW_STEPS.findIndex((step) => step.id === activeStage);
  const allowedStagesByStatus: Record<RoomStatus, FlowStage[]> = {
    proposta: ["proposta"],
    aberta: ["adicionar"],
    em_consolidacao_chefia: ["consolidar"],
    pronta_para_conversao: ["revisao"],
    convertida: ["finalizar"],
    arquivada: ["finalizar"],
  };
  const suggestedNextStageByStatus: Partial<Record<RoomStatus, FlowStage>> = {
    proposta: "adicionar",
    aberta: "consolidar",
    em_consolidacao_chefia: "revisao",
  };
  const allowedStages = allowedStagesByStatus[status] || [activeStage];
  const nextStage = FLOW_STEPS.find((step) => step.id === suggestedNextStageByStatus[status]) || null;
  const statusTone =
    status === "proposta"
      ? "border-[var(--semantic-insight-border)] bg-[var(--semantic-insight-soft)] text-[var(--semantic-insight)]"
      : status === "aberta"
      ? "border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)]"
      : status === "em_consolidacao_chefia" || status === "pronta_para_conversao"
        ? "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] text-[var(--p-color-warning)]"
      : "border-[var(--p-color-info-border)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-muted)]";
  const progressWidth =
    activeIndex <= 0 ? "0%" : `${(activeIndex / Math.max(FLOW_STEPS.length - 1, 1)) * 100}%`;

  return (
    <section className="ux-panel overflow-hidden rounded-[22px]">
      <div className="flex flex-col gap-4 px-4 py-4 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="ux-icon-collab flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]">
              <UsersThree size={20} weight="duotone" />
            </div>
            <div className="min-w-0">
              <h2 className="ux-title text-base font-semibold md:text-lg">
                Fluxo da DFD coletiva
              </h2>
              <p className="ux-muted mt-0.5 text-xs leading-5 md:text-sm">
                Sala de coautoria entre pares, homologada pela chefia.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold", statusTone)}>
              <LockSimple size={15} weight="bold" />
              {status === "proposta"
                ? "Proposta reservada"
                : status === "aberta"
                ? "Sala aberta"
                : status === "em_consolidacao_chefia"
                  ? "Consolidação da chefia"
                  : status === "pronta_para_conversao"
                    ? "Prévia pronta"
                  : status === "convertida"
                    ? "DFD oficial gerada"
                    : "Sala arquivada"}
            </span>
            {nextStage ? (
              <span className="ux-chip ux-chip-collab h-10 px-4 text-sm">
                Próxima etapa: {nextStage.title}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative rounded-[18px] border border-[var(--semantic-neutral-border)] bg-[var(--semantic-neutral-soft)] px-3 py-3">
          <div className="absolute left-[30px] right-[30px] top-[31px] hidden h-[2px] rounded-full bg-[var(--p-color-border-muted)] lg:block" />
          <motion.div
            className="absolute left-[30px] top-[31px] hidden h-[2px] rounded-full bg-[var(--semantic-collab)] lg:block"
            initial={false}
            animate={{ width: `calc(${progressWidth} - 30px)` }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {FLOW_STEPS.map((step, index) => {
              const completed =
                index < activeIndex ||
                (step.id === "proposta" && status !== "proposta") ||
                (step.id === "adicionar" && itemsCount > 0 && status !== "proposta") ||
                (step.id === "consolidar" &&
                  (status === "em_consolidacao_chefia" || status === "pronta_para_conversao" || status === "convertida")) ||
                (step.id === "revisao" && (status === "pronta_para_conversao" || status === "convertida")) ||
                (step.id === "finalizar" && status === "convertida");
              const active = step.id === activeStage;
              const allowed = allowedStages.includes(step.id);
              const clickable = allowed && !active;
              const upcoming = nextStage?.id === step.id;
              return (
                <motion.button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (!clickable) return;
                    onStageChange(step.id);
                  }}
                  disabled={!clickable}
                  aria-current={active ? "step" : undefined}
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={clickable ? { y: -2 } : undefined}
                  whileTap={clickable ? { scale: 0.985 } : undefined}
                  className={cn(
                    "group relative rounded-2xl border px-2 py-3 text-center transition",
                    active && "border-[var(--semantic-action-border)] bg-white shadow-sm",
                    upcoming && !active && "border-[var(--semantic-collab-border)] bg-[var(--semantic-collab-soft)]",
                    completed && !active && !upcoming && "border-[var(--semantic-success-border)] bg-white",
                    !active && !completed && !upcoming && "border-transparent bg-transparent",
                    clickable && "cursor-pointer hover:-translate-y-0.5 hover:bg-white hover:shadow-sm",
                    !clickable && !active && "cursor-default",
                  )}
                >
                  <motion.span
                  className={cn(
                    "relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition md:h-12 md:w-12 md:text-base",
                    active && "border-[var(--semantic-action)] bg-[var(--semantic-action)] text-white shadow-[0_8px_20px_rgba(22,64,115,0.16)]",
                    upcoming && "border-[var(--semantic-collab)] bg-white text-[var(--semantic-collab)] shadow-[0_8px_20px_rgba(31,111,120,0.12)]",
                    completed && !active && !upcoming && "border-[var(--semantic-success-border)] bg-white text-[var(--semantic-success)]",
                    !active && !completed && !upcoming && "border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-muted)]",
                    clickable && "group-hover:border-[var(--p-color-info-border)]",
                  )}
                  animate={active ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={active ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                >
                  {!allowed && step.id === "finalizar" && status !== "convertida" && status !== "arquivada" ? (
                    <LockSimple size={18} weight="bold" />
                  ) : completed && !active && !upcoming ? (
                    <CheckCircle size={18} weight="fill" />
                  ) : (
                    index + 1
                  )}
                </motion.span>
                  <span className="mt-2 block text-sm font-semibold text-[var(--p-color-brand-700)] md:text-sm">
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-full px-3 py-1 type-caption font-semibold",
                      active && "bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]",
                      upcoming && "bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)]",
                      !active && !upcoming && allowed && "bg-[var(--p-color-surface-muted)] text-[var(--p-color-fg-muted)]",
                      !allowed && "bg-[var(--p-color-surface-muted)] text-[var(--p-color-fg-muted)]",
                    )}
                  >
                    {active
                      ? "Atual"
                      : upcoming
                        ? "Próxima"
                        : allowed
                          ? "Ativa"
                          : step.id === "revisao"
                            ? "Aguardando"
                            : "Bloqueada"}
                  </span>
                  <span className={cn(
                    "mx-auto mt-2 max-w-[180px] text-xs leading-5 text-[var(--p-color-fg-muted)] md:max-w-[220px]",
                    !active && !upcoming && "hidden lg:block lg:line-clamp-1",
                  )}>
                    {step.description}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProposalPanel({
  detail,
  canPublish,
  updatingStatus,
  onPublish,
}: {
  detail: RoomDetail;
  canPublish: boolean;
  updatingStatus: boolean;
  onPublish: () => void;
}) {
  return (
    <Panel>
      <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Proposta reservada" />
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <div className="rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4 text-sm leading-6 text-[var(--p-color-fg-muted)]">
            Esta proposta ainda não está aberta para o setor. Enquanto estiver neste estado, apenas o proponente e a
            chefia conseguem vê-la.
          </div>
          <div className="grid gap-3 rounded-md border border-[var(--p-color-border-muted)] bg-white p-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)]">Descrição</p>
              <p className="mt-2 text-[var(--p-color-fg-default)]">{detail.room.description || "Sem descrição registrada."}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-muted)]">Escopo</p>
              <p className="mt-2 text-[var(--p-color-fg-default)]">{detail.room.scope || "Sem escopo registrado."}</p>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-info-bg)] p-4">
          <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Publicação da chefia</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
            Depois da publicação, a sala passa a receber contribuições dos pares. Antes disso, ela funciona apenas
            como rascunho de proposta.
          </p>
          {canPublish ? (
            <button
              type="button"
              onClick={onPublish}
              disabled={updatingStatus}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UsersThree size={17} weight="bold" />
              {updatingStatus ? "Publicando..." : "Publicar para o setor"}
            </button>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-[var(--p-color-border-strong)] bg-white p-3 text-sm text-[var(--p-color-fg-muted)]">
              Aguarde a chefia publicar esta sala para iniciar a coautoria.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function RequestedRoomItemsPanel({
  detail,
  canContribute,
  onRequestContribution,
  viewerUserId,
}: {
  detail: RoomDetail;
  canContribute: boolean;
  onRequestContribution: (item: AggregatedItem) => void;
  viewerUserId: string | null;
}) {
  return (
    <Panel className="min-h-[420px]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle icon={<Package size={18} weight="bold" />} title="Itens já solicitados na sala" />
          <p className="mt-1 text-xs font-medium text-[var(--p-color-fg-muted)]">
            Veja o que o setor já pediu nesta DFD coletiva antes de adicionar novos itens.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--p-color-brand-600)]">
          {detail.items.length} item(ns) na sala
        </div>
      </div>
      <ConsolidatedItemsTable
        items={detail.items}
        canContribute={canContribute}
        onRequestContribution={onRequestContribution}
        viewerUserId={viewerUserId}
      />
    </Panel>
  );
}

function CatalogPanel(props: {
  catalogSearch: string;
  setCatalogSearch: (value: string) => void;
  submitCatalogSearch: (event: FormEvent) => void;
  clearCatalogSearch: () => void;
  catalogItems: CatalogItem[];
  rawCatalogItems: CatalogItem[];
  catalogLoading: boolean;
  catalogQuery: string;
  cartItemKeys: Set<string>;
  activeCatalogItemKey: string | null;
  addItemToCart: (
    item: CatalogItem & { searchPosition?: number },
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  catalogPageState: ReturnType<typeof buildCollectiveCatalogPageState>;
  catalogHasMore: boolean;
  setCatalogPage: (updater: (current: number) => number) => void;
  catalogFilter: CatalogExpenseFilter;
  setCatalogFilter: (filter: CatalogExpenseFilter) => void;
  catalogTypeFilter: CatalogTypeFilter;
  setCatalogTypeFilter: (filter: CatalogTypeFilter) => void;
}) {
  const filters: Array<{ id: CatalogExpenseFilter; label: string; count?: number }> = [
    { id: "todos", label: "Todos", count: props.rawCatalogItems.length },
    { id: "corrente", label: "Corrente" },
    { id: "capital", label: "Capital" },
    { id: "consumo", label: "Material de consumo" },
    { id: "permanente", label: "Permanente" },
  ];

  return (
    <Panel className="min-h-[620px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Catálogo de itens" />
          <p className="mt-1 text-xs font-medium text-[var(--p-color-fg-muted)]">
            Pesquise por nome, código, tipo de despesa ou categoria do item.
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--p-color-brand-600)]">
          {props.rawCatalogItems.length} resultado(s) nesta página
        </div>
      </div>

      <form onSubmit={props.submitCatalogSearch} className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative min-w-0">
          <MagnifyingGlass size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-muted)]" />
          <input
            value={props.catalogSearch}
            onChange={(event) => props.setCatalogSearch(event.target.value)}
            className="h-14 w-full rounded-2xl border border-[var(--p-color-info-border)] bg-white pl-12 pr-11 text-sm font-semibold text-[var(--p-color-fg)] outline-none transition focus:border-[var(--p-color-action)] focus:ring-4 focus:ring-[var(--p-color-info-border)]/45"
            placeholder="Buscar por código, descrição, SIAD, classe ou termo comum..."
          />
          {props.catalogSearch && (
            <button
              type="button"
              onClick={props.clearCatalogSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-muted)]"
              aria-label="Limpar busca"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={props.clearCatalogSearch}
          className="h-14 rounded-2xl border border-[var(--p-color-border-strong)] bg-white px-5 text-sm font-bold text-[var(--p-color-brand-600)] transition hover:bg-[var(--p-color-surface-soft)]"
        >
          Limpar
        </button>
        <button
          type="submit"
          className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--p-color-action)] px-6 text-sm font-bold text-white shadow-lg shadow-[var(--p-color-action)]/18 transition hover:bg-[var(--p-color-brand-700)]"
        >
          <MagnifyingGlass size={16} weight="bold" /> Buscar
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => props.setCatalogFilter(filter.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-bold uppercase tracking-wider transition",
              props.catalogFilter === filter.id
                ? "border-[var(--p-color-action)] bg-[var(--p-color-action)] text-white shadow-md shadow-[var(--p-color-action)]/15"
                : "border-[var(--p-color-border)] bg-white text-[var(--p-color-fg-default)] hover:border-[var(--p-color-info-border)] hover:bg-[var(--p-color-info-bg)]",
            )}
          >
            {filter.label}
            {typeof filter.count === "number" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  props.catalogFilter === filter.id ? "bg-white/20" : "bg-[var(--p-color-surface-muted)]",
                )}
              >
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-2">
        <span className="px-2 text-xs font-bold text-[var(--p-color-fg-muted)]">Tipo de item:</span>
        {([
          ["todos", "Todos"],
          ["material", "Material"],
          ["servico", "Serviço"],
        ] as Array<[CatalogTypeFilter, string]>).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => props.setCatalogTypeFilter(id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition",
              props.catalogTypeFilter === id
                ? "bg-[var(--p-color-action)] text-white"
                : "bg-white text-[var(--p-color-fg-muted)] hover:text-[var(--p-color-action)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-2 text-xs text-[var(--p-color-fg-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span className="font-semibold">{props.catalogItems.length} resultado(s) exibidos</span>
        <span className="inline-flex items-center gap-1">
          Ordenar por: <strong className="text-[var(--p-color-fg)]">Relevância</strong>{" "}
          <CaretDown size={13} weight="bold" />
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {props.catalogLoading && (
          <div className="rounded-2xl border border-[var(--p-color-border)] bg-[var(--p-color-surface-soft)] p-4 text-sm font-semibold text-[var(--p-color-fg-muted)]">
            Buscando catálogo...
          </div>
        )}
        {props.catalogItems.map((item, index) => {
          const expenseBadge = getCatalogExpenseBadge(
            item.gnd_preferencial ||
              deriveGndFromNatureza(item.codigo_natureza_preferencial),
          );
          const display = summarizeCollectiveCatalogItemForDisplay(item);
          const itemKey = getCatalogItemKey(item);
          const selected = props.cartItemKeys.has(itemKey);
          const active = props.activeCatalogItemKey === itemKey;
          return (
            <button
              key={`${item.id}-${item.codigo_efisco || item.codigo_tce}`}
              type="button"
              onClick={(event) => props.addItemToCart({ ...item, searchPosition: index }, event)}
              className={cn(
                "group relative overflow-hidden rounded-[24px] border p-4 text-left transition-all",
                active
                  ? "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] shadow-[0_0_0_1px_#0B63CE,0_18px_42px_rgba(11,99,206,0.12)]"
                  : selected
                    ? "border-[#7DB8FF] bg-[var(--p-color-info-bg)] shadow-sm"
                    : "border-[var(--p-color-border-muted)] bg-white hover:border-[var(--p-color-info-border)] hover:bg-[var(--p-color-bg-elevated)] hover:shadow-lg hover:shadow-[var(--p-color-brand-500)]/8",
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className={cn("min-w-0 flex-1 space-y-3", selected && "lg:pr-8")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--p-color-brand-500)]/15 bg-[var(--p-color-info-bg)] px-3 py-1.5 text-[var(--p-color-brand-500)]">
                      <Hash size={12} weight="bold" />
                      <span className="type-kicker font-bold uppercase tracking-widest">
                        Código e-Fisco
                      </span>
                      <span className="font-mono text-xs font-bold tracking-tight">
                        {display.code}
                      </span>
                    </span>
                    <span className={cn("rounded-full border px-3 py-1.5 type-kicker font-bold uppercase tracking-widest", expenseBadge.className)}>
                      {expenseBadge.label}
                    </span>
                    {selected && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--p-color-info-border)] bg-white px-3 py-1.5 type-kicker font-bold uppercase tracking-widest text-[var(--p-color-action)] shadow-sm">
                        <ShoppingCart size={12} weight="fill" /> No carrinho
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="font-display text-sm font-bold leading-snug text-[var(--p-color-brand-700)] transition-colors group-hover:text-[var(--p-color-action)]">
                      {display.term}
                    </p>
                    {display.hasDetails && (
                      <p className="text-xs font-medium leading-relaxed text-[var(--p-color-fg-default)]">
                        {display.details}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 type-caption font-semibold text-[var(--p-color-fg-muted)]">
                    <span className="rounded-xl bg-[var(--p-color-surface-muted)] px-3 py-1.5">
                      {display.classLabel}
                    </span>
                    <span className="rounded-xl bg-[var(--p-color-surface-muted)] px-3 py-1.5">
                      {expenseBadge.detail}
                    </span>
                    <span className="rounded-xl bg-[var(--p-color-surface-muted)] px-3 py-1.5">
                      {display.typeLabel}
                    </span>
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center justify-center rounded-2xl px-4 text-xs font-bold transition",
                    selected
                      ? "bg-[var(--p-color-collab-bg)] text-[var(--p-color-collab)]"
                      : "bg-[var(--p-color-action)] text-white group-hover:bg-[var(--p-color-action)]",
                  )}
                >
                  {selected ? "Selecionado" : "Adicionar"}
                </span>
              </div>
            </button>
          );
        })}
        {!props.catalogLoading && props.catalogQuery && props.catalogItems.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-bg-elevated)] p-8 text-center text-sm text-[var(--p-color-fg-muted)]">
            {props.catalogPageState.hasPrevious ? (
              <>
                Nenhum resultado nesta página.
                <button
                  type="button"
                  onClick={() => props.setCatalogPage(() => 0)}
                  className="mt-3 block mx-auto rounded-xl border border-[var(--p-color-border-strong)] bg-white px-4 py-2 text-xs font-bold text-[var(--p-color-action)] hover:bg-[var(--p-color-info-bg)]"
                >
                  Voltar para a página 1
                </button>
              </>
            ) : (
              "Nenhum item encontrado. Tente termos mais gerais, parte do código e-Fisco ou uma palavra da classe."
            )}
          </div>
        )}
        {(props.catalogPageState.hasPrevious || props.catalogHasMore || props.rawCatalogItems.length > 0) && (
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-[var(--p-color-fg-muted)]">
              Página {props.catalogPageState.displayPage} · {props.rawCatalogItems.length} resultado(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => props.setCatalogPage((current) => Math.max(0, current - 1))}
                disabled={!props.catalogPageState.hasPrevious || props.catalogLoading}
                className="rounded-xl border border-[var(--p-color-border-strong)] bg-white px-4 py-2 text-xs font-bold text-[var(--p-color-action)] transition hover:bg-[var(--p-color-info-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => props.setCatalogPage((current) => current + 1)}
                disabled={!props.catalogHasMore || props.catalogLoading}
                className="rounded-xl border border-[var(--p-color-border-strong)] bg-white px-4 py-2 text-xs font-bold text-[var(--p-color-action)] transition hover:bg-[var(--p-color-info-bg)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

function PulsingCtaButton({
  pulse = false,
  className,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pulse?: boolean;
}) {
  const shouldPulse = Boolean(pulse && !disabled);

  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        className,
        shouldPulse &&
          "motion-safe:animate-pulse motion-reduce:animate-none ring-2 ring-[var(--p-color-action)]/20 ring-offset-2 ring-offset-white",
      )}
    >
      {children}
    </button>
  );
}

function SelectionFloatingBar({
  activeCartItem,
  pendingCount,
  consolidatedCount,
  roomStatus,
  requestedCount,
  canConsolidate,
  totalValue,
  pendingCartValue,
  cartPulseKey,
  cartTargetRef,
  onOpen,
  onOpenRequested,
  onContinue,
}: {
  activeCartItem: CartDraftItem | null;
  pendingCount: number;
  consolidatedCount: number;
  roomStatus: string;
  requestedCount: number;
  canConsolidate: boolean;
  totalValue: number;
  pendingCartValue: number;
  cartPulseKey: number;
  cartTargetRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onOpenRequested: () => void;
  onContinue: () => void;
}) {
  const hasPendingItems = pendingCount > 0;
  const visible = hasPendingItems || consolidatedCount > 0;
  const title = hasPendingItems
    ? `${pendingCount} item(ns) no carrinho`
    : `${consolidatedCount} item(ns) na DFD coletiva`;
  const description = hasPendingItems
    ? `Pronto para revisar e enviar: ${formatCurrency(pendingCartValue)}`
    : `Total dos pedidos enviados: ${formatCurrency(totalValue)}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-x-0 bottom-5 z-[60] px-4"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-full border border-[var(--p-color-border-muted)] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center sm:justify-between">
            <button
              ref={cartTargetRef}
              type="button"
              onClick={onOpen}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-4 py-2 text-left transition hover:bg-[var(--p-color-surface-soft)]"
            >
              <motion.span
                key={cartPulseKey}
                initial={{ scale: 0.92, rotate: 0 }}
                animate={{ scale: [0.92, 1.14, 1], rotate: [0, -8, 6, 0] }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--p-color-info-bg)] text-[var(--p-color-action)]"
              >
                <ShoppingCart size={20} weight="fill" />
                {hasPendingItems && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--p-color-action)] px-1 type-kicker font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </motion.span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--p-color-fg)]">
                  {activeCartItem ? activeCartItem.item.descricao : title}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--p-color-fg-muted)]">
                  {activeCartItem
                    ? `${description} · Editando item selecionado`
                    : description}
                </span>
                <span className="mt-1 block text-xs text-[var(--p-color-fg-muted)]">
                  {collectiveContinueAction(canConsolidate, roomStatus, pendingCount).hint}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 gap-2 px-1 pb-1 sm:pb-0">
              <button
                type="button"
                onClick={onOpenRequested}
                className="h-10 rounded-full border border-[var(--p-color-border-strong)] px-4 text-sm font-semibold text-[var(--p-color-action)] transition hover:bg-[var(--p-color-info-bg)]"
              >
                Já solicitados ({requestedCount})
              </button>
              <button
                type="button"
                onClick={onOpen}
                className="h-10 rounded-full border border-[var(--p-color-border-strong)] px-4 text-sm font-semibold text-[var(--p-color-action)] transition hover:bg-[var(--p-color-info-bg)]"
              >
                {hasPendingItems ? "Revisar" : "Ver resumo"}
              </button>
              <PulsingCtaButton
                type="button"
                onClick={onContinue}
                disabled={canConsolidate && consolidatedCount === 0 && pendingCount === 0}
                title={collectiveContinueAction(canConsolidate, roomStatus, pendingCount).hint}
                pulse
                className="h-10 rounded-full bg-[var(--p-color-action)] px-5 text-sm font-semibold text-white transition hover:bg-[#083A7E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {collectiveContinueAction(canConsolidate, roomStatus, pendingCount).label}
              </PulsingCtaButton>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FlyingCartItems({
  items,
  onComplete,
}: {
  items: FlyingCartItem[];
  onComplete: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {items.map((item) => (
        <motion.div
          key={item.id}
          initial={{
            opacity: 0,
            scale: 0.78,
            x: item.startX,
            y: item.startY,
          }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [0.78, 1, 0.82, 0.38],
            x: [item.startX, (item.startX + item.endX) / 2, item.endX],
            y: [item.startY, Math.min(item.startY, item.endY) - 120, item.endY],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => onComplete(item.id)}
          className="pointer-events-none fixed left-0 top-0 z-[75]"
        >
          <motion.div
            initial={{ opacity: 0.45, scaleX: 0.6 }}
            animate={{ opacity: [0.45, 0.2, 0], scaleX: [0.6, 1.6, 2.2] }}
            transition={{ duration: 0.74, ease: "easeOut" }}
            className="absolute -left-10 top-1/2 h-1 w-12 -translate-y-1/2 rounded-full bg-gradient-to-r from-[var(--p-color-action)] to-transparent blur-[1px]"
          />
          <div className="max-w-[240px] truncate rounded-full border border-[var(--p-color-info-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--p-color-brand-600)] shadow-[0_12px_28px_rgba(11,74,162,0.2)]">
            + {item.label}
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function SelectedItemDrawer({
  open,
  onClose,
  cartItems,
  activeCartItem,
  section,
  setActiveCartId,
  updateActiveCartDraft,
  removeCartItem,
  contributions,
  canDeleteContribution,
  onAddMoreContribution,
  onDeleteContribution,
  itemsFromOthers,
  onRequestFromOtherItem,
  addContribution,
  subtotal,
  disabled,
  savingCart,
  detail,
  pendingCartValue,
  canConsolidate,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  cartItems: CartDraftItem[];
  activeCartItem: CartDraftItem | null;
  section: "cart" | "requested";
  setActiveCartId: (cartId: string) => void;
  updateActiveCartDraft: (update: SetStateAction<ContributionDraft>) => void;
  removeCartItem: (cartId: string) => void;
  contributions: Contribution[];
  canDeleteContribution: boolean;
  onAddMoreContribution: (contribution: Contribution) => void;
  onDeleteContribution: (contribution: Contribution) => void;
  itemsFromOthers: AggregatedItem[];
  onRequestFromOtherItem: (item: AggregatedItem) => void;
  addContribution: (event: FormEvent) => void;
  subtotal: number;
  disabled: boolean;
  savingCart: boolean;
  detail: RoomDetail;
  pendingCartValue: number;
  canConsolidate: boolean;
  onContinue: () => void;
}) {
  const cartSectionRef = useRef<HTMLDivElement | null>(null);
  const requestedSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const target = section === "requested" ? requestedSectionRef.current : cartSectionRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [open, section]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-[var(--p-color-fg)]/35 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: 560 }}
            animate={{ x: 0 }}
            exit={{ x: 560 }}
            transition={{ type: "spring", damping: 30, stiffness: 290 }}
            className="fixed right-0 top-0 z-[80] flex h-screen w-full max-w-[540px] flex-col border-l border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] shadow-2xl"
          >
            <div className="flex h-[82px] items-center justify-between border-b border-[var(--p-color-border-muted)] bg-white px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--p-color-fg-muted)]">
                  Apoio de preenchimento
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--p-color-brand-600)]">
                  Sua seleção nesta sala
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar seleção"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--p-color-border-strong)] bg-white text-[var(--p-color-action)] transition hover:bg-[var(--p-color-info-bg)]"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-[var(--p-color-border-muted)] bg-white px-5 py-4">
              <DrawerMetric label="No carrinho" value={cartItems.length} />
              <DrawerMetric label="Subtotal pendente" value={formatCurrency(pendingCartValue)} />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <section ref={cartSectionRef} className="rounded-lg border border-[var(--p-color-border-muted)] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <SectionTitle icon={<ShoppingCart size={18} weight="fill" />} title="Itens no carrinho" />
                {cartItems.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-bg-elevated)] p-4 text-center text-sm text-[var(--p-color-fg-muted)]">
                    Escolha itens no catálogo para montar o carrinho antes de enviar.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2">
                    <AnimatePresence initial={false}>
                      {cartItems.map((cartItem) => {
                        const active = activeCartItem?.cartId === cartItem.cartId;
                        return (
                          <motion.div
                            key={cartItem.cartId}
                            layout
                            initial={{ opacity: 0, x: 24, scale: 0.98 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 24, scale: 0.98 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className={cn(
                              "grid grid-cols-[1fr_auto] gap-3 rounded-md border p-3 transition",
                              active
                                ? "border-[var(--p-color-action)] bg-[var(--p-color-info-bg)] shadow-[0_0_0_1px_#0B63CE]"
                                : "border-[var(--p-color-border-muted)] bg-white hover:border-[var(--p-color-info-border)]",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveCartId(cartItem.cartId)}
                              className="min-w-0 text-left"
                            >
                              <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--p-color-brand-600)]">
                                {cartItem.item.descricao}
                              </p>
                              <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                                Qtd. {cartItem.quantidade} · {formatCurrency(getDraftSubtotal(cartItem))}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCartItem(cartItem.cartId)}
                              aria-label="Remover item do carrinho"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--p-color-danger)] transition hover:bg-[var(--p-color-danger-bg)]"
                            >
                              <X size={15} weight="bold" />
                            </button>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </section>

              <section ref={requestedSectionRef} className="mt-4 rounded-lg border border-[var(--p-color-border-muted)] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <SectionTitle icon={<UsersThree size={18} weight="bold" />} title="Itens já solicitados por você" />
                {contributions.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-bg-elevated)] p-4 text-center text-sm text-[var(--p-color-fg-muted)]">
                    Você ainda não solicitou itens nesta sala.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[var(--p-color-surface-muted)]">
                    {contributions.map((contribution) => (
                      <div key={contribution.id} className="py-3">
                        <div className="flex items-start gap-3">
                          <UserAvatar
                            name={contribution.user_name || contribution.user_email || "Usuário"}
                            avatarUrl={contribution.user_avatar_url || null}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--p-color-fg)]">
                              {contribution.descricao}
                            </p>
                            <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                              Minha quantidade: {contribution.quantidade} · Valor unit.: {formatCurrency(contribution.valor_unitario_estimado)}
                            </p>
                            <p className="mt-1 type-caption text-[#8A94A6]">
                              {formatDateTime(contribution.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onAddMoreContribution(contribution)}
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--p-color-border-strong)] bg-white px-3 text-xs font-semibold text-[var(--p-color-action)] hover:bg-[var(--p-color-surface-muted)]"
                          >
                            <Plus size={13} weight="bold" />
                            Adicionar mais
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteContribution(contribution)}
                            className={cn(
                              "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-semibold",
                              canDeleteContribution
                                ? "border-[#F4C7C3] bg-white text-[var(--p-color-danger)] hover:bg-[var(--p-color-danger-bg)]"
                                : "border-[#D5DCE6] bg-[var(--p-color-surface-soft)] text-[var(--p-color-fg-muted)]",
                            )}
                          >
                            <Trash size={13} weight="bold" />
                            {canDeleteContribution ? "Excluir solicitação" : "Bloqueado para usuário comum"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <SelectedItemPanel
                cartItem={activeCartItem}
                setContributionDraft={updateActiveCartDraft}
                addContribution={addContribution}
                subtotal={subtotal}
                disabled={disabled}
                savingCart={savingCart}
                cartCount={cartItems.length}
              />

              <section className="mt-4 rounded-lg border border-[var(--p-color-border-muted)] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <SectionTitle icon={<Package size={18} weight="bold" />} title="Itens adicionados por outras pessoas" />
                {itemsFromOthers.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-bg-elevated)] p-4 text-center text-sm text-[var(--p-color-fg-muted)]">
                    Ainda não há itens de outros participantes para complementar.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[var(--p-color-surface-muted)]">
                    {itemsFromOthers.slice(0, 6).map((item) => {
                      const key = `${item.codigo_item_efisco || item.codigo_tce}-${item.gnd || item.gnd_derivado}`;
                      const expenseBadge = getCatalogExpenseBadge(
                        item.gnd || item.gnd_derivado || item.codigo_natureza_despesa,
                      );
                      return (
                        <div key={key} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--p-color-fg)]">
                              {item.descricao}
                            </p>
                            <button
                              type="button"
                              onClick={() => onRequestFromOtherItem(item)}
                              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-[var(--p-color-border-strong)] bg-white px-3 text-xs font-semibold text-[var(--p-color-action)] hover:bg-[var(--p-color-surface-muted)]"
                            >
                              <Plus size={13} weight="bold" />
                              Adicionar minha quantidade
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                            Qtd. {item.quantidade} · Tipo: {expenseBadge.label}
                          </p>
                          {item.contributors && item.contributors.length > 0 ? (
                            <AvatarStack
                              members={item.contributors.map((contributor) => ({
                                id: contributor.user_id,
                                name: contributor.user_name || contributor.user_email || "Usuário",
                                email: contributor.user_email || null,
                                avatarUrl: contributor.user_avatar_url || null,
                              }))}
                              total={item.contributors.length}
                              label={`${item.contributors.length} participante(s) neste item`}
                              size="sm"
                              className="mt-2"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                    {itemsFromOthers.length > 6 && (
                      <p className="pt-3 text-xs font-semibold text-[var(--p-color-action)]">
                        + {itemsFromOthers.length - 6} item(ns) de outros participantes
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="border-t border-[var(--p-color-border-muted)] bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <form onSubmit={addContribution}>
                  <button
                    type="submit"
                    disabled={disabled || cartItems.length === 0}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] text-sm font-semibold text-white transition hover:bg-[#083A7E] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCart ? "Enviando..." : "Enviar itens para a sala"} <Plus size={17} weight="bold" />
                  </button>
                </form>
                <PulsingCtaButton
                  type="button"
                  onClick={onContinue}
                  disabled={canConsolidate && detail.items.length === 0 && cartItems.length === 0}
                  title={collectiveContinueAction(canConsolidate, detail.room.status, cartItems.length).hint}
                  pulse
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--p-color-border-strong)] bg-white text-sm font-semibold text-[var(--p-color-action)] transition hover:bg-[var(--p-color-info-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {collectiveContinueAction(canConsolidate, detail.room.status, cartItems.length).label} <ArrowRight size={17} weight="bold" />
                </PulsingCtaButton>
              </div>
              <p className="mt-3 text-center text-xs text-[var(--p-color-fg-muted)]">
                {collectiveContinueAction(canConsolidate, detail.room.status, cartItems.length).hint}
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerMetric({ label, value }: { label: string; value: ReactNode }) {
  const shouldAnimateValue = typeof value === "string" || typeof value === "number";

  return (
    <div className="rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3">
      <p className="text-xs text-[var(--p-color-fg-muted)]">{label}</p>
      <p className="mt-1 min-w-0 overflow-visible text-base font-semibold text-[var(--p-color-fg)]">
        {shouldAnimateValue ? <MechanicalValue value={value} /> : value}
      </p>
    </div>
  );
}

function CollectiveFlowGuideModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[85] bg-[var(--p-color-fg)]/45"
          />
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[90] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--p-color-border-muted)] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.25)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--p-color-brand-600)]">Como funciona a sala coletiva</h3>
                <p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">
                  Fluxo curto para participação em equipe e consolidação pela chefia.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--p-color-border-strong)] text-[var(--p-color-action)]"
                aria-label="Fechar guia"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <ol className="mt-5 grid gap-3">
              <li className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-3 text-sm text-[var(--p-color-fg-default)]">
                <strong className="text-[var(--p-color-fg)]">1. Sala aberta:</strong> os membros adicionam itens e justificativas.
              </li>
              <li className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-3 text-sm text-[var(--p-color-fg-default)]">
                <strong className="text-[var(--p-color-fg)]">2. Consolidar:</strong> a chefia encerra coautoria e valida o recorte final.
              </li>
              <li className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-3 text-sm text-[var(--p-color-fg-default)]">
                <strong className="text-[var(--p-color-fg)]">3. Prévia:</strong> revisão final antes de gerar as DFDs oficiais.
              </li>
              <li className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-3 text-sm text-[var(--p-color-fg-default)]">
                <strong className="text-[var(--p-color-fg)]">4. Conversão:</strong> emissão das DFDs e registro completo no histórico.
              </li>
            </ol>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

function ConsolidationWarningModal({
  open,
  updating,
  onClose,
  onConfirm,
}: {
  open: boolean;
  updating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[85] bg-[var(--p-color-fg)]/45"
          />
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[90] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--semantic-warning-border)] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.25)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="consolidation-warning-title"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--semantic-warning-soft)] text-[var(--p-color-warning)]">
                <ShieldWarning size={22} weight="fill" />
              </span>
              <div className="min-w-0">
                <h3
                  id="consolidation-warning-title"
                  className="text-lg font-semibold text-[var(--p-color-brand-600)]"
                >
                  Encerrar coautoria e consolidar?
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                  Depois de consolidar, a sala não volta automaticamente para a etapa anterior. Os participantes
                  deixam de adicionar itens e a chefia assume a revisão do recorte final.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                disabled={updating}
                className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--p-color-border-strong)] bg-white px-4 text-sm font-semibold text-[var(--p-color-action)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={updating}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updating ? "Consolidando..." : "Sim, consolidar"}
                <ArrowRight size={17} weight="bold" />
              </button>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

function DeleteLockedNoticeModal({
  contribution,
  onClose,
}: {
  contribution: Contribution | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {contribution && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[95] bg-[var(--p-color-fg)]/45"
          />
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[100] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#F0D5D1] bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--p-color-danger-bg)] text-[var(--p-color-danger)]">
                <ShieldWarning size={20} weight="fill" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[var(--p-color-danger)]">Solicitação bloqueada</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">
                  Após solicitar um item, ele fica protegido. Apenas <strong>admin/superadmin</strong> pode excluir.
                </p>
                <p className="mt-2 line-clamp-2 text-xs text-[#7C8798]">
                  Item: {contribution.descricao}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-[var(--p-color-action)] px-4 text-sm font-semibold text-white"
            >
              Entendi
            </button>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

function SelectedItemPanel({
  cartItem,
  setContributionDraft,
  addContribution,
  subtotal,
  disabled,
  savingCart,
  cartCount,
}: {
  cartItem: CartDraftItem | null;
  setContributionDraft: Dispatch<SetStateAction<ContributionDraft>>;
  addContribution: (event: FormEvent) => void;
  subtotal: number;
  disabled: boolean;
  savingCart: boolean;
  cartCount: number;
}) {
  const selectedItem = cartItem?.item || null;
  const contributionDraft: ContributionDraft =
    cartItem || {
      quantidade: 1,
      valor_unitario_estimado: "",
      unidade_medida: selectedItem?.unidade_medida || "UN",
      link_referencia: "",
      justificativa_item: "",
      justificativa_quantidade: "",
    };
  const badge = selectedItem
    ? getCatalogExpenseBadge(
        selectedItem.gnd_preferencial ||
          deriveGndFromNatureza(selectedItem.codigo_natureza_preferencial),
      )
    : null;

  return (
    <Panel>
      <SectionTitle icon={<CheckCircle size={18} weight="fill" />} title="Item selecionado" />
      <form onSubmit={addContribution} className="mt-4">
        <div className="rounded-md border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4">
          {selectedItem ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-5 text-[var(--p-color-brand-600)]">
                  {selectedItem.descricao}
                </p>
                {badge && (
                  <span className={cn("rounded-full border px-2 py-1 type-kicker font-semibold uppercase", badge.className)}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-[var(--p-color-fg-muted)]">
                Código: {selectedItem.codigo_efisco || selectedItem.codigo_tce || selectedItem.id}
              </p>
              <p className="mt-2 text-xs text-[var(--p-color-fg-muted)]">
                Categoria: {selectedItem.nome_classe || selectedItem.classe || selectedItem.nome_grupo || selectedItem.grupo || "Sem categoria"}
              </p>
              <p className="mt-2 text-xs text-[var(--p-color-fg-muted)]">Tipo de despesa: {badge?.detail || "Não informado"}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--p-color-fg-muted)]">Selecione um item do catálogo para preencher a contribuição.</p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            Quantidade <span className="text-[var(--p-color-danger)]">*</span>
            <div className="mt-2 grid h-11 grid-cols-[42px_1fr_42px] rounded-md border border-[var(--p-color-border-strong)] bg-white">
              <button
                type="button"
                onClick={() =>
                  setContributionDraft((current) => ({
                    ...current,
                    quantidade: Math.max(1, Number(current.quantidade || 1) - 1),
                  }))
                }
                className="text-lg text-[var(--p-color-brand-600)]"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                value={contributionDraft.quantidade}
                onChange={(event) =>
                  setContributionDraft((current) => ({
                    ...current,
                    quantidade: Number(event.target.value || 1),
                  }))
                }
                className="w-full border-x border-[var(--p-color-border-muted)] text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setContributionDraft((current) => ({
                    ...current,
                    quantidade: Number(current.quantidade || 0) + 1,
                  }))
                }
                className="text-lg text-[var(--p-color-brand-600)]"
              >
                +
              </button>
            </div>
          </label>
          <label className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            Valor unitário (R$) <span className="text-[var(--p-color-danger)]">*</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={contributionDraft.valor_unitario_estimado}
              onChange={(event) =>
                setContributionDraft((current) => ({
                  ...current,
                  valor_unitario_estimado: event.target.value,
                }))
              }
              className="mt-2 h-11 w-full rounded-md border border-[var(--p-color-border-strong)] px-4 text-sm outline-none focus:border-[var(--p-color-action)]"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            Unidade <span className="text-[var(--p-color-danger)]">*</span>
            <select value={contributionDraft.unidade_medida} onChange={(event) => setContributionDraft((current) => ({ ...current, unidade_medida: event.target.value }))} className="mt-2 h-11 w-full rounded-md border border-[var(--p-color-border-strong)] px-4 text-sm outline-none focus:border-[var(--p-color-action)]">
              {['UN', 'CX', 'PCT', 'KG', 'L', 'M', 'M2', 'M3'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
          <p className="text-xs text-[var(--p-color-fg-muted)]">Subtotal</p>
          <p className="mt-1 text-lg font-semibold text-[var(--p-color-fg)]">{formatCurrency(subtotal)}</p>
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--p-color-fg-default)]">
          Link de referência
          <div className="relative mt-2">
            <LinkSimple size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-muted)]" />
            <input
              value={contributionDraft.link_referencia}
              onChange={(event) =>
                setContributionDraft((current) => ({
                  ...current,
                  link_referencia: event.target.value,
                }))
              }
              className="h-11 w-full rounded-md border border-[var(--p-color-border-strong)] pl-11 pr-4 text-sm outline-none focus:border-[var(--p-color-action)]"
              placeholder="https://..."
            />
          </div>
        </label>

        <label className="mt-4 block text-sm font-semibold text-[var(--p-color-fg-default)]">
          Justificativa <span className="text-[var(--p-color-danger)]">*</span>
          <textarea
            value={contributionDraft.justificativa_item}
            onChange={(event) =>
              setContributionDraft((current) => ({
                ...current,
                justificativa_item: event.target.value.slice(0, 500),
              }))
            }
            rows={5}
            required
            className="mt-2 w-full resize-none rounded-md border border-[var(--p-color-border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--p-color-action)]"
            placeholder="Informe a finalidade, o setor beneficiado e o critério da quantidade estimada para este item."
          />
          <span className="mt-1 block text-xs font-normal text-[var(--p-color-fg-muted)]">
            {contributionDraft.justificativa_item.length}/500 caracteres
          </span>
        </label>

        <label className="mt-4 block text-sm font-semibold text-[var(--p-color-fg-default)]">
          Como chegou à quantidade? <span className="font-normal normal-case tracking-normal text-[var(--p-color-fg-muted)]">(opcional)</span>
          <textarea value={contributionDraft.justificativa_quantidade} onChange={(event) => setContributionDraft((current) => ({ ...current, justificativa_quantidade: event.target.value.slice(0, 4000) }))} rows={3} className="mt-2 w-full resize-none rounded-md border border-[var(--p-color-border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--p-color-action)]" placeholder="Se souber, explique pessoas, consumo, período, estoque ou embalagem." />
        </label>

        <button
          type="submit"
          disabled={disabled || cartCount === 0}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={17} weight="bold" /> {savingCart ? "Enviando..." : "Enviar carrinho para a sala"}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--p-color-fg-muted)]">
          Todos os itens preenchidos do carrinho serao incluidos em Itens consolidados.
        </p>
      </form>
    </Panel>
  );
}

function ConsolidationPanel({
  detail,
  canContribute,
  canManageConsolidation,
  canEditFiscal,
  updatingStatus,
  savingContributionId,
  hasReturnedContributions,
  returnInstructionsByContributionId,
  onRequestContribution,
  onOpenGovernanceAction,
  onSaveReturnedCorrection,
  onContinue,
  viewerUserId,
}: {
  detail: RoomDetail;
  canContribute: boolean;
  canManageConsolidation: boolean;
  canEditFiscal: boolean;
  updatingStatus: boolean;
  savingContributionId: string | null;
  hasReturnedContributions: boolean;
  returnInstructionsByContributionId: Map<string, ReturnInstruction>;
  onRequestContribution: (item: AggregatedItem) => void;
  onOpenGovernanceAction: (mode: GovernanceActionMode, item: AggregatedItem) => void;
  onSaveReturnedCorrection: (event: FormEvent<HTMLFormElement>, contributionId: string) => void;
  onContinue: () => void;
  viewerUserId: string | null;
}) {
  const returnedContributions = detail.contributions.filter(
    (contribution) =>
      contribution.user_id === viewerUserId &&
      String(contribution.status || "") === "devolvida",
  );
  const returnedContributionKeys = useMemo(
    () =>
      new Set(
        detail.contributions
          .filter((contribution) => String(contribution.status || "") === "devolvida")
          .map((contribution) => buildCollectiveContributionKey(contribution)),
      ),
    [detail.contributions],
  );
  const correctionComparisonsByContributionId = useMemo(() => {
    const comparisons = new Map<string, CorrectionComparison>();
    for (const event of detail.events) {
      const comparison = readCorrectionComparison(event);
      if (!comparison || comparisons.has(comparison.contributionId)) continue;
      comparisons.set(comparison.contributionId, comparison);
    }
    return comparisons;
  }, [detail.events]);
  const correctedContributions = detail.contributions.filter((contribution) => {
    const wasCorrected = detail.events.some(
      (event) =>
        event.event_type === "contribution_corrected" &&
        event.metadata?.contribution_id === contribution.id,
    );
    return wasCorrected && String(contribution.status || "") === "aberta";
  });

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Itens consolidados" />
          <p className="mt-2 text-xs text-[var(--p-color-fg-muted)]">
            A coautoria já foi encerrada. Agora a chefia consolida, ajusta e decide o que segue para a prévia de conversão.
          </p>
        </div>
        {canManageConsolidation && detail.room.status === "em_consolidacao_chefia" ? (
          <div className="w-full rounded-2xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4 lg:max-w-[320px]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--p-color-action)]">
              Ação da chefia
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-default)]">
              Confira o recorte consolidado e avance para a prévia antes de gerar a DFD oficial.
            </p>
            <PulsingCtaButton
              type="button"
              onClick={onContinue}
              disabled={updatingStatus || detail.items.length === 0 || hasReturnedContributions}
              pulse
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {updatingStatus ? "Avançando..." : "Concluir consolidação e abrir prévia"}
              <ArrowRight size={17} weight="bold" />
            </PulsingCtaButton>
            {hasReturnedContributions ? (
              <p className="mt-2 text-xs leading-5 text-[var(--p-color-warning)]">
                Há item devolvido para correção. Confirme ou aguarde o ajuste antes de abrir a prévia.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <CorrectedContributionReviewPanel
        contributions={correctedContributions}
        correctionComparisonsByContributionId={correctionComparisonsByContributionId}
        canManageConsolidation={canManageConsolidation}
        onOpenGovernanceAction={onOpenGovernanceAction}
      />
      <ReturnedContributionCorrectionPanel
        contributions={returnedContributions}
        savingContributionId={savingContributionId}
        returnInstructionsByContributionId={returnInstructionsByContributionId}
        onSaveCorrection={onSaveReturnedCorrection}
      />
      <ConsolidatedItemsTable
        items={detail.items}
        canContribute={canContribute}
        canManageConsolidation={canManageConsolidation}
        canEditFiscal={canEditFiscal}
        returnedContributionKeys={returnedContributionKeys}
        onRequestContribution={onRequestContribution}
        onOpenGovernanceAction={onOpenGovernanceAction}
        viewerUserId={viewerUserId}
      />
    </Panel>
  );
}

function CorrectedContributionReviewPanel({
  contributions,
  correctionComparisonsByContributionId,
  canManageConsolidation,
  onOpenGovernanceAction,
}: {
  contributions: Contribution[];
  correctionComparisonsByContributionId: Map<string, CorrectionComparison>;
  canManageConsolidation: boolean;
  onOpenGovernanceAction: (mode: GovernanceActionMode, item: AggregatedItem) => void;
}) {
  if (!canManageConsolidation || contributions.length === 0) return null;

  return (
    <section className="mt-5 rounded-xl border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle icon={<CheckCircle size={18} weight="bold" />} title="Correções recebidas" />
          <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
            Itens devolvidos que já foram corrigidos e precisam de nova decisão da chefia.
          </p>
        </div>
        <span className="rounded-full border border-[var(--p-color-info-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--p-color-action)]">
          {contributions.length} para revisar
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {contributions.map((contribution) => {
          const comparison = correctionComparisonsByContributionId.get(contribution.id);
          return (
            <div
              key={contribution.id}
              className="rounded-lg border border-[var(--p-color-border-muted)] bg-white p-3"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--p-color-fg)]">
                    {contribution.descricao}
                  </p>
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                    {contribution.user_name || contribution.user_email || "Participante"} reenviou a correção.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[var(--p-color-action)]">
                    Qtd. {contribution.quantidade} · Valor unit.: {formatCurrency(contribution.valor_unitario_estimado)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenGovernanceAction("confirm", contribution)}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--p-color-info-border)] bg-white px-3 text-xs font-semibold text-[var(--p-color-action)] hover:bg-[var(--p-color-surface-soft)]"
                >
                  <CheckCircle size={15} weight="bold" />
                  Revisar correção
                </button>
              </div>
              <CorrectionComparisonPanel comparison={comparison} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CorrectionComparisonPanel({ comparison }: { comparison?: CorrectionComparison }) {
  if (!comparison) {
    return (
      <div className="mt-3 rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-surface-soft)] p-3 text-xs leading-5 text-[var(--p-color-fg-muted)]">
        Correção reenviada. O comparativo antes/depois só aparece para devoluções feitas a partir desta versão.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--p-color-action)]">
        O que mudou na correção
      </p>
      {comparison.fields.length === 0 ? (
        <p className="mt-2 text-xs leading-5 text-[var(--p-color-fg-muted)]">
          Nenhum campo mudou em relação ao momento da devolução.
        </p>
      ) : (
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--p-color-fg-muted)]">
            <span>Campo</span>
            <span>Antes</span>
            <span>Agora</span>
          </div>
          {comparison.fields.map((field) => (
            <div
              key={field.key}
              className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)] gap-2 rounded-md bg-white p-2 text-xs"
            >
              <strong className="text-[var(--p-color-fg)]">{field.label}</strong>
              <span className="min-w-0 break-words text-[var(--p-color-fg-muted)]">{field.before}</span>
              <span className="min-w-0 break-words font-semibold text-[var(--p-color-fg)]">{field.after}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReturnedContributionCorrectionPanel({
  contributions,
  savingContributionId,
  returnInstructionsByContributionId,
  onSaveCorrection,
}: {
  contributions: Contribution[];
  savingContributionId: string | null;
  returnInstructionsByContributionId: Map<string, ReturnInstruction>;
  onSaveCorrection: (event: FormEvent<HTMLFormElement>, contributionId: string) => void;
}) {
  if (contributions.length === 0) return null;

  return (
    <section className="mt-5 rounded-xl border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <SectionTitle icon={<ShieldWarning size={18} weight="bold" />} title="Correções solicitadas" />
          <p className="mt-1 text-xs leading-5 text-[var(--p-color-fg-muted)]">
            A chefia devolveu estes itens para ajuste. Corrija os campos e envie novamente para revisão.
          </p>
        </div>
        <span className="rounded-full border border-[var(--semantic-warning-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--p-color-warning)]">
          {contributions.length} pendente(s)
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {contributions.map((contribution) => {
          const saving = savingContributionId === contribution.id;
          const instruction = returnInstructionsByContributionId.get(contribution.id);
          const requestedFieldLabels = instruction?.returnFields.length
            ? formatReturnFieldLabels(instruction.returnFields)
            : "Não informado";
          return (
            <form
              key={contribution.id}
              onSubmit={(event) => onSaveCorrection(event, contribution.id)}
              className="rounded-xl border border-[var(--p-color-border-muted)] bg-white p-4"
            >
              <div className="mb-4 rounded-lg border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--p-color-warning)]">
                  Comentário da chefia
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-default)]">
                  {instruction?.returnComment || "A chefia devolveu este item para correção, mas não registrou comentário detalhado."}
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--p-color-warning)]">
                  Campos solicitados
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--p-color-fg)]">
                  {requestedFieldLabels}
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px_150px]">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--p-color-fg)]">
                    {contribution.descricao}
                  </p>
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                    Código: {contribution.codigo_item_efisco || contribution.codigo_tce || "Sem código"}
                  </p>
                </div>
                <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                  Quantidade
                  <input
                    name="quantidade"
                    type="number"
                    min={1}
                    step="1"
                    defaultValue={contribution.quantidade}
                    className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                  Valor unitário
                  <input
                    name="valor_unitario_estimado"
                    type="number"
                    min={0.01}
                    step="0.01"
                    defaultValue={contribution.valor_unitario_estimado}
                    className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                  Justificativa
                  <textarea
                    name="justificativa_item"
                    defaultValue={contribution.justificativa_item || ""}
                    rows={3}
                    className="mt-2 w-full resize-y rounded-md border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-action)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                  Link de referência
                  <input
                    name="link_referencia"
                    defaultValue={contribution.link_referencia || ""}
                    className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                    placeholder="https://..."
                  />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PaperPlaneTilt size={16} weight="bold" />
                  {saving ? "Enviando..." : "Enviar correção"}
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}

function PendingCorrectionNotice() {
  return (
    <div className="mt-3 rounded-md border border-[var(--semantic-warning-border)] bg-white p-2 text-xs leading-5 text-[var(--p-color-warning)]">
      <strong className="block font-semibold">Aguardando correção</strong>
      Este item foi devolvido pela chefia e ainda aguarda correção do participante.
    </div>
  );
}

function ConsolidatedItemsTable({
  items,
  canContribute = false,
  canManageConsolidation = false,
  canEditFiscal = false,
  returnedContributionKeys,
  onRequestContribution,
  onOpenGovernanceAction,
  viewerUserId,
}: {
  items: AggregatedItem[];
  canContribute?: boolean;
  canManageConsolidation?: boolean;
  canEditFiscal?: boolean;
  returnedContributionKeys?: Set<string>;
  onRequestContribution?: (item: AggregatedItem) => void;
  onOpenGovernanceAction?: (mode: GovernanceActionMode, item: AggregatedItem) => void;
  viewerUserId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-md border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-bg-elevated)] p-8 text-center text-sm text-[var(--p-color-fg-muted)]">
        Nenhum item adicionado à sala.
      </div>
    );
  }
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--p-color-border-muted)] text-xs font-semibold text-[var(--p-color-fg-muted)]">
            <th className="py-3 pr-4">Item</th>
            <th className="px-4 py-3">Unidade</th>
            <th className="px-4 py-3">Tipo de despesa</th>
            <th className="px-4 py-3 text-right">Qtd. total</th>
            <th className="px-4 py-3 text-right">Valor unit. (R$)</th>
            <th className="px-4 py-3 text-right">Valor total (R$)</th>
            <th className="px-4 py-3">Participantes</th>
            <th className="py-3 pl-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const itemKey = buildCollectiveContributionKey(item);
            const badge = getCatalogExpenseBadge(item.gnd || item.gnd_derivado || item.codigo_natureza_despesa);
            const myQuantity = getViewerQuantityForItem(item, viewerUserId);
            const hasPendingCorrection = Boolean(returnedContributionKeys?.has(itemKey));
            return (
              <tr
                key={`${item.codigo_item_efisco || item.codigo_tce}-${item.gnd}`}
                className={cn(
                  "border-b border-[var(--p-color-border-muted)]",
                  hasPendingCorrection && "bg-[var(--semantic-warning-soft)]",
                )}
              >
                <td className="max-w-[300px] py-4 pr-4 align-top">
                  <p
                    className="line-clamp-4 text-sm font-semibold leading-5 text-[var(--p-color-fg)]"
                    title={item.descricao || "Descrição não informada"}
                  >
                    {item.descricao || "Descrição não informada"}
                  </p>
                  {String(item.descricao || "").length > 220 && (
                    <span className="mt-1 inline-block text-[11px] font-semibold text-[var(--p-color-action)]">
                      Passe o cursor para ver a descrição completa
                    </span>
                  )}
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                    Código: {item.codigo_item_efisco || item.codigo_tce || "Sem código"} · {item.nome_classe || item.nome_grupo || "Sem categoria"}
                  </p>
                  <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 type-kicker font-semibold uppercase", badge.className)}>
                    {badge.label}
                  </span>
                  {hasPendingCorrection ? <PendingCorrectionNotice /> : null}
                </td>
                <td className="px-4 py-4 align-top text-sm font-semibold text-[var(--p-color-fg)]">
                  {item.unidade_medida || "UN"}
                </td>
                <td className="px-4 py-4 align-top text-sm text-[var(--p-color-fg)]">
                  <p className="font-semibold">{badge.label}</p>
                  <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">{badge.elementLabel}</p>
                </td>
                <td className="px-4 py-4 text-right align-top text-sm font-semibold">{item.quantidade}</td>
                <td className="px-4 py-4 text-right align-top text-sm font-semibold">{formatCurrency(item.valor_unitario_estimado)}</td>
                <td className="px-4 py-4 text-right align-top text-sm font-semibold">{formatCurrency(getItemSubtotal(item))}</td>
                <td className="px-4 py-4 align-top">
                  <ParticipantDots contributors={item.contributors || []} />
                  <p className="mt-1 type-caption font-semibold text-[var(--p-color-action)]">
                    Minha quantidade: {myQuantity}
                  </p>
                  {canManageConsolidation ? (
                    <ItemGovernanceActions
                      item={item}
                      canEditFiscal={canEditFiscal}
                      onAction={onOpenGovernanceAction}
                    />
                  ) : null}
                </td>
                <td className="py-4 pl-4 text-right align-top">
                  {canContribute ? (
                    <button
                      type="button"
                      onClick={() => onRequestContribution?.(item)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[var(--p-color-border-strong)] bg-white px-3 text-xs font-semibold text-[var(--p-color-action)] hover:bg-[var(--p-color-surface-muted)]"
                      aria-label="Solicitar quantidade deste item"
                    >
                      <Plus size={14} weight="bold" />
                      Solicitar
                    </button>
                  ) : (
                    <ItemActionsMenu item={item} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ItemGovernanceActions({
  item,
  canEditFiscal,
  onAction,
}: {
  item: AggregatedItem;
  canEditFiscal?: boolean;
  onAction?: (mode: GovernanceActionMode, item: AggregatedItem) => void;
}) {
  const fiscalConfirmationLabel = "Confirmar fiscal";
  const openFiscalConfirmation = () => onAction?.("edit", item);

  return (
    <div className="mt-2 flex min-w-[220px] flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onAction?.("confirm", item)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--p-color-success)] bg-[var(--p-color-success-bg)] px-2.5 text-[11px] font-semibold text-[var(--p-color-success)] hover:bg-white"
      >
        <CheckCircle size={13} weight="fill" />
        Confirmar
      </button>
      {canEditFiscal ? (
        <button
          type="button"
          onClick={openFiscalConfirmation}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--p-color-info-border)] bg-white px-2.5 text-[11px] font-semibold text-[var(--p-color-action)] hover:bg-[var(--p-color-info-bg)]"
        >
          <Hash size={13} weight="bold" />
          {fiscalConfirmationLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onAction?.("edit", item)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] px-2.5 text-[11px] font-semibold text-[var(--p-color-action)] hover:bg-white"
      >
        <FloppyDisk size={13} weight="bold" />
        Editar
      </button>
      <button
        type="button"
        onClick={() => onAction?.("return_for_correction", item)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] px-2.5 text-[11px] font-semibold text-[var(--p-color-warning)] hover:bg-white"
      >
        <ShieldWarning size={13} weight="bold" />
        Devolver
      </button>
    </div>
  );
}

function CollectiveItemGovernanceModal({
  state,
  savingContributionId,
  canEditFiscal,
  onClose,
  onSubmit,
}: {
  state: GovernanceModalState | null;
  savingContributionId: string | null;
  canEditFiscal: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!state) return null;

  const title =
    state.mode === "confirm"
      ? "Confirmar item"
      : state.mode === "return_for_correction"
        ? "Devolver para correção"
        : "Editar item";
  const description =
    state.mode === "confirm"
      ? "Confirme a contribuição correta para registrar a conferência da chefia."
      : state.mode === "return_for_correction"
        ? "Indique qual contribuição precisa de correção e registre o comentário que será enviado ao usuário afetado."
        : "Escolha a contribuição afetada e ajuste os campos necessários antes de salvar.";
  const pendingReturnedContributions = state.contributions.filter(
    (contribution) => String(contribution.status || "") === "devolvida",
  );

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.section
          className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--p-color-border-muted)] bg-white p-5 shadow-2xl"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          transition={{ duration: 0.18 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--p-color-action)]">
                Consolidação da chefia
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-600)]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--p-color-fg-muted)]">{description}</p>
              <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--p-color-fg)]">
                {state.item.descricao || "Item sem descrição"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--p-color-border-muted)] text-[var(--p-color-fg-muted)] hover:bg-[var(--p-color-surface-soft)]"
              aria-label="Fechar"
            >
              <X size={17} weight="bold" />
            </button>
          </div>

          {state.mode !== "return_for_correction" && pendingReturnedContributions.length > 0 ? (
            <div className="mt-4 rounded-md border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] p-3 text-sm leading-6 text-[var(--p-color-warning)]">
              <strong className="block font-semibold">Este item foi devolvido e ainda aguarda correção.</strong>
              Confira se a contribuição correta já voltou para revisão antes de confirmar ou editar.
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {state.contributions.map((contribution) => {
              const saving = savingContributionId === contribution.id;
              const actorLabel = contribution.user_name || contribution.user_email || "Participante";
              return (
                <form
                  key={contribution.id}
                  onSubmit={onSubmit}
                  className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4"
                >
                  <input type="hidden" name="contribution_id" value={contribution.id} />
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--p-color-fg)]">{actorLabel}</p>
                      <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                        Qtd. {contribution.quantidade} · Valor unit.: {formatCurrency(contribution.valor_unitario_estimado)}
                      </p>
                      {contribution.status === "devolvida" ? (
                        <span className="mt-2 inline-flex rounded-full border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--p-color-warning)]">
                          Devolvida para correção
                        </span>
                      ) : null}
                      {contribution.status === "consolidada" ? (
                        <span className="mt-2 inline-flex rounded-full border border-[var(--p-color-success)] bg-[var(--p-color-success-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--p-color-success)]">
                          Confirmada pela chefia
                        </span>
                      ) : null}
                    </div>
                    {state.mode === "confirm" ? (
                      <button
                        type="submit"
                        disabled={saving || contribution.status === "consolidada"}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-[var(--p-color-success)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle size={16} weight="fill" />
                        {saving
                          ? "Confirmando..."
                          : contribution.status === "consolidada"
                            ? "Contribuição confirmada"
                            : "Confirmar esta contribuição"}
                      </button>
                    ) : null}
                  </div>

                  {state.mode === "edit" ? (
                    <>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                          Quantidade
                          <input
                            name="quantidade"
                            type="number"
                            min={1}
                            step="1"
                            defaultValue={contribution.quantidade}
                            className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                          />
                        </label>
                        <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                          Valor unitário
                          <input
                            name="valor_unitario_estimado"
                            type="number"
                            min={0.01}
                            step="0.01"
                            defaultValue={contribution.valor_unitario_estimado}
                            className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                          />
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)]">
                        <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                          Justificativa
                          <textarea
                            name="justificativa_item"
                            defaultValue={contribution.justificativa_item || ""}
                            rows={3}
                            className="mt-2 w-full resize-y rounded-md border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-action)]"
                          />
                        </label>
                        <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                          Link de referência
                          <input
                            name="link_referencia"
                            defaultValue={contribution.link_referencia || ""}
                            className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                            placeholder="https://..."
                          />
                        </label>
                      </div>
                      {canEditFiscal ? (
                        <section className="mt-3 rounded-lg border border-[var(--p-color-info-border)] bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--p-color-action)]">
                            Ajuste fiscal do superusuário
                          </p>
                          <p className="mt-1 text-xs font-medium leading-5 text-[var(--p-color-fg-muted)]">
                            Confirmar corrente, capital e código e-Fisco.
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                              Código e-Fisco
                              <input
                                name="codigo_item_efisco"
                                defaultValue={contribution.codigo_item_efisco || contribution.codigo_tce || ""}
                                className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                              />
                            </label>
                            <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                              Natureza
                              <input
                                name="codigo_natureza_despesa"
                                defaultValue={contribution.codigo_natureza_despesa || ""}
                                className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                              />
                            </label>
                            <label className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                              GND
                              <input
                                name="gnd"
                                defaultValue={contribution.gnd || contribution.gnd_derivado || ""}
                                className="mt-2 h-10 w-full rounded-md border border-[var(--p-color-border-strong)] px-3 text-sm outline-none focus:border-[var(--p-color-action)]"
                              />
                            </label>
                          </div>
                        </section>
                      ) : null}
                      <div className="mt-4 flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FloppyDisk size={16} weight="bold" />
                          {saving ? "Salvando..." : "Salvar ajuste"}
                        </button>
                      </div>
                    </>
                  ) : null}

                  {state.mode === "return_for_correction" ? (
                    <div className="mt-4">
                      <div>
                        <p className="text-xs font-semibold text-[var(--p-color-fg-default)]">
                          Campo que precisa de ajuste
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {RETURN_FIELD_OPTIONS.map((field) => (
                            <label
                              key={field.id}
                              className="flex min-h-[76px] cursor-pointer gap-3 rounded-lg border border-[var(--p-color-border-muted)] bg-white p-3 text-left hover:border-[var(--p-color-action)]"
                            >
                              <input
                                name="return_fields"
                                type="checkbox"
                                value={field.id}
                                className="mt-1 h-4 w-4 rounded border-[var(--p-color-border-strong)] text-[var(--p-color-action)]"
                              />
                              <span>
                                <span className="block text-xs font-semibold text-[var(--p-color-fg)]">
                                  {field.label}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-[var(--p-color-fg-muted)]">
                                  {field.description}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <label className="mt-4 block text-xs font-semibold text-[var(--p-color-fg-default)]">
                        Comentário para correção
                        <textarea
                          name="return_comment"
                          rows={4}
                          required
                          placeholder="Explique o que precisa ser corrigido neste item."
                          className="mt-2 w-full resize-y rounded-md border border-[var(--p-color-border-strong)] px-3 py-2 text-sm outline-none focus:border-[var(--p-color-action)]"
                        />
                      </label>
                      <div className="mt-4 flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--p-color-warning)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <ShieldWarning size={16} weight="bold" />
                          {saving ? "Enviando..." : "Devolver e avisar usuário"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </form>
              );
            })}
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}

function ItemActionsMenu({ item }: { item: AggregatedItem }) {
  const [open, setOpen] = useState(false);
  const participantSummary = (item.contributors || [])
    .map((contributor) => `${contributor.user_name || contributor.user_email || "Usuário"}: ${contributor.quantidade}`)
    .join(" · ");

  async function copyText(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error("Não foi possível copiar.");
    } finally {
      setOpen(false);
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-md p-2 text-[var(--p-color-brand-600)] hover:bg-[var(--p-color-surface-muted)]"
        aria-label="Mais ações"
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-56 rounded-md border border-[var(--p-color-border-muted)] bg-white p-1 text-left shadow-lg">
          <button
            type="button"
            onClick={() =>
              copyText(item.descricao || "", "Descrição copiada.")
            }
            className="flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-[var(--p-color-fg-default)] hover:bg-[var(--p-color-surface-soft)]"
          >
            Copiar descrição
          </button>
          <button
            type="button"
            onClick={() =>
              copyText(item.codigo_item_efisco || item.codigo_tce || "", "Código copiado.")
            }
            className="mt-1 flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-[var(--p-color-fg-default)] hover:bg-[var(--p-color-surface-soft)]"
          >
            Copiar código
          </button>
          <button
            type="button"
            onClick={() => {
              toast.info(participantSummary || "Sem participantes identificados.");
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-[var(--p-color-fg-default)] hover:bg-[var(--p-color-surface-soft)]"
          >
            Ver participantes
          </button>
        </div>
      )}
    </div>
  );
}

function ConsolidationSummary({
  detail,
  totalValue,
  breakdown,
  checklist,
  canEdit,
  updatingStatus,
  onContinue,
  onSaveAndExit,
}: {
  detail: RoomDetail;
  totalValue: number;
  breakdown: ExpenseBreakdown;
  checklist: Record<string, boolean>;
  canEdit: boolean;
  updatingStatus: boolean;
  onContinue: () => void;
  onSaveAndExit: () => void;
}) {
  const isOpen = detail.room.status === "aberta";
  const isConsolidating = detail.room.status === "em_consolidacao_chefia";
  const ctaLabel = updatingStatus
    ? isOpen
      ? "Encerrando..."
      : "Avançando..."
    : isOpen
      ? "Encerrar coautoria e consolidar"
      : isConsolidating
        ? "Avançar para prévia de conversão"
        : "Abrir prévia de conversão";
  return (
    <Panel>
      <h2 className="text-base font-semibold text-[var(--p-color-brand-600)]">Resumo da consolidação</h2>
      <SummaryRows detail={detail} breakdown={breakdown} totalValue={totalValue} />
      <div className="mt-5 rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-info-bg)] p-4 text-xs leading-5 text-[var(--p-color-fg-muted)]">
        {isOpen
          ? "Ao avançar, a sala deixa a coautoria aberta e passa a ser conduzida exclusivamente pela chefia."
          : "Coautoria já encerrada. O próximo passo é abrir a prévia de conversão para revisão final."}
      </div>
      <Checklist title="Antes de avançar, verifique:" checklist={checklist} />
      <PulsingCtaButton
        type="button"
        onClick={onContinue}
        disabled={!canEdit || updatingStatus || detail.items.length === 0}
        pulse
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ctaLabel} <ArrowRight size={17} weight="bold" />
      </PulsingCtaButton>
      <button
        type="button"
        onClick={onSaveAndExit}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--p-color-border-strong)] bg-white text-sm font-semibold text-[var(--p-color-action)]"
      >
        <FloppyDisk size={16} weight="bold" /> Salvar rascunho e sair
      </button>
    </Panel>
  );
}

function ReviewPanel({
  detail,
  reviewTab,
  setReviewTab,
  saveMetadata,
  savingMeta,
  canEditMetadata,
  viewerUserId,
}: {
  detail: RoomDetail;
  reviewTab: ReviewTab;
  setReviewTab: (tab: ReviewTab) => void;
  saveMetadata: (event: FormEvent<HTMLFormElement>) => void;
  savingMeta: boolean;
  canEditMetadata: boolean;
  viewerUserId: string | null;
}) {
  const tabs: Array<{ id: ReviewTab; label: string }> = [
    { id: "itens", label: "Itens consolidados" },
    { id: "informacoes", label: "Informações da DFD" },
    { id: "anexos", label: "Anexos e documentos" },
  ];

  return (
    <Panel>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionTitle icon={<UsersThree size={18} weight="bold" />} title="Prévia da conversão" />
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--p-color-fg-muted)]">
            Neste ponto, a chefia já conduz a sala. Revise o texto final, a separação por natureza da despesa e a
            coerência dos itens antes de gerar as DFDs oficiais.
          </p>
        </div>
      </div>
      <div className="mt-5 flex gap-5 border-b border-[var(--p-color-border-muted)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setReviewTab(tab.id)}
            className={cn(
              "border-b-2 px-3 pb-3 text-sm font-semibold",
              reviewTab === tab.id
                ? "border-[var(--p-color-action)] text-[var(--p-color-brand-600)]"
                : "border-transparent text-[var(--p-color-fg-muted)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {reviewTab === "itens" && (
        <ConsolidatedItemsTable items={detail.items} viewerUserId={viewerUserId} />
      )}
      {reviewTab === "informacoes" && (
        <form onSubmit={saveMetadata} className="mt-5 grid gap-4">
          <input type="hidden" name="status" value={detail.room.status} />
          <label className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            Título
            <input disabled={!canEditMetadata} name="title" defaultValue={detail.room.title} className="mt-2 h-11 w-full rounded-md border border-[var(--p-color-border-strong)] px-4 text-sm outline-none focus:border-[var(--p-color-action)] disabled:bg-[var(--p-color-surface-soft)] disabled:text-[var(--p-color-fg-muted)]" />
          </label>
          <label className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            Justificativa geral da DFD coletiva
            <textarea disabled={!canEditMetadata} name="description" defaultValue={detail.room.description || ""} rows={4} className="mt-2 w-full resize-none rounded-md border border-[var(--p-color-border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--p-color-action)] disabled:bg-[var(--p-color-surface-soft)] disabled:text-[var(--p-color-fg-muted)]" />
          </label>
          <label className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            Escopo
            <textarea disabled={!canEditMetadata} name="scope" defaultValue={detail.room.scope || ""} rows={4} className="mt-2 w-full resize-none rounded-md border border-[var(--p-color-border-strong)] px-4 py-3 text-sm outline-none focus:border-[var(--p-color-action)] disabled:bg-[var(--p-color-surface-soft)] disabled:text-[var(--p-color-fg-muted)]" />
          </label>
          <PlanningSubsidiesReviewFields
            value={detail.room.planning_subsidies || {}}
            disabled={!canEditMetadata}
          />
          {canEditMetadata ? (
            <button type="submit" disabled={savingMeta} className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] px-4 text-sm font-semibold text-white disabled:opacity-60">
              <FloppyDisk size={16} weight="bold" /> {savingMeta ? "Salvando..." : "Salvar informações"}
            </button>
          ) : (
            <p className="text-sm text-[var(--p-color-fg-muted)]">Somente a chefia pode editar o texto final nesta fase.</p>
          )}
        </form>
      )}
      {reviewTab === "anexos" && (
        <div className="mt-5 rounded-md border border-dashed border-[var(--p-color-border-strong)] bg-[var(--p-color-bg-elevated)] p-8 text-center text-sm text-[var(--p-color-fg-muted)]">
          Nenhum anexo registrado nesta versão da DFD coletiva.
        </div>
      )}
      <EventsPanel events={detail.events} />
    </Panel>
  );
}

function ApprovalSummary({
  detail,
  totalValue,
  breakdown,
  checklist,
  previewExpenseGroups,
  actorRole,
  canConvert,
  canAdvance,
  updatingStatus,
  onAdvanceToReady,
  converting,
  onConvert,
  onSaveAndExit,
}: {
  detail: RoomDetail;
  totalValue: number;
  breakdown: ExpenseBreakdown;
  checklist: Record<string, boolean>;
  previewExpenseGroups: ReturnType<typeof splitCollectiveItemsByExpenseClass>;
  actorRole?: RoomDetail["room"]["actor_role"];
  canConvert: boolean;
  canAdvance: boolean;
  updatingStatus: boolean;
  onAdvanceToReady: () => void;
  converting: boolean;
  onConvert: () => void;
  onSaveAndExit: () => void;
}) {
  const canSeeFiscalAlternatives = actorRole === "admin" || actorRole === "superadmin";
  return (
    <Panel>
      <h2 className="text-base font-semibold text-[var(--p-color-brand-600)]">Saída prevista</h2>
      <SummaryRows detail={detail} breakdown={breakdown} totalValue={totalValue} />
      {canSeeFiscalAlternatives ? <FiscalAlternativesPanel items={detail.items} /> : null}
      <div className="mt-5 rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
        <h3 className="text-sm font-semibold text-[var(--p-color-fg)]">Prévia das DFDs oficiais</h3>
        <div className="mt-3 grid gap-3">
          {previewExpenseGroups.map((group) => (
            <div key={group.expenseClass} className="rounded-md border border-[var(--p-color-border-muted)] bg-white px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[var(--p-color-fg)]">{group.label}</strong>
                <span className="text-[var(--p-color-fg-muted)]">
                  {group.items.length} item(ns) · {formatCurrency(group.totalValue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-md border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4 text-xs leading-5 text-[var(--p-color-action)]">
        A conversão cria uma DFD oficial por grupo de natureza de despesa e envia a sala para histórico.
      </div>
      <Checklist title="Checklist de revisão" checklist={checklist} />
      <div className="mt-5 border-t border-[var(--p-color-border-muted)] pt-5">
        <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Fluxo de aprovação</h3>
        <ol className="mt-4 grid gap-4 text-sm">
          <ApprovalStep index={1} title="Prévia por natureza" description="O sistema separa corrente, capital e outras naturezas antes da geração." />
          <ApprovalStep index={2} title="Geração oficial" description="A chefia converte a sala e o sistema cria uma ou mais DFDs." />
          <ApprovalStep index={3} title="Histórico" description="A sala sai da área operacional e permanece apenas para rastreabilidade." />
        </ol>
      </div>
      {canAdvance && (
        <button
          type="button"
          onClick={onAdvanceToReady}
          disabled={updatingStatus || detail.items.length === 0}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updatingStatus ? "Preparando..." : "Marcar como pronta para conversão"} <ArrowRight size={17} weight="bold" />
        </button>
      )}
      <button
        type="button"
        onClick={onConvert}
        disabled={!canConvert || converting || detail.items.length === 0}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--p-color-action)] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {converting ? "Gerando..." : "Encerrar sala e gerar DFD oficial"} <PaperPlaneTilt size={17} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onSaveAndExit}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[var(--p-color-border-strong)] bg-white text-sm font-semibold text-[var(--p-color-action)]"
      >
        <FloppyDisk size={16} weight="bold" /> Salvar rascunho e sair
      </button>
    </Panel>
  );
}

function FiscalAlternativesPanel({ items }: { items: AggregatedItem[] }) {
  const rows = items.filter((item) => (item.fiscal_options || []).length > 0);
  if (rows.length === 0) return null;

  return (
    <section className="mt-5 rounded-md border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-4">
      <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">
        Possibilidades de troca fiscal
      </h3>
      <div className="mt-3 grid gap-3">
        {rows.map((item) => (
          <div
            key={`${item.codigo_item_efisco || item.codigo_tce}-${item.codigo_natureza_despesa || item.gnd}`}
            className="rounded-md border border-[var(--p-color-border-muted)] bg-white p-3"
          >
            <p className="line-clamp-2 text-sm font-semibold text-[var(--p-color-fg)]">
              {item.descricao || "Item sem descrição"}
            </p>
            <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
              Atual: {item.codigo_item_efisco || item.codigo_tce || "sem codigo_efisco"} ·{" "}
              {item.codigo_natureza_despesa || "sem codigo_natureza_despesa"} ·{" "}
              {item.gnd || item.gnd_derivado || "sem gnd"}
            </p>
            <div className="mt-3 grid gap-2">
              {(item.fiscal_options || []).slice(0, 6).map((option) => {
                const badge = getCatalogExpenseBadge(option.gnd || option.codigo_natureza_despesa);
                return (
                  <div
                    key={`${option.efisco_item_natureza_id || option.codigo_natureza_despesa}-${option.gnd}`}
                    className="flex flex-col gap-2 rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-semibold text-[var(--p-color-fg)]">
                      {option.codigo_efisco || item.codigo_item_efisco || item.codigo_tce || "sem codigo_efisco"}
                    </span>
                    <span className="text-[var(--p-color-fg-muted)]">
                      {option.codigo_natureza_despesa || "sem codigo_natureza_despesa"} · {option.gnd || "sem gnd"}
                    </span>
                    <span className={cn("w-fit rounded-full border px-2 py-1 font-semibold uppercase", badge.className)}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanningSubsidiesReviewFields({
  value,
  disabled,
}: {
  value: DfdPlanningSubsidies;
  disabled: boolean;
}) {
  return (
    <section className="rounded-md border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
      <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">
        Complementos do planejamento
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {DFD_PLANNING_FIELD_ORDER.map((field: DfdPlanningFieldKey) => (
          <label key={field} className="text-sm font-semibold text-[var(--p-color-fg-default)]">
            {DFD_PLANNING_FIELD_LABELS[field]}
            <textarea
              disabled={disabled}
              name={`planning_${field}`}
              defaultValue={value?.[field] || ""}
              rows={3}
              maxLength={1200}
              required
              className="mt-2 w-full resize-y rounded-md border border-[var(--p-color-border-strong)] px-4 py-3 text-sm font-normal outline-none focus:border-[var(--p-color-action)] disabled:bg-[var(--p-color-surface-soft)] disabled:text-[var(--p-color-fg-muted)]"
              placeholder={DFD_PLANNING_FIELD_HELPERS[field]}
            />
        </label>
        ))}
      </div>
    </section>
  );
}

function SummaryRows({
  detail,
  breakdown,
  totalValue,
}: {
  detail: RoomDetail;
  breakdown: ExpenseBreakdown;
  totalValue: number;
}) {
  return (
    <div className="mt-5 grid gap-3 text-sm">
      <SummaryRow label="Itens consolidados" value={detail.items.length} />
      <SummaryRow label="Itens correntes" value={`${breakdown.corrente.count} · ${formatCurrency(breakdown.corrente.total)}`} dotClass="bg-[#63D99D]" />
      <SummaryRow label="Itens de capital" value={`${breakdown.capital.count} · ${formatCurrency(breakdown.capital.total)}`} dotClass="bg-[#7C7DFF]" />
      <div className="mt-2 flex items-center justify-between border-t border-[var(--p-color-border-muted)] pt-4">
        <span className="font-semibold text-[var(--p-color-brand-600)]">Valor total estimado</span>
        <strong className="text-xl text-[var(--p-color-action)]">{formatCurrency(totalValue)}</strong>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, dotClass }: { label: string; value: ReactNode; dotClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[var(--p-color-fg-muted)]">
        {dotClass && <span className={cn("h-2 w-2 rounded-full", dotClass)} />}
        {label}
      </span>
      <strong className="text-[var(--p-color-fg)]">{value}</strong>
    </div>
  );
}

function Checklist({ title, checklist }: { title: string; checklist: Record<string, boolean> }) {
  const entries = [
    ["hasItems", "Todos os itens possuem justificativa"],
    ["quantities", "Quantidades conferidas"],
    ["values", "Valores unitários informados"],
    ["participants", "Participantes revisados"],
    ["metadata", "Informações da DFD preenchidas"],
  ] as const;
  return (
    <div className="mt-5 border-t border-[var(--p-color-border-muted)] pt-5">
      <h3 className="text-sm font-semibold text-[var(--p-color-fg)]">{title}</h3>
      <div className="mt-3 grid gap-3">
        {entries.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-sm text-[var(--p-color-fg-muted)]">
            <CheckCircle
              size={16}
              weight={checklist[key] ? "fill" : "regular"}
              className={checklist[key] ? "text-[#16A36A]" : "text-[var(--p-color-border-strong)]"}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function EventsPanel({ events }: { events: RoomDetail["events"] }) {
  return (
    <section className="mt-5 rounded-lg border border-[var(--p-color-border-muted)] bg-white">
      <div className="border-b border-[var(--p-color-border-muted)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--p-color-brand-600)]">Contribuições e alterações</h3>
        <p className="text-xs text-[var(--p-color-fg-muted)]">Resumo das principais contribuições e alterações realizadas na sala.</p>
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[var(--p-color-fg-muted)]">Ainda não há histórico registrado.</p>
      ) : (
        <div className="divide-y divide-[var(--p-color-border-muted)]">
          {events.map((event) => (
            <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_160px]">
              <span className="flex items-center gap-2 text-[var(--p-color-fg-default)]">
                {event.event_type === "contribution_adjusted_by_chefia" && (
                  <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 type-kicker font-semibold uppercase text-[#C2410C]">
                    Ajustado pela chefia
                  </span>
                )}
                {event.event_type === "contribution_discarded_by_chefia" && (
                  <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 type-kicker font-semibold uppercase text-[#B91C1C]">
                    Descartado pela chefia
                  </span>
                )}
                {event.message}
                {event.event_type === "correcao_administrativa" && <span className="block whitespace-pre-wrap text-xs">{correctionHistoryDetails(JSON.stringify(event.metadata || {}))}</span>}
              </span>
              <span className="text-right text-[var(--p-color-fg-muted)]">{formatDateTime(event.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function HeaderMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex min-w-[130px] items-center gap-3 rounded-xl border border-[var(--semantic-neutral-border)] bg-white px-4 py-3 shadow-sm">
      <div className="text-[var(--semantic-collab)]">{icon}</div>
      <div>
        <p className="text-xs text-[var(--p-color-fg-muted)]">{label}</p>
        <p className="min-w-0 overflow-visible text-base font-semibold text-[var(--p-color-fg)]">
          <MechanicalValue value={value} />
        </p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[var(--semantic-collab)]">
      {icon}
      <h2 className="text-base font-semibold text-[var(--semantic-text)]">{title}</h2>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("ux-panel rounded-[20px] p-5", className)}>
      {children}
    </section>
  );
}

function StatusBadge({ status, compact }: { status: RoomStatus; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 font-semibold",
        compact ? "type-caption" : "text-xs",
        status === "proposta" && "ux-chip-insight",
        status === "aberta" && "ux-chip-collab",
        status === "em_consolidacao_chefia" && "ux-chip-warning",
        status === "pronta_para_conversao" && "ux-chip-warning",
        status === "convertida" && "ux-chip-success",
        status === "arquivada" && "bg-[var(--p-color-surface-muted)] text-[var(--p-color-fg-muted)]",
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function ParticipantDots({
  contributors,
}: {
  contributors: NonNullable<AggregatedItem["contributors"]>;
}) {
  return (
    <AvatarStack
      members={contributors.map((contributor) => ({
        id: contributor.user_id,
        name: contributor.user_name || contributor.user_email || "Usuário",
        email: contributor.user_email || null,
        avatarUrl: contributor.user_avatar_url || null,
      }))}
      total={contributors.length}
      size="sm"
      maxVisible={3}
    />
  );
}

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--p-color-border)] bg-[var(--p-color-surface-muted)] text-xs font-semibold text-[var(--p-color-fg-default)]">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        getInitial(name || "U")
      )}
    </span>
  );
}

function getViewerQuantityForItem(item: AggregatedItem, viewerUserId?: string | null) {
  if (!viewerUserId) return 0;
  const contributors = item.contributors || [];
  return contributors
    .filter((contributor) => String(contributor.user_id || "") === String(viewerUserId))
    .reduce((acc, contributor) => acc + Number(contributor.quantidade || 0), 0);
}

function readPlanningSubsidiesFromForm(form: FormData): DfdPlanningSubsidies {
  return DFD_PLANNING_FIELD_ORDER.reduce<DfdPlanningSubsidies>((acc, field) => {
    const value = String(form.get(`planning_${field}`) || "").trim();
    if (value) acc[field] = value;
    return acc;
  }, {});
}

function ApprovalStep({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--p-color-action)] text-xs font-semibold text-white">{index}</span>
      <span>
        <span className="block font-semibold text-[var(--p-color-fg)]">{title}</span>
        <span className="mt-1 block text-xs text-[var(--p-color-fg-muted)]">{description}</span>
      </span>
    </li>
  );
}

function getCatalogExpenseBadge(value?: string | null) {
  const classification = classifyGnd(value);
  if (!classification) {
    return {
      label: "Sem classificação",
      kind: "sem-gnd" as const,
      elementCode: "",
      elementLabel: "Natureza da despesa não identificada",
      detail: "Natureza da despesa não identificada",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  if (classification.expenseClass === "custeio") {
    return {
      label: "Corrente",
      kind: "corrente" as const,
      elementCode: classification.elementCode,
      elementLabel: classification.elementLabel,
      detail: classification.elementLabel,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (classification.expenseClass === "investimento") {
    return {
      label: "Capital",
      kind: "capital" as const,
      elementCode: classification.elementCode,
      elementLabel: classification.elementLabel,
      detail: classification.elementLabel,
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  return {
    label: "Outra natureza",
    kind: "outro" as const,
    elementCode: classification.elementCode,
    elementLabel: classification.elementLabel,
    detail: classification.elementLabel,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

type ExpenseBreakdown = {
  corrente: { count: number; total: number };
  capital: { count: number; total: number };
};

function summarizeItemsByExpense(items: AggregatedItem[]): ExpenseBreakdown {
  return items.reduce(
    (acc, item) => {
      const badge = getCatalogExpenseBadge(item.gnd || item.gnd_derivado || item.codigo_natureza_despesa);
      if (badge.kind === "capital") {
        acc.capital.count += 1;
        acc.capital.total += getItemSubtotal(item);
      } else {
        acc.corrente.count += 1;
        acc.corrente.total += getItemSubtotal(item);
      }
      return acc;
    },
    {
      corrente: { count: 0, total: 0 },
      capital: { count: 0, total: 0 },
    },
  );
}

function getItemSubtotal(item: AggregatedItem) {
  return Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
}

function getDraftSubtotal(item: ContributionDraft) {
  return Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
}

function getCatalogItemKey(item: CatalogItem) {
  return (
    buildCatalogSelectionKey({
      id: item.id,
      codigo_efisco: item.codigo_efisco,
      codigo_tce: item.codigo_tce,
      efisco_item_natureza_id: item.efisco_item_natureza_id,
      codigo_natureza_despesa: item.codigo_natureza_preferencial,
      gnd: item.gnd_preferencial,
      gnd_derivado: item.gnd_preferencial,
      has_missing_natureza: item.has_missing_natureza,
    }) ||
    String(item.codigo_efisco || item.codigo_tce || item.id)
  );
}

function createClientId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createCartDraftItem(item: CatalogItem): CartDraftItem {
  return {
    cartId: createClientId("cart"),
    item,
    addedAt: Date.now(),
    quantidade: 1,
    valor_unitario_estimado: "",
    unidade_medida: item.unidade_medida || "UN",
    link_referencia: "",
    justificativa_item: "",
    justificativa_quantidade: "",
  };
}

function resolveContributionDraftUpdate(
  current: ContributionDraft,
  update: SetStateAction<ContributionDraft>,
) {
  return typeof update === "function" ? update(current) : update;
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitial(name: string) {
  return (
    String(name || "U")
      .trim()
      .charAt(0)
      .toLocaleLowerCase("pt-BR") || "u"
  );
}
