"use client";

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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { recordCatalogSearchClick } from "@/lib/catalog-search-events";
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CheckCircle,
  ClipboardText,
  Info,
  CurrencyDollar,
  DownloadSimple,
  DotsThreeVertical,
  FloppyDisk,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
  Package,
  PaperPlaneTilt,
  Plus,
  ShoppingCart,
  ShieldWarning,
  Trash,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { classifyGnd } from "@/lib/dfd-gnd";
import { splitCollectiveItemsByExpenseClass } from "@/lib/collective-dfd";
import {
  COLLECTIVE_CATALOG_SEARCH_LIMIT,
  buildCollectiveCatalogFallbackFilter,
  buildCollectiveCatalogPageState,
  sanitizeCollectiveCatalogSearch,
} from "@/lib/collective-catalog-search";
import { rerankCatalogSearchResults } from "@/lib/catalog-search-ranking";

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

type ContributionDraft = {
  quantidade: number;
  valor_unitario_estimado: string;
  link_referencia: string;
  justificativa_item: string;
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
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  descricao: string;
  unidade_medida?: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_item?: string | null;
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
};

type AggregatedItem = {
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  descricao?: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_item?: string | null;
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
};

type RoomDetail = {
  room: {
    id: string;
    title: string;
    description: string | null;
    scope: string | null;
    status: RoomStatus;
    unit_name: string;
    can_edit_metadata: boolean;
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
  events: Array<{ id: string; message: string; event_type: string; created_at: string }>;
};

type CatalogItem = {
  id: string | number;
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
  unidade_medida?: string | null;
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
  const [cartItems, setCartItems] = useState<CartDraftItem[]>([]);
  const [activeCartId, setActiveCartId] = useState<string | null>(null);
  const [selectionDrawerOpen, setSelectionDrawerOpen] = useState(false);
  const [selectionDrawerSection, setSelectionDrawerSection] = useState<"cart" | "requested">("cart");
  const [savingCart, setSavingCart] = useState(false);
  const [flyingCartItems, setFlyingCartItems] = useState<FlyingCartItem[]>([]);
  const [cartPulseKey, setCartPulseKey] = useState(0);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [showCollectiveFlowGuide, setShowCollectiveFlowGuide] = useState(false);
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
      toast.error(error?.message || "Erro ao carregar DFD coletiva.");
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
    const timer = window.setTimeout(() => {
      setCatalogQuery(searchTerm);
      setCatalogPage(0);
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
      const offset = catalogPage * COLLECTIVE_CATALOG_SEARCH_LIMIT;
      try {
        const response = await fetch(
          `/api/catalog-search?q=${encodeURIComponent(searchTerm)}&category=all&context=dfd_coletiva&limit=${COLLECTIVE_CATALOG_SEARCH_LIMIT}&offset=${offset}`,
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || "Falha na busca.");
        if ((payload.items || []).length > 0) {
          if (!active) return;
          const rows = (payload.items || []) as CatalogItem[];
          setCatalogItems(rerankCatalogSearchResults(searchTerm, rows));
          setCatalogHasMore(Boolean(payload.hasMore));
          return;
        }
      } catch {
        // Mantém a busca direta como fallback quando a RPC falha.
      }

      try {
        const { data, error } = await supabase
          .from("catalogo")
          .select(
            "id,codigo_efisco,descricao,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_natureza_preferencial,gnd_preferencial,unidade_medida",
          )
          .or(buildCollectiveCatalogFallbackFilter(searchTerm))
          .order("id", { ascending: true })
          .range(offset, offset + COLLECTIVE_CATALOG_SEARCH_LIMIT - 1);
        if (error) toast.error("Falha ao buscar no catálogo.");
        if (!active) return;
        const rows = (data || []) as CatalogItem[];
        setCatalogItems(rerankCatalogSearchResults(searchTerm, rows));
        setCatalogHasMore(buildCollectiveCatalogPageState(catalogPage, rows.length).hasNext);
      } finally {
        if (active) setCatalogLoading(false);
      }
    }

    fetchCatalogPage();
    return () => {
      active = false;
    };
  }, [catalogPage, catalogQuery]);

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
  const isOpen = detail?.room.status === "aberta";
  const canContributeInOpenRoom = isOpen && Boolean(detail?.room.can_contribute);
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
    toast.success("Suas contribuições foram finalizadas nesta sala.");
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

  function addItemToCart(item: CatalogItem & { searchPosition?: number }, event?: MouseEvent<HTMLButtonElement>) {
    const key = getCatalogItemKey(item);
    const existing = cartItems.find((cartItem) => getCatalogItemKey(cartItem.item) === key);

    if (event) {
      launchCartAnimation(event, item.descricao);
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
      link_referencia: "",
      justificativa_item:
        "Complemento de quantidade para item já existente na DFD coletiva.",
    };
    setCartItems((current) => [...current, seededDraft]);
    setActiveCartId(seededDraft.cartId);
    setSelectionDrawerSection("cart");
    setSelectionDrawerOpen(true);
    setCartPulseKey((current) => current + 1);
    toast.success("Item preparado para você informar sua quantidade.");
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
      justificativa_item:
        contribution.justificativa_item ||
        "Complemento de quantidade para item já solicitado.",
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

  function launchCartAnimation(event: MouseEvent<HTMLButtonElement>, label: string) {
    const source = event.currentTarget.getBoundingClientRect();
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
      toast.warning("Adicione pelo menos um item ao carrinho.");
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
      toast.warning("Preencha quantidade, valor unitário e justificativa dos itens no carrinho.");
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
              link_referencia: cartItem.link_referencia,
              justificativa_item: cartItem.justificativa_item,
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
      toast.success(`${cartItems.length} item(ns) adicionados à DFD coletiva.`);
      setCartItems([]);
      setActiveCartId(null);
      setCatalogSearch("");
      setCatalogItems([]);
      setActiveStage("consolidar");
      setSelectionDrawerOpen(false);
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao adicionar itens.");
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
      toast.success(`${payload.dfds?.length || 0} DFD(s) gerada(s).`);
      setActiveStage("finalizar");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao converter DFD coletiva.");
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
    const rows = [
      ["Item", "Código", "GND", "Quantidade", "Valor unitário", "Valor total", "Participantes"],
      ...detail.items.map((item) => [
        item.descricao || "",
        item.codigo_item_efisco || item.codigo_tce || "",
        item.gnd || item.gnd_derivado || "",
        String(item.quantidade || 0),
        String(item.valor_unitario_estimado || 0).replace(".", ","),
        String(getItemSubtotal(item)).replace(".", ","),
        (item.contributors || [])
          .map((contributor) => `${contributor.user_name || contributor.user_email || "Usuário"}: ${contributor.quantidade}`)
          .join("; "),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"),
      )
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
      <main className="min-h-screen bg-[#F8FAFC] p-6">
        <div className="mx-auto h-[70vh] max-w-[1440px] animate-pulse rounded-lg bg-white" />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] p-6">
        <div className="mx-auto max-w-4xl rounded-lg border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="font-semibold text-[#0B3473]">DFD coletiva não encontrada.</p>
          <button
            onClick={() => router.push("/dfds-coletivas")}
            className="mt-4 rounded-md bg-[#063F8F] px-4 py-2 text-sm font-semibold text-white"
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--semantic-neutral-soft)] px-5 py-6 text-[#0F172A]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <Link
          href="/dfds-coletivas"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#0B4AA2] no-underline"
        >
          <ArrowLeft size={17} weight="bold" /> Voltar para DFDs coletivas
        </Link>

        <section className="ux-panel relative overflow-hidden rounded-[22px] p-5">
          <div className="ux-accent-rule absolute inset-x-0 top-0 h-1" />
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="ux-kicker">DFD coletiva</p>
              <h1 className="ux-title mt-1 truncate text-2xl font-semibold">
                {detail.room.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-[#526070]">
                <StatusBadge status={detail.room.status} />
                <span>{detail.room.unit_name}</span>
                <span className="text-[#9AA4B2]">•</span>
                <span>Criada em {formatDateTime(detail.room.created_at)}</span>
                {detail.room.published_at && (
                  <>
                    <span className="text-[#9AA4B2]">•</span>
                    <span>Publicada em {formatDateTime(detail.room.published_at)}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
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
            addItemToCart={addItemToCart}
            catalogPageState={catalogPageState}
            catalogHasMore={catalogHasMore}
            setCatalogPage={setCatalogPage}
            catalogFilter={catalogFilter}
            setCatalogFilter={setCatalogFilter}
          />
        )}

        {activeStage === "consolidar" && (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <ConsolidationPanel
              detail={detail}
              canContribute={canContributeInOpenRoom}
              onRequestContribution={addAggregatedItemToCart}
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
            <section className="rounded-lg border border-[#DDE5EF] bg-white p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex max-w-3xl flex-col items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#188B56]">
                  <CheckCircle size={28} weight="fill" />
                </div>
                <h2 className="text-xl font-semibold text-[#0B3473]">DFD coletiva finalizada</h2>
                <p className="text-sm leading-6 text-[#526070]">
                  Esta sala já cumpriu o papel de reunir e consolidar a demanda. Use os links abaixo para acompanhar
                  as DFDs oficiais geradas a partir desta construção coletiva.
                </p>
                {detail.linkedDfds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.linkedDfds.map((link) => (
                      <Link
                        key={link.dfd_id}
                        href={`/dfd/${link.dfd_id}`}
                        className="rounded-md bg-[#EAF2FF] px-4 py-2 text-sm font-semibold text-[#0B4AA2] no-underline"
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
                void handleConsolidateAction();
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
                void handleConsolidateAction();
              }}
            />
          </>
        )}
        <CollectiveFlowGuideModal
          open={showCollectiveFlowGuide}
          onClose={() => setShowCollectiveFlowGuide(false)}
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
        ? "border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] text-[#8A5A00]"
      : "border-[#D8E3F4] bg-[#F5F8FE] text-[#526070]";
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
          <div className="absolute left-[30px] right-[30px] top-[31px] hidden h-[2px] rounded-full bg-[#E5EAF2] lg:block" />
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
                    !active && !completed && !upcoming && "border-[#D8DEE8] bg-[#F7F9FC] text-[#7A8699]",
                    clickable && "group-hover:border-[#8DBBFF]",
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
                  <span className="mt-2 block text-sm font-semibold text-[#0F1F3D] md:text-[15px]">
                    {step.title}
                  </span>
                  <span
                    className={cn(
                      "mt-2 inline-flex rounded-full px-3 py-1 text-[11px] font-semibold",
                      active && "bg-[var(--semantic-action-soft)] text-[var(--semantic-action)]",
                      upcoming && "bg-[var(--semantic-collab-soft)] text-[var(--semantic-collab)]",
                      !active && !upcoming && allowed && "bg-[#F2F4F7] text-[#667085]",
                      !allowed && "bg-[#F2F4F7] text-[#667085]",
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
                    "mx-auto mt-2 max-w-[180px] text-xs leading-5 text-[#667085] md:max-w-[220px]",
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
          <div className="rounded-md border border-[#DDE5EF] bg-[#FBFCFF] p-4 text-sm leading-6 text-[#526070]">
            Esta proposta ainda não está aberta para o setor. Enquanto estiver neste estado, apenas o proponente e a
            chefia conseguem vê-la.
          </div>
          <div className="grid gap-3 rounded-md border border-[#E2E8F0] bg-white p-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Descrição</p>
              <p className="mt-2 text-[#344054]">{detail.room.description || "Sem descrição registrada."}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Escopo</p>
              <p className="mt-2 text-[#344054]">{detail.room.scope || "Sem escopo registrado."}</p>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-[#DDE5EF] bg-[#F7FBFF] p-4">
          <h3 className="text-sm font-semibold text-[#0B3473]">Publicação da chefia</h3>
          <p className="mt-2 text-sm leading-6 text-[#526070]">
            Depois da publicação, a sala passa a receber contribuições dos pares. Antes disso, ela funciona apenas
            como rascunho de proposta.
          </p>
          {canPublish ? (
            <button
              type="button"
              onClick={onPublish}
              disabled={updatingStatus}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UsersThree size={17} weight="bold" />
              {updatingStatus ? "Publicando..." : "Publicar para o setor"}
            </button>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-[#CBD5E1] bg-white p-3 text-sm text-[#667085]">
              Aguarde a chefia publicar esta sala para iniciar a coautoria.
            </p>
          )}
        </div>
      </div>
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
      <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Catálogo de itens" />
      <p className="mt-1 text-xs text-[#667085]">Pesquise por nome, código, GND ou natureza da despesa.</p>
      <form onSubmit={props.submitCatalogSearch} className="mt-4 flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667085]" />
          <input
            value={props.catalogSearch}
            onChange={(event) => props.setCatalogSearch(event.target.value)}
            className="h-11 w-full rounded-md border border-[#0B63CE] bg-white pl-11 pr-10 text-sm outline-none focus:ring-2 focus:ring-[#BBD6FF]"
            placeholder="Buscar por nome ou código"
          />
          {props.catalogSearch && (
            <button
              type="button"
              onClick={props.clearCatalogSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]"
              aria-label="Limpar busca"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={props.clearCatalogSearch}
          className="h-11 rounded-md border border-[#CBD5E1] px-5 text-sm font-semibold text-[#0B3473]"
        >
          Limpar
        </button>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#063F8F] px-5 text-sm font-semibold text-white"
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
              "inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm font-semibold",
              props.catalogFilter === filter.id
                ? "border-[#063F8F] bg-[#063F8F] text-white"
                : "border-[#D8E0EA] bg-white text-[#344054]",
            )}
          >
            {filter.label}
            {typeof filter.count === "number" && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs", props.catalogFilter === filter.id ? "bg-white/20" : "bg-[#EEF2F7]")}>
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between text-xs text-[#667085]">
        <span>{props.catalogItems.length} resultado(s) encontrados</span>
        <span className="inline-flex items-center gap-1">
          Ordenar por: <strong className="text-[#0F172A]">Relevância</strong> <CaretDown size={13} weight="bold" />
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {props.catalogLoading && <p className="text-sm text-[#667085]">Buscando catálogo...</p>}
        {props.catalogItems.map((item, index) => {
          const expenseBadge = getCatalogExpenseBadge(
            item.gnd_preferencial ||
              deriveGndFromNatureza(item.codigo_natureza_preferencial),
          );
          const itemKey = getCatalogItemKey(item);
          const selected = props.cartItemKeys.has(itemKey);
          const active = props.activeCatalogItemKey === itemKey;
          return (
            <button
              key={`${item.id}-${item.codigo_efisco || item.codigo_tce}`}
              type="button"
              onClick={(event) => props.addItemToCart({ ...item, searchPosition: index }, event)}
              className={cn(
                "group relative grid gap-2 overflow-hidden rounded-md border p-4 text-left transition",
                active
                  ? "border-[#0B63CE] bg-[#F7FBFF] shadow-[0_0_0_1px_#0B63CE]"
                  : selected
                    ? "border-[#7DB8FF] bg-[#F7FBFF]"
                  : "border-[#E2E8F0] bg-white hover:border-[#BBD6FF] hover:bg-[#FBFCFF]",
              )}
            >
              {selected && (
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-[#BBD6FF] bg-white px-2 py-1 text-[10px] font-semibold uppercase text-[#0B4AA2] shadow-sm">
                  <ShoppingCart size={12} weight="fill" /> No carrinho
                </span>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className={cn("min-w-0", selected && "pr-24")}>
                  <p className="text-sm font-semibold leading-5 text-[#0B3473]">
                    {item.descricao}
                  </p>
                  <p className="mt-1 text-xs text-[#526070]">
                    Código: {item.codigo_efisco || item.codigo_tce || item.id} ·{" "}
                    {item.nome_classe || item.classe || item.nome_grupo || item.grupo || "Sem categoria"} ·{" "}
                    {expenseBadge.detail}
                  </p>
                </div>
                <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase", expenseBadge.className)}>
                  {expenseBadge.label}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-[#344054]">
                {item.tipo_objeto || "Item do catálogo e-Fisco disponível para composição da DFD coletiva."}
              </p>
            </button>
          );
        })}
        {!props.catalogLoading && props.catalogQuery && props.catalogItems.length === 0 && (
          <div className="rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-6 text-center text-sm text-[#667085]">
            Nenhum item encontrado. Tente termos mais gerais, parte do código e-Fisco ou uma palavra da classe.
          </div>
        )}
        {(props.catalogPageState.hasPrevious || props.catalogHasMore || props.rawCatalogItems.length > 0) && (
          <div className="flex flex-col gap-2 rounded-md border border-[#E2E8F0] bg-[#FBFCFF] p-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-[#667085]">
              Página {props.catalogPageState.displayPage} · {props.rawCatalogItems.length} resultado(s)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => props.setCatalogPage((current) => Math.max(0, current - 1))}
                disabled={!props.catalogPageState.hasPrevious || props.catalogLoading}
                className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#0B4AA2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => props.setCatalogPage((current) => current + 1)}
                disabled={!props.catalogHasMore || props.catalogLoading}
                className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#0B4AA2] disabled:cursor-not-allowed disabled:opacity-50"
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
  const prefersReducedMotion = useReducedMotion();
  const shouldPulse = Boolean(pulse && !prefersReducedMotion && !disabled);

  return (
    <motion.button
      {...props}
      disabled={disabled}
      className={className}
      animate={
        shouldPulse
          ? {
              scale: [1, 1.015, 1],
              boxShadow: [
                "0 0 0 0 rgba(11, 74, 162, 0.2)",
                "0 0 0 8px rgba(11, 74, 162, 0)",
                "0 0 0 0 rgba(11, 74, 162, 0)",
              ],
            }
          : { scale: 1, boxShadow: "0 0 0 0 rgba(11, 74, 162, 0)" }
      }
      transition={
        shouldPulse
          ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          : { duration: 0.2 }
      }
    >
      {children}
    </motion.button>
  );
}

function SelectionFloatingBar({
  activeCartItem,
  pendingCount,
  consolidatedCount,
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
    : `Total consolidado ate aqui: ${formatCurrency(totalValue)}`;

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
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-full border border-[#DDE5EF] bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center sm:justify-between">
            <button
              ref={cartTargetRef}
              type="button"
              onClick={onOpen}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-full px-4 py-2 text-left transition hover:bg-[#F8FAFC]"
            >
              <motion.span
                key={cartPulseKey}
                initial={{ scale: 0.92, rotate: 0 }}
                animate={{ scale: [0.92, 1.14, 1], rotate: [0, -8, 6, 0] }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#0B4AA2]"
              >
                <ShoppingCart size={20} weight="fill" />
                {hasPendingItems && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#063F8F] px-1 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </motion.span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#0F172A]">
                  {activeCartItem ? activeCartItem.item.descricao : title}
                </span>
                <span className="mt-0.5 block text-xs text-[#526070]">
                  {activeCartItem
                    ? `${description} · Editando item selecionado`
                    : description}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 gap-2 px-1 pb-1 sm:pb-0">
              <button
                type="button"
                onClick={onOpenRequested}
                className="h-10 rounded-full border border-[#CBD5E1] px-4 text-sm font-semibold text-[#0B4AA2] transition hover:bg-[#F7FBFF]"
              >
                Já solicitados ({requestedCount})
              </button>
              <button
                type="button"
                onClick={onOpen}
                className="h-10 rounded-full border border-[#CBD5E1] px-4 text-sm font-semibold text-[#0B4AA2] transition hover:bg-[#F7FBFF]"
              >
                {hasPendingItems ? "Revisar" : "Ver resumo"}
              </button>
              <PulsingCtaButton
                type="button"
                onClick={onContinue}
                disabled={canConsolidate && consolidatedCount === 0}
                pulse
                className="h-10 rounded-full bg-[#063F8F] px-5 text-sm font-semibold text-white transition hover:bg-[#083A7E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {canConsolidate ? "Consolidar" : "Finalizar"}
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
            className="absolute -left-10 top-1/2 h-1 w-12 -translate-y-1/2 rounded-full bg-gradient-to-r from-[#0B63CE] to-transparent blur-[1px]"
          />
          <div className="max-w-[240px] truncate rounded-full border border-[#BBD6FF] bg-white px-3 py-2 text-xs font-semibold text-[#0B3473] shadow-[0_12px_28px_rgba(11,74,162,0.2)]">
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
            className="fixed inset-0 z-[70] bg-[#0F172A]/35 backdrop-blur-[2px]"
          />
          <motion.aside
            initial={{ x: 560 }}
            animate={{ x: 0 }}
            exit={{ x: 560 }}
            transition={{ type: "spring", damping: 30, stiffness: 290 }}
            className="fixed right-0 top-0 z-[80] flex h-screen w-full max-w-[540px] flex-col border-l border-[#DDE5EF] bg-[#F8FAFC] shadow-2xl"
          >
            <div className="flex h-[82px] items-center justify-between border-b border-[#DDE5EF] bg-white px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#667085]">
                  Apoio de preenchimento
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#0B3473]">
                  Sua seleção nesta sala
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar seleção"
                className="flex h-10 w-10 items-center justify-center rounded-md border border-[#CBD5E1] bg-white text-[#0B4AA2] transition hover:bg-[#F7FBFF]"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-b border-[#DDE5EF] bg-white px-5 py-4">
              <DrawerMetric label="No carrinho" value={cartItems.length} />
              <DrawerMetric label="Subtotal pendente" value={formatCurrency(pendingCartValue)} />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <section ref={cartSectionRef} className="rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <SectionTitle icon={<ShoppingCart size={18} weight="fill" />} title="Itens no carrinho" />
                {cartItems.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-4 text-center text-sm text-[#667085]">
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
                                ? "border-[#0B63CE] bg-[#F7FBFF] shadow-[0_0_0_1px_#0B63CE]"
                                : "border-[#E2E8F0] bg-white hover:border-[#BBD6FF]",
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setActiveCartId(cartItem.cartId)}
                              className="min-w-0 text-left"
                            >
                              <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#0B3473]">
                                {cartItem.item.descricao}
                              </p>
                              <p className="mt-1 text-xs text-[#526070]">
                                Qtd. {cartItem.quantidade} · {formatCurrency(getDraftSubtotal(cartItem))}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCartItem(cartItem.cartId)}
                              aria-label="Remover item do carrinho"
                              className="flex h-8 w-8 items-center justify-center rounded-md text-[#B42318] transition hover:bg-[#FEF3F2]"
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

              <section ref={requestedSectionRef} className="mt-4 rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <SectionTitle icon={<UsersThree size={18} weight="bold" />} title="Itens já solicitados por você" />
                {contributions.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-4 text-center text-sm text-[#667085]">
                    Você ainda não solicitou itens nesta sala.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[#EEF2F7]">
                    {contributions.map((contribution) => (
                      <div key={contribution.id} className="py-3">
                        <div className="flex items-start gap-3">
                          <UserAvatar
                            name={contribution.user_name || contribution.user_email || "Usuário"}
                            avatarUrl={contribution.user_avatar_url || null}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#0F172A]">
                              {contribution.descricao}
                            </p>
                            <p className="mt-1 text-xs text-[#526070]">
                              Minha quantidade: {contribution.quantidade} · Valor unit.: {formatCurrency(contribution.valor_unitario_estimado)}
                            </p>
                            <p className="mt-1 text-[11px] text-[#8A94A6]">
                              {formatDateTime(contribution.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onAddMoreContribution(contribution)}
                            className="inline-flex h-8 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0B4AA2] hover:bg-[#F1F5F9]"
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
                                ? "border-[#F4C7C3] bg-white text-[#B42318] hover:bg-[#FEF3F2]"
                                : "border-[#D5DCE6] bg-[#F8FAFC] text-[#667085]",
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

              <section className="mt-4 rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
                <SectionTitle icon={<Package size={18} weight="bold" />} title="Itens adicionados por outras pessoas" />
                {itemsFromOthers.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-4 text-center text-sm text-[#667085]">
                    Ainda não há itens de outros participantes para complementar.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[#EEF2F7]">
                    {itemsFromOthers.slice(0, 6).map((item) => {
                      const key = `${item.codigo_item_efisco || item.codigo_tce}-${item.gnd || item.gnd_derivado}`;
                      return (
                        <div key={key} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#0F172A]">
                              {item.descricao}
                            </p>
                            <button
                              type="button"
                              onClick={() => onRequestFromOtherItem(item)}
                              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0B4AA2] hover:bg-[#F1F5F9]"
                            >
                              <Plus size={13} weight="bold" />
                              Adicionar minha quantidade
                            </button>
                          </div>
                          <p className="mt-1 text-xs text-[#526070]">
                            Qtd. {item.quantidade} · {item.gnd || item.gnd_derivado || "GND não informado"}
                          </p>
                        </div>
                      );
                    })}
                    {itemsFromOthers.length > 6 && (
                      <p className="pt-3 text-xs font-semibold text-[#0B4AA2]">
                        + {itemsFromOthers.length - 6} item(ns) de outros participantes
                      </p>
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="border-t border-[#DDE5EF] bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <form onSubmit={addContribution}>
                  <button
                    type="submit"
                    disabled={disabled || cartItems.length === 0}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white transition hover:bg-[#083A7E] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingCart ? "Enviando..." : "Enviar itens para a sala"} <Plus size={17} weight="bold" />
                  </button>
                </form>
                <PulsingCtaButton
                  type="button"
                  onClick={onContinue}
                  disabled={canConsolidate && detail.items.length === 0}
                  pulse
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B4AA2] transition hover:bg-[#F7FBFF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canConsolidate ? "Consolidar" : "Finalizar"} <ArrowRight size={17} weight="bold" />
                </PulsingCtaButton>
              </div>
              <p className="mt-3 text-center text-xs text-[#667085]">
                Os itens do carrinho so entram na DFD coletiva quando voce confirma o envio para a sala.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-[#DDE5EF] bg-[#FBFCFF] p-3">
      <p className="text-xs text-[#526070]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[#0F172A]">{value}</p>
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
            className="fixed inset-0 z-[85] bg-[#0F172A]/45"
          />
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[90] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#DDE5EF] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.25)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[#0B3473]">Como funciona a sala coletiva</h3>
                <p className="mt-1 text-sm text-[#526070]">
                  Fluxo curto para participação em equipe e consolidação pela chefia.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#CBD5E1] text-[#0B4AA2]"
                aria-label="Fechar guia"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <ol className="mt-5 grid gap-3">
              <li className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-sm text-[#344054]">
                <strong className="text-[#0F172A]">1. Sala aberta:</strong> os membros adicionam itens e justificativas.
              </li>
              <li className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-sm text-[#344054]">
                <strong className="text-[#0F172A]">2. Consolidar:</strong> a chefia encerra coautoria e valida o recorte final.
              </li>
              <li className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-sm text-[#344054]">
                <strong className="text-[#0F172A]">3. Prévia:</strong> revisão final antes de gerar as DFDs oficiais.
              </li>
              <li className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-sm text-[#344054]">
                <strong className="text-[#0F172A]">4. Conversão:</strong> emissão das DFDs e registro completo no histórico.
              </li>
            </ol>
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
            className="fixed inset-0 z-[95] bg-[#0F172A]/45"
          />
          <motion.section
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-[100] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#F0D5D1] bg-white p-6 shadow-[0_20px_48px_rgba(15,23,42,0.24)]"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FEF3F2] text-[#B42318]">
                <ShieldWarning size={20} weight="fill" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#7A271A]">Solicitação bloqueada</h3>
                <p className="mt-2 text-sm leading-6 text-[#526070]">
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
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#063F8F] px-4 text-sm font-semibold text-white"
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
      link_referencia: "",
      justificativa_item: "",
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
        <div className="rounded-md border border-[#BBD6FF] bg-[#F7FBFF] p-4">
          {selectedItem ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-5 text-[#0B3473]">
                  {selectedItem.descricao}
                </p>
                {badge && (
                  <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold uppercase", badge.className)}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs text-[#526070]">
                Código: {selectedItem.codigo_efisco || selectedItem.codigo_tce || selectedItem.id}
              </p>
              <p className="mt-2 text-xs text-[#526070]">
                Categoria: {selectedItem.nome_classe || selectedItem.classe || selectedItem.nome_grupo || selectedItem.grupo || "Sem categoria"}
              </p>
              <p className="mt-2 text-xs text-[#526070]">GND: {badge?.detail || "Não informado"}</p>
            </>
          ) : (
            <p className="text-sm text-[#667085]">Selecione um item do catálogo para preencher a contribuição.</p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <label className="text-sm font-semibold text-[#344054]">
            Quantidade <span className="text-[#B42318]">*</span>
            <div className="mt-2 grid h-11 grid-cols-[42px_1fr_42px] rounded-md border border-[#CBD5E1] bg-white">
              <button
                type="button"
                onClick={() =>
                  setContributionDraft((current) => ({
                    ...current,
                    quantidade: Math.max(1, Number(current.quantidade || 1) - 1),
                  }))
                }
                className="text-lg text-[#0B3473]"
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
                className="w-full border-x border-[#E2E8F0] text-center text-sm outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  setContributionDraft((current) => ({
                    ...current,
                    quantidade: Number(current.quantidade || 0) + 1,
                  }))
                }
                className="text-lg text-[#0B3473]"
              >
                +
              </button>
            </div>
          </label>
          <label className="text-sm font-semibold text-[#344054]">
            Valor unitário (R$) <span className="text-[#B42318]">*</span>
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
              className="mt-2 h-11 w-full rounded-md border border-[#CBD5E1] px-4 text-sm outline-none focus:border-[#0B63CE]"
            />
          </label>
        </div>

        <div className="mt-4 rounded-md border border-[#E2E8F0] bg-[#FBFCFF] p-4">
          <p className="text-xs text-[#667085]">Subtotal</p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A]">{formatCurrency(subtotal)}</p>
        </div>

        <label className="mt-4 block text-sm font-semibold text-[#344054]">
          Link de referência
          <div className="relative mt-2">
            <LinkSimple size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667085]" />
            <input
              value={contributionDraft.link_referencia}
              onChange={(event) =>
                setContributionDraft((current) => ({
                  ...current,
                  link_referencia: event.target.value,
                }))
              }
              className="h-11 w-full rounded-md border border-[#CBD5E1] pl-11 pr-4 text-sm outline-none focus:border-[#0B63CE]"
              placeholder="https://..."
            />
          </div>
        </label>

        <label className="mt-4 block text-sm font-semibold text-[#344054]">
          Justificativa <span className="text-[#B42318]">*</span>
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
            className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm outline-none focus:border-[#0B63CE]"
            placeholder="Informe a finalidade, o setor beneficiado e o critério da quantidade estimada para este item."
          />
          <span className="mt-1 block text-xs font-normal text-[#667085]">
            {contributionDraft.justificativa_item.length}/500 caracteres
          </span>
        </label>

        <button
          type="submit"
          disabled={disabled || cartCount === 0}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={17} weight="bold" /> {savingCart ? "Enviando..." : "Enviar carrinho para a sala"}
        </button>
        <p className="mt-3 text-center text-xs text-[#667085]">
          Todos os itens preenchidos do carrinho serao incluidos em Itens consolidados.
        </p>
      </form>
    </Panel>
  );
}

function ConsolidationPanel({
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
    <Panel>
      <div>
        <div>
          <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Itens consolidados" />
          <p className="mt-2 text-xs text-[#667085]">
            A coautoria já foi encerrada. Agora a chefia consolida, ajusta e decide o que segue para a prévia de conversão.
          </p>
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

function ConsolidatedItemsTable({
  items,
  canContribute = false,
  onRequestContribution,
  viewerUserId,
}: {
  items: AggregatedItem[];
  canContribute?: boolean;
  onRequestContribution?: (item: AggregatedItem) => void;
  viewerUserId?: string | null;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-8 text-center text-sm text-[#667085]">
        Nenhum item adicionado à sala.
      </div>
    );
  }
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="border-b border-[#DDE5EF] text-xs font-semibold text-[#526070]">
            <th className="py-3 pr-4">Item</th>
            <th className="px-4 py-3">GND</th>
            <th className="px-4 py-3 text-right">Qtd. total</th>
            <th className="px-4 py-3 text-right">Valor unit. (R$)</th>
            <th className="px-4 py-3 text-right">Valor total (R$)</th>
            <th className="px-4 py-3">Participantes</th>
            <th className="py-3 pl-4 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const badge = getCatalogExpenseBadge(item.gnd || item.gnd_derivado || item.codigo_natureza_despesa);
            const myQuantity = getViewerQuantityForItem(item, viewerUserId);
            return (
              <tr key={`${item.codigo_item_efisco || item.codigo_tce}-${item.gnd}`} className="border-b border-[#E2E8F0]">
                <td className="max-w-[300px] py-4 pr-4 align-top">
                  <p className="text-sm font-semibold leading-5 text-[#0F172A]">{item.descricao}</p>
                  <p className="mt-1 text-xs text-[#526070]">
                    Código: {item.codigo_item_efisco || item.codigo_tce || "Sem código"} · {item.nome_classe || item.nome_grupo || "Sem categoria"}
                  </p>
                  <span className={cn("mt-2 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold uppercase", badge.className)}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-4 align-top text-sm text-[#0F172A]">
                  <p>{item.gnd || item.gnd_derivado || "Não informado"}</p>
                  <p className="mt-1 text-xs text-[#526070]">{badge.elementLabel}</p>
                </td>
                <td className="px-4 py-4 text-right align-top text-sm font-semibold">{item.quantidade}</td>
                <td className="px-4 py-4 text-right align-top text-sm font-semibold">{formatCurrency(item.valor_unitario_estimado)}</td>
                <td className="px-4 py-4 text-right align-top text-sm font-semibold">{formatCurrency(getItemSubtotal(item))}</td>
                <td className="px-4 py-4 align-top">
                  <ParticipantDots contributors={item.contributors || []} />
                  <p className="mt-1 text-[11px] font-semibold text-[#0B4AA2]">
                    Minha quantidade: {myQuantity}
                  </p>
                </td>
                <td className="py-4 pl-4 text-right align-top">
                  {canContribute ? (
                    <button
                      type="button"
                      onClick={() => onRequestContribution?.(item)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0B4AA2] hover:bg-[#F1F5F9]"
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
        className="rounded-md p-2 text-[#0B3473] hover:bg-[#F1F5F9]"
        aria-label="Mais ações"
      >
        <DotsThreeVertical size={18} weight="bold" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-20 w-56 rounded-md border border-[#DDE5EF] bg-white p-1 text-left shadow-lg">
          <button
            type="button"
            onClick={() =>
              copyText(item.descricao || "", "Descrição copiada.")
            }
            className="flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F7FAFC]"
          >
            Copiar descrição
          </button>
          <button
            type="button"
            onClick={() =>
              copyText(item.codigo_item_efisco || item.codigo_tce || "", "Código copiado.")
            }
            className="mt-1 flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F7FAFC]"
          >
            Copiar código
          </button>
          <button
            type="button"
            onClick={() => {
              toast.info(participantSummary || "Sem participantes identificados.");
              setOpen(false);
            }}
            className="mt-1 flex w-full items-center rounded-md px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F7FAFC]"
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
      <h2 className="text-base font-semibold text-[#0B3473]">Resumo da consolidação</h2>
      <SummaryRows detail={detail} breakdown={breakdown} totalValue={totalValue} />
      <div className="mt-5 rounded-md border border-[#DDE5EF] bg-[#F7FBFF] p-4 text-xs leading-5 text-[#667085]">
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
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {ctaLabel} <ArrowRight size={17} weight="bold" />
      </PulsingCtaButton>
      <button
        type="button"
        onClick={onSaveAndExit}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B4AA2]"
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
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Neste ponto, a chefia já conduz a sala. Revise o texto final, a separação por natureza da despesa e a
            coerência dos itens antes de gerar as DFDs oficiais.
          </p>
        </div>
      </div>
      <div className="mt-5 flex gap-5 border-b border-[#DDE5EF]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setReviewTab(tab.id)}
            className={cn(
              "border-b-2 px-3 pb-3 text-sm font-semibold",
              reviewTab === tab.id
                ? "border-[#0B63CE] text-[#0B3473]"
                : "border-transparent text-[#526070]",
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
          <label className="text-sm font-semibold text-[#344054]">
            Título
            <input disabled={!canEditMetadata} name="title" defaultValue={detail.room.title} className="mt-2 h-11 w-full rounded-md border border-[#CBD5E1] px-4 text-sm outline-none focus:border-[#0B63CE] disabled:bg-[#F8FAFC] disabled:text-[#667085]" />
          </label>
          <label className="text-sm font-semibold text-[#344054]">
            Justificativa geral da DFD coletiva
            <textarea disabled={!canEditMetadata} name="description" defaultValue={detail.room.description || ""} rows={4} className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm outline-none focus:border-[#0B63CE] disabled:bg-[#F8FAFC] disabled:text-[#667085]" />
          </label>
          <label className="text-sm font-semibold text-[#344054]">
            Escopo
            <textarea disabled={!canEditMetadata} name="scope" defaultValue={detail.room.scope || ""} rows={4} className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm outline-none focus:border-[#0B63CE] disabled:bg-[#F8FAFC] disabled:text-[#667085]" />
          </label>
          {canEditMetadata ? (
            <button type="submit" disabled={savingMeta} className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[#063F8F] px-4 text-sm font-semibold text-white disabled:opacity-60">
              <FloppyDisk size={16} weight="bold" /> {savingMeta ? "Salvando..." : "Salvar informações"}
            </button>
          ) : (
            <p className="text-sm text-[#667085]">Somente a chefia pode editar o texto final nesta fase.</p>
          )}
        </form>
      )}
      {reviewTab === "anexos" && (
        <div className="mt-5 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-8 text-center text-sm text-[#667085]">
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
  canConvert: boolean;
  canAdvance: boolean;
  updatingStatus: boolean;
  onAdvanceToReady: () => void;
  converting: boolean;
  onConvert: () => void;
  onSaveAndExit: () => void;
}) {
  return (
    <Panel>
      <h2 className="text-base font-semibold text-[#0B3473]">Saída prevista</h2>
      <SummaryRows detail={detail} breakdown={breakdown} totalValue={totalValue} />
      <div className="mt-5 rounded-md border border-[#DDE5EF] bg-[#FBFCFF] p-4">
        <h3 className="text-sm font-semibold text-[#0F172A]">Prévia das DFDs oficiais</h3>
        <div className="mt-3 grid gap-3">
          {previewExpenseGroups.map((group) => (
            <div key={group.expenseClass} className="rounded-md border border-[#E2E8F0] bg-white px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-[#0F172A]">{group.label}</strong>
                <span className="text-[#526070]">
                  {group.items.length} item(ns) · {formatCurrency(group.totalValue)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-md border border-[#BBD6FF] bg-[#F7FBFF] p-4 text-xs leading-5 text-[#0B4AA2]">
        A conversão cria uma DFD oficial por grupo de natureza de despesa e envia a sala para histórico.
      </div>
      <Checklist title="Checklist de revisão" checklist={checklist} />
      <div className="mt-5 border-t border-[#E2E8F0] pt-5">
        <h3 className="text-sm font-semibold text-[#0B3473]">Fluxo de aprovação</h3>
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
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#0B63CE] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updatingStatus ? "Preparando..." : "Marcar como pronta para conversão"} <ArrowRight size={17} weight="bold" />
        </button>
      )}
      <button
        type="button"
        onClick={onConvert}
        disabled={!canConvert || converting || detail.items.length === 0}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {converting ? "Gerando..." : "Encerrar sala e gerar DFD oficial"} <PaperPlaneTilt size={17} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onSaveAndExit}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B4AA2]"
      >
        <FloppyDisk size={16} weight="bold" /> Salvar rascunho e sair
      </button>
    </Panel>
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
      <div className="mt-2 flex items-center justify-between border-t border-[#E2E8F0] pt-4">
        <span className="font-semibold text-[#0B3473]">Valor total estimado</span>
        <strong className="text-xl text-[#0B4AA2]">{formatCurrency(totalValue)}</strong>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, dotClass }: { label: string; value: ReactNode; dotClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[#526070]">
        {dotClass && <span className={cn("h-2 w-2 rounded-full", dotClass)} />}
        {label}
      </span>
      <strong className="text-[#0F172A]">{value}</strong>
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
    <div className="mt-5 border-t border-[#E2E8F0] pt-5">
      <h3 className="text-sm font-semibold text-[#0F172A]">{title}</h3>
      <div className="mt-3 grid gap-3">
        {entries.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-sm text-[#526070]">
            <CheckCircle
              size={16}
              weight={checklist[key] ? "fill" : "regular"}
              className={checklist[key] ? "text-[#16A36A]" : "text-[#CBD5E1]"}
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
    <section className="mt-5 rounded-lg border border-[#E2E8F0] bg-white">
      <div className="border-b border-[#E2E8F0] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#0B3473]">Contribuições e alterações</h3>
        <p className="text-xs text-[#667085]">Resumo das principais contribuições e alterações realizadas na sala.</p>
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[#667085]">Ainda não há histórico registrado.</p>
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {events.slice(0, 4).map((event) => (
            <div key={event.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_160px]">
              <span className="flex items-center gap-2 text-[#344054]">
                {event.event_type === "contribution_adjusted_by_chefia" && (
                  <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#C2410C]">
                    Ajustado pela chefia
                  </span>
                )}
                {event.event_type === "contribution_discarded_by_chefia" && (
                  <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#B91C1C]">
                    Descartado pela chefia
                  </span>
                )}
                {event.message}
              </span>
              <span className="text-right text-[#667085]">{formatDateTime(event.created_at)}</span>
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
        <p className="text-xs text-[#526070]">{label}</p>
        <p className="text-base font-semibold text-[#0F172A]">{value}</p>
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
        compact ? "text-[11px]" : "text-xs",
        status === "proposta" && "ux-chip-insight",
        status === "aberta" && "ux-chip-collab",
        status === "em_consolidacao_chefia" && "ux-chip-warning",
        status === "pronta_para_conversao" && "ux-chip-warning",
        status === "convertida" && "ux-chip-success",
        status === "arquivada" && "bg-[#EEF2F7] text-[#526070]",
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
  const visible = contributors.slice(0, 3);
  const remaining = Math.max(0, contributors.length - visible.length);
  return (
    <div className="flex items-center">
      {visible.map((contributor, index) => (
        <span
          key={contributor.user_id}
          title={contributor.user_name || contributor.user_email || "Usuário"}
          className={cn(
            "-ml-1 first:ml-0 relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-white text-[11px] font-semibold",
            !contributor.user_avatar_url && "text-white",
            !contributor.user_avatar_url && index === 0 && "bg-[#9B8DD8]",
            !contributor.user_avatar_url && index === 1 && "bg-[#79C8E8]",
            !contributor.user_avatar_url && index === 2 && "bg-[#2F9DD8]",
          )}
        >
          {contributor.user_avatar_url ? (
            <img
              src={contributor.user_avatar_url}
              alt={contributor.user_name || contributor.user_email || "Usuário"}
              className="h-full w-full object-cover"
            />
          ) : (
            getInitial(contributor.user_name || contributor.user_email || "U")
          )}
        </span>
      ))}
      {remaining > 0 && (
        <span className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#EEF2F7] text-[11px] font-semibold text-[#526070]">
          +{remaining}
        </span>
      )}
    </div>
  );
}

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#D8E0EA] bg-[#EEF2F7] text-xs font-semibold text-[#344054]">
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

function ApprovalStep({ index, title, description }: { index: number; title: string; description: string }) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B4AA2] text-xs font-semibold text-white">{index}</span>
      <span>
        <span className="block font-semibold text-[#0F172A]">{title}</span>
        <span className="mt-1 block text-xs text-[#667085]">{description}</span>
      </span>
    </li>
  );
}

function deriveGndFromNatureza(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length >= 6) {
    return `${digits[0]}.${digits[1]}.${digits.slice(2, 4)}.${digits.slice(4, 6)}`;
  }
  return "";
}

function getCatalogExpenseBadge(value?: string | null) {
  const classification = classifyGnd(value);
  if (!classification) {
    return {
      label: "Sem GND",
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
      detail: `GND ${classification.gnd} · ${classification.elementLabel}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (classification.expenseClass === "investimento") {
    return {
      label: "Capital",
      kind: "capital" as const,
      elementCode: classification.elementCode,
      elementLabel: classification.elementLabel,
      detail: `GND ${classification.gnd} · ${classification.elementLabel}`,
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  return {
    label: "Outra natureza",
    kind: "outro" as const,
    elementCode: classification.elementCode,
    elementLabel: classification.elementLabel,
    detail: `GND ${classification.gnd} · ${classification.elementLabel}`,
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
  return String(item.codigo_efisco || item.codigo_tce || item.id);
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
    link_referencia: "",
    justificativa_item: "",
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
