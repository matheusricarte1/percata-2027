"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
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
import {
  ArrowLeft,
  ArrowRight,
  CaretDown,
  CheckCircle,
  ClipboardText,
  CurrencyDollar,
  DownloadSimple,
  DotsThreeVertical,
  FloppyDisk,
  FunnelSimple,
  LinkSimple,
  LockSimple,
  MagnifyingGlass,
  Package,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  ShoppingCart,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { classifyGnd } from "@/lib/dfd-gnd";
import {
  COLLECTIVE_CATALOG_SEARCH_LIMIT,
  buildCollectiveCatalogFallbackFilter,
  buildCollectiveCatalogPageState,
  buildCollectiveCatalogSearchArgs,
  sanitizeCollectiveCatalogSearch,
} from "@/lib/collective-catalog-search";

type RoomStatus = "aberta" | "em_revisao" | "convertida" | "arquivada";
type FlowStage = "adicionar" | "consolidar" | "revisao" | "finalizar";
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
  descricao: string;
  quantidade: number;
  valor_unitario_estimado: number;
  justificativa_item?: string | null;
  link_referencia?: string | null;
  can_edit?: boolean;
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
    can_convert: boolean;
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
  aberta: "Aberta",
  em_revisao: "Em revisão",
  convertida: "Convertida",
  arquivada: "Arquivada",
};

const FLOW_STEPS: Array<{
  id: FlowStage;
  title: string;
  description: string;
}> = [
  {
    id: "adicionar",
    title: "Adicionar itens",
    description: "Pesquise e adicione itens ao catálogo",
  },
  {
    id: "consolidar",
    title: "Consolidar itens",
    description: "Revise, edite e consolide os itens",
  },
  {
    id: "revisao",
    title: "Revisão",
    description: "Revise as informações da DFD coletiva",
  },
  {
    id: "finalizar",
    title: "Finalizar e enviar",
    description: "Finalize e envie para aprovação",
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
  const [savingCart, setSavingCart] = useState(false);
  const [flyingCartItems, setFlyingCartItems] = useState<FlyingCartItem[]>([]);
  const [cartPulseKey, setCartPulseKey] = useState(0);
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
    if (!roomStatus) return;
    if (roomStatus === "convertida" || roomStatus === "arquivada") {
      setActiveStage("finalizar");
      return;
    }
    if (roomStatus === "em_revisao") {
      setActiveStage("revisao");
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
        const { data, error } = await supabase.rpc(
          "buscar_catalogo_inteligente",
          buildCollectiveCatalogSearchArgs(searchTerm, offset),
        );
        if (error) throw error;
        if ((data || []).length > 0) {
          if (!active) return;
          const rows = (data || []) as CatalogItem[];
          setCatalogItems(rows);
          setCatalogHasMore(buildCollectiveCatalogPageState(catalogPage, rows.length).hasNext);
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
        setCatalogItems(rows);
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

  function addItemToCart(item: CatalogItem, event?: MouseEvent<HTMLButtonElement>) {
    const key = getCatalogItemKey(item);
    const existing = cartItems.find((cartItem) => getCatalogItemKey(cartItem.item) === key);

    if (event) {
      launchCartAnimation(event, item.descricao);
    }

    if (existing) {
      setActiveCartId(existing.cartId);
      setSelectionDrawerOpen(true);
      setCartPulseKey((current) => current + 1);
      toast.info("Item já está no carrinho.");
      return;
    }

    const nextItem = createCartDraftItem(item);
    setCartItems((current) => [...current, nextItem]);
    setActiveCartId(nextItem.cartId);
    setSelectionDrawerOpen(true);
    setCartPulseKey((current) => current + 1);
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

  async function removeContribution(contribution: Contribution) {
    if (!window.confirm("Remover esta contribuição da DFD coletiva?")) return;
    try {
      const response = await fetch(
        `/api/collective-rooms/${roomId}/contributions/${contribution.id}`,
        { method: "DELETE" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao remover.");
      toast.success("Contribuição removida.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao remover contribuição.");
    }
  }

  async function editContribution(contribution: Contribution) {
    const quantidade = window.prompt("Quantidade", String(contribution.quantidade || 1));
    if (quantidade === null) return;
    const valor = window.prompt(
      "Valor unitário estimado",
      String(contribution.valor_unitario_estimado || 0),
    );
    if (valor === null) return;
    const justificativa = window.prompt(
      "Justificativa técnica",
      String(contribution.justificativa_item || ""),
    );
    if (justificativa === null) return;

    try {
      const response = await fetch(
        `/api/collective-rooms/${roomId}/contributions/${contribution.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantidade: Number(quantidade),
            valor_unitario_estimado: Number(valor),
            justificativa_item: justificativa,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao editar.");
      toast.success("Contribuição atualizada.");
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao editar contribuição.");
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
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-6 text-[#0F172A]">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <Link
          href="/dfds-coletivas"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#0B4AA2] no-underline"
        >
          <ArrowLeft size={17} weight="bold" /> Voltar para DFDs coletivas
        </Link>

        <section className="rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0F1F3D]">DFD Coletiva</p>
              <h1 className="mt-1 truncate text-2xl font-semibold text-[#0F172A]">
                {detail.room.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-[#526070]">
                <StatusBadge status={detail.room.status} />
                <span>{detail.room.unit_name}</span>
                <span className="text-[#9AA4B2]">•</span>
                <span>Criada em {formatDateTime(detail.room.created_at)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <HeaderMetric icon={<UsersThree size={26} weight="duotone" />} label="Pessoas" value={detail.participants.length} />
                <HeaderMetric icon={<Package size={26} weight="duotone" />} label="Itens consolidados" value={detail.items.length} />
                <HeaderMetric
                  icon={<CurrencyDollar size={26} weight="bold" />}
                  label="Valor total estimado"
                  value={formatCurrency(totalValue)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={exportCollectiveCsv}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-5 text-sm font-semibold text-[#0B4AA2]"
                >
                  <DownloadSimple size={17} weight="bold" /> Exportar
                </button>
                {detail.room.can_convert && (
                  <button
                    type="button"
                    onClick={convertRoom}
                    disabled={converting || detail.items.length === 0}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#063F8F] px-5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LockSimple size={17} weight="bold" />
                    {converting ? "Gerando..." : "Encerrar sala"}
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

        {activeStage === "adicionar" && (
          <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <SideRail detail={detail} />
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
          </section>
        )}

        {activeStage === "consolidar" && (
          <section className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
            <SideRail detail={detail} compactHelp />
            <ConsolidationPanel
              detail={detail}
              totalValue={totalValue}
              setActiveStage={setActiveStage}
              editContribution={editContribution}
              removeContribution={removeContribution}
              isOpen={isOpen}
            />
            <ConsolidationSummary
              detail={detail}
              totalValue={totalValue}
              breakdown={breakdown}
              checklist={checklist}
              canEdit={canEdit}
              updatingStatus={updatingStatus}
              onContinue={() => updateRoomStatus("em_revisao", "DFD coletiva enviada para revisão.")}
              onSaveAndExit={() => router.push("/dfds-coletivas")}
            />
          </section>
        )}

        {activeStage === "revisao" && (
          <section className="grid gap-4 xl:grid-cols-[280px_1fr_360px]">
            <SideRail detail={detail} reviewMode />
            <ReviewPanel
              detail={detail}
              reviewTab={reviewTab}
              setReviewTab={setReviewTab}
              totalValue={totalValue}
              saveMetadata={saveMetadata}
              savingMeta={savingMeta}
              setActiveStage={setActiveStage}
            />
            <ApprovalSummary
              detail={detail}
              totalValue={totalValue}
              breakdown={breakdown}
              checklist={checklist}
              canConvert={detail.room.can_convert}
              converting={converting}
              onConvert={convertRoom}
              onSaveAndExit={() => router.push("/dfds-coletivas")}
            />
          </section>
        )}

        {activeStage === "finalizar" && (
          <section className="grid gap-4 xl:grid-cols-[280px_1fr]">
            <SideRail detail={detail} reviewMode />
            <section className="rounded-lg border border-[#DDE5EF] bg-white p-8 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div className="flex max-w-3xl flex-col items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#188B56]">
                  <CheckCircle size={28} weight="fill" />
                </div>
                <h2 className="text-xl font-semibold text-[#0B3473]">DFD coletiva finalizada</h2>
                <p className="text-sm leading-6 text-[#526070]">
                  A sala foi encerrada ou enviada para a próxima etapa. Quando a conversão gerar DFDs oficiais,
                  os documentos aparecem abaixo para acompanhamento.
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

        {activeStage === "adicionar" && (
          <>
            <SelectionFloatingBar
              activeCartItem={activeCartItem}
              pendingCount={cartItems.length}
              consolidatedCount={detail.items.length}
              totalValue={totalValue}
              pendingCartValue={pendingCartValue}
              cartPulseKey={cartPulseKey}
              cartTargetRef={cartTargetRef}
              onOpen={() => setSelectionDrawerOpen(true)}
              onContinue={() => setActiveStage("consolidar")}
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
              setActiveCartId={setActiveCartId}
              updateActiveCartDraft={updateActiveCartDraft}
              removeCartItem={removeCartItem}
              addContribution={addContribution}
              subtotal={selectedSubtotal}
              disabled={!isOpen || savingCart}
              savingCart={savingCart}
              detail={detail}
              pendingCartValue={pendingCartValue}
              onContinue={() => {
                setSelectionDrawerOpen(false);
                setActiveStage("consolidar");
              }}
            />
          </>
        )}
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
  return (
    <section className="rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="grid gap-4 md:grid-cols-4">
        {FLOW_STEPS.map((step, index) => {
          const completed =
            index < activeIndex ||
            (step.id === "adicionar" && itemsCount > 0) ||
            (step.id === "consolidar" && status === "em_revisao") ||
            (step.id === "finalizar" && status === "convertida");
          const active = step.id === activeStage;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStageChange(step.id)}
              className="group grid grid-cols-[36px_1fr] gap-3 text-left"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  active && "bg-[#0B63CE] text-white shadow-sm",
                  completed && !active && "bg-[#D9F8E7] text-[#168A5A]",
                  !active && !completed && "bg-[#EEF2F7] text-[#526070]",
                )}
              >
                {completed && !active ? <CheckCircle size={17} weight="fill" /> : index + 1}
              </span>
              <span>
                <span className={cn("block text-sm font-semibold", active ? "text-[#0B3473]" : "text-[#0F172A]")}>
                  {step.title}
                </span>
                <span className={cn("mt-1 block text-xs", active ? "text-[#0B4AA2]" : "text-[#667085]")}>
                  {step.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SideRail({
  detail,
  compactHelp,
  reviewMode,
}: {
  detail: RoomDetail;
  compactHelp?: boolean;
  reviewMode?: boolean;
}) {
  return (
    <aside className="flex flex-col gap-3">
      <Panel>
        <SectionTitle icon={<UsersThree size={18} weight="bold" />} title={`Participantes (${detail.participants.length})`} />
        <div className="mt-4 flex flex-col gap-3">
          {detail.participants.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-6 text-center">
              <UsersThree size={28} className="mx-auto text-[#B8C1CC]" />
              <p className="mt-3 text-sm font-medium text-[#526070]">
                Nenhuma contribuição registrada.
              </p>
              <p className="mt-1 text-xs leading-5 text-[#667085]">
                As contribuições aparecerão aqui conforme forem adicionadas.
              </p>
            </div>
          ) : (
            detail.participants.slice(0, 4).map((participant, index) => (
              <div key={participant.user_id} className="flex items-center gap-3">
                <Avatar
                  name={participant.user_name || participant.user_email || "Usuário"}
                  src={participant.user_avatar_url}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">
                      {participant.user_name || participant.user_email || "Usuário"}
                    </p>
                    <span className="rounded-full bg-[#EAF2FF] px-2 py-0.5 text-[10px] font-semibold text-[#0B4AA2]">
                      {index === 0 ? "Responsável" : "Contribuidor"}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[#667085]">
                    {participant.quantidade} item(ns) · {formatCurrency(participant.total)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Resumo da DFD coletiva" />
        <InfoRow label="Status" value={<StatusBadge status={detail.room.status} compact />} />
        <InfoRow label="Setor" value={detail.room.unit_name} />
        <InfoRow label="Criada em" value={formatDateTime(detail.room.created_at)} />
        <InfoRow label="Atualizada em" value={formatDateTime(detail.room.updated_at)} />
      </Panel>

      {reviewMode ? (
        <Panel>
          <SectionTitle icon={<MagnifyingGlass size={18} weight="bold" />} title="Navegação rápida" />
          <QuickNav label="Itens consolidados" count={detail.items.length} />
          <QuickNav label="Contribuições" count={detail.contributions.length} />
          <QuickNav label="Histórico" count={detail.events.length} />
        </Panel>
      ) : (
        <Panel>
          <SectionTitle icon={<FunnelSimple size={18} weight="bold" />} title={compactHelp ? "Precisa de ajuda?" : "Filtros rápidos"} />
          {compactHelp ? (
            <p className="mt-3 text-xs leading-5 text-[#667085]">
              Confira quantidades, valores, justificativas e participantes antes de avançar para revisão.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 text-sm text-[#344054]">
              <FilterCheck label="Apenas corrente" checked />
              <FilterCheck label="Apenas capital" />
              <FilterCheck label="Material de consumo" checked />
              <FilterCheck label="Equipamento permanente" />
            </div>
          )}
        </Panel>
      )}
    </aside>
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
  addItemToCart: (item: CatalogItem, event: MouseEvent<HTMLButtonElement>) => void;
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
        {props.catalogItems.map((item) => {
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
              onClick={(event) => props.addItemToCart(item, event)}
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

function SelectionFloatingBar({
  activeCartItem,
  pendingCount,
  consolidatedCount,
  totalValue,
  pendingCartValue,
  cartPulseKey,
  cartTargetRef,
  onOpen,
  onContinue,
}: {
  activeCartItem: CartDraftItem | null;
  pendingCount: number;
  consolidatedCount: number;
  totalValue: number;
  pendingCartValue: number;
  cartPulseKey: number;
  cartTargetRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  onContinue: () => void;
}) {
  const hasPendingItems = pendingCount > 0;
  const visible = hasPendingItems || consolidatedCount > 0;
  const title = hasPendingItems
    ? `${pendingCount} item(ns) no carrinho`
    : `${consolidatedCount} item(ns) na DFD coletiva`;
  const description = hasPendingItems
    ? `Pendente: ${formatCurrency(pendingCartValue)}`
    : `Total consolidado: ${formatCurrency(totalValue)}`;

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
                onClick={onOpen}
                className="h-10 rounded-full border border-[#CBD5E1] px-4 text-sm font-semibold text-[#0B4AA2] transition hover:bg-[#F7FBFF]"
              >
                {hasPendingItems ? "Revisar" : "Ver resumo"}
              </button>
              <button
                type="button"
                onClick={onContinue}
                disabled={consolidatedCount === 0}
                className="h-10 rounded-full bg-[#063F8F] px-5 text-sm font-semibold text-white transition hover:bg-[#083A7E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Consolidar
              </button>
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
  setActiveCartId,
  updateActiveCartDraft,
  removeCartItem,
  addContribution,
  subtotal,
  disabled,
  savingCart,
  detail,
  pendingCartValue,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  cartItems: CartDraftItem[];
  activeCartItem: CartDraftItem | null;
  setActiveCartId: (cartId: string) => void;
  updateActiveCartDraft: (update: SetStateAction<ContributionDraft>) => void;
  removeCartItem: (cartId: string) => void;
  addContribution: (event: FormEvent) => void;
  subtotal: number;
  disabled: boolean;
  savingCart: boolean;
  detail: RoomDetail;
  pendingCartValue: number;
  onContinue: () => void;
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
                  Resumo da seleção
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#0B3473]">
                  Carrinho da DFD coletiva
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
              <section className="rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
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
                <SectionTitle icon={<Package size={18} weight="bold" />} title="Itens já adicionados" />
                {detail.items.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-4 text-center text-sm text-[#667085]">
                    Nenhum item consolidado ainda.
                  </p>
                ) : (
                  <div className="mt-4 divide-y divide-[#EEF2F7]">
                    {detail.items.slice(0, 5).map((item) => {
                      const key = `${item.codigo_item_efisco || item.codigo_tce}-${item.gnd || item.gnd_derivado}`;
                      return (
                        <div key={key} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#0F172A]">
                              {item.descricao}
                            </p>
                            <strong className="shrink-0 text-sm text-[#0B4AA2]">
                              {formatCurrency(getItemSubtotal(item))}
                            </strong>
                          </div>
                          <p className="mt-1 text-xs text-[#526070]">
                            Qtd. {item.quantidade} · {item.gnd || item.gnd_derivado || "GND não informado"}
                          </p>
                        </div>
                      );
                    })}
                    {detail.items.length > 5 && (
                      <p className="pt-3 text-xs font-semibold text-[#0B4AA2]">
                        + {detail.items.length - 5} item(ns) no resumo completo
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
                    {savingCart ? "Enviando..." : "Adicionar carrinho"} <Plus size={17} weight="bold" />
                  </button>
                </form>
                <button
                  type="button"
                  onClick={onContinue}
                  disabled={detail.items.length === 0}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-white text-sm font-semibold text-[#0B4AA2] transition hover:bg-[#F7FBFF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Consolidar <ArrowRight size={17} weight="bold" />
                </button>
              </div>
              <p className="mt-3 text-center text-xs text-[#667085]">
                Itens do carrinho só entram na DFD coletiva após clicar em Adicionar carrinho.
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
          <Plus size={17} weight="bold" /> {savingCart ? "Enviando..." : "Adicionar carrinho à sala"}
        </button>
        <p className="mt-3 text-center text-xs text-[#667085]">
          Todos os itens preenchidos do carrinho serão incluídos em Itens consolidados.
        </p>
      </form>
    </Panel>
  );
}

function ConsolidationPanel({
  detail,
  totalValue,
  setActiveStage,
  editContribution,
  removeContribution,
  isOpen,
}: {
  detail: RoomDetail;
  totalValue: number;
  setActiveStage: (stage: FlowStage) => void;
  editContribution: (contribution: Contribution) => void;
  removeContribution: (contribution: Contribution) => void;
  isOpen: boolean;
}) {
  return (
    <Panel>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionTitle icon={<ClipboardText size={18} weight="bold" />} title="Itens consolidados" />
          <p className="mt-2 text-xs text-[#667085]">
            Revise os itens adicionados à sala. Você pode editar quantidades, valores e justificativas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveStage("adicionar")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#CBD5E1] px-4 text-sm font-semibold text-[#0B4AA2]"
        >
          <Plus size={16} weight="bold" /> Adicionar mais itens
        </button>
      </div>
      <ConsolidatedItemsTable items={detail.items} />
      <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-sm">
        <span className="text-[#526070]">{detail.items.length} itens</span>
        <span className="font-semibold text-[#0B3473]">
          Total estimado <strong className="ml-4 text-lg text-[#0B4AA2]">{formatCurrency(totalValue)}</strong>
        </span>
      </div>
      <ContributionsTable
        contributions={detail.contributions}
        editContribution={editContribution}
        removeContribution={removeContribution}
        isOpen={isOpen}
      />
    </Panel>
  );
}

function ConsolidatedItemsTable({ items }: { items: AggregatedItem[] }) {
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
                </td>
                <td className="py-4 pl-4 text-right align-top">
                  <button type="button" className="rounded-md p-2 text-[#0B3473] hover:bg-[#F1F5F9]" aria-label="Mais ações">
                    <DotsThreeVertical size={18} weight="bold" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ContributionsTable({
  contributions,
  editContribution,
  removeContribution,
  isOpen,
}: {
  contributions: Contribution[];
  editContribution: (contribution: Contribution) => void;
  removeContribution: (contribution: Contribution) => void;
  isOpen: boolean;
}) {
  return (
    <section className="mt-6 rounded-lg border border-[#E2E8F0] bg-white">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0B3473]">Contribuições recentes</h3>
          <p className="text-xs text-[#667085]">Acompanhe as últimas ações realizadas pelos participantes.</p>
        </div>
      </div>
      {contributions.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-[#667085]">Ainda não há contribuições nesta sala.</p>
      ) : (
        <div className="divide-y divide-[#E2E8F0]">
          {contributions.slice(0, 5).map((contribution) => (
            <div key={contribution.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[180px_1fr_auto] md:items-center">
              <div className="flex items-center gap-2">
                <Avatar name={contribution.user_name || contribution.user_email || "Usuário"} src={contribution.user_avatar_url || null} size="xs" />
                <span className="truncate font-semibold text-[#344054]">{contribution.user_name || contribution.user_email || "Usuário"}</span>
              </div>
              <p className="text-[#344054]">
                adicionou {contribution.quantidade} unidade(s) do item “{contribution.descricao}”
              </p>
              {contribution.can_edit && isOpen && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => editContribution(contribution)} className="rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0B4AA2]">
                    Editar
                  </button>
                  <button type="button" onClick={() => removeContribution(contribution)} className="rounded-md border border-[#FCA5A5] px-3 py-2 text-xs font-semibold text-[#B42318]">
                    Remover
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
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
  return (
    <Panel>
      <h2 className="text-base font-semibold text-[#0B3473]">Resumo da consolidação</h2>
      <SummaryRows detail={detail} breakdown={breakdown} totalValue={totalValue} />
      <div className="mt-5 rounded-md border border-[#DDE5EF] bg-[#F7FBFF] p-4 text-xs leading-5 text-[#667085]">
        O valor total é uma estimativa baseada nos valores unitários informados pelos participantes.
      </div>
      <Checklist title="Antes de avançar, verifique:" checklist={checklist} />
      <button
        type="button"
        onClick={onContinue}
        disabled={!canEdit || updatingStatus || detail.items.length === 0}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {updatingStatus ? "Enviando..." : "Continuar para revisão"} <ArrowRight size={17} weight="bold" />
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

function ReviewPanel({
  detail,
  reviewTab,
  setReviewTab,
  totalValue,
  saveMetadata,
  savingMeta,
  setActiveStage,
}: {
  detail: RoomDetail;
  reviewTab: ReviewTab;
  setReviewTab: (tab: ReviewTab) => void;
  totalValue: number;
  saveMetadata: (event: FormEvent<HTMLFormElement>) => void;
  savingMeta: boolean;
  setActiveStage: (stage: FlowStage) => void;
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
          <SectionTitle icon={<UsersThree size={18} weight="bold" />} title="Revisão da DFD coletiva" />
          <p className="mt-2 text-xs text-[#667085]">
            Confira todos os itens consolidados, justificativas e informações antes de finalizar e enviar para aprovação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveStage("consolidar")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#CBD5E1] px-4 text-sm font-semibold text-[#0B4AA2]"
        >
          <PencilSimple size={16} weight="bold" /> Editar itens
        </button>
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
        <>
          <ConsolidatedItemsTable items={detail.items} />
          <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-4 text-sm">
            <span className="text-[#526070]">{detail.items.length} itens consolidados</span>
            <span className="font-semibold text-[#0B3473]">
              Valor total estimado <strong className="ml-4 text-lg text-[#0B4AA2]">{formatCurrency(totalValue)}</strong>
            </span>
          </div>
        </>
      )}
      {reviewTab === "informacoes" && (
        <form onSubmit={saveMetadata} className="mt-5 grid gap-4">
          <input type="hidden" name="status" value={detail.room.status} />
          <label className="text-sm font-semibold text-[#344054]">
            Título
            <input name="title" defaultValue={detail.room.title} className="mt-2 h-11 w-full rounded-md border border-[#CBD5E1] px-4 text-sm outline-none focus:border-[#0B63CE]" />
          </label>
          <label className="text-sm font-semibold text-[#344054]">
            Justificativa geral da DFD coletiva
            <textarea name="description" defaultValue={detail.room.description || ""} rows={4} className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm outline-none focus:border-[#0B63CE]" />
          </label>
          <label className="text-sm font-semibold text-[#344054]">
            Escopo
            <textarea name="scope" defaultValue={detail.room.scope || ""} rows={4} className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm outline-none focus:border-[#0B63CE]" />
          </label>
          <button type="submit" disabled={savingMeta} className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-[#063F8F] px-4 text-sm font-semibold text-white disabled:opacity-60">
            <FloppyDisk size={16} weight="bold" /> {savingMeta ? "Salvando..." : "Salvar informações"}
          </button>
        </form>
      )}
      {reviewTab === "anexos" && (
        <div className="mt-5 rounded-md border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-8 text-center text-sm text-[#667085]">
          Nenhum anexo registrado nesta versão da DFD coletiva.
        </div>
      )}
      <div className="mt-5 rounded-md border border-[#E2E8F0] bg-[#FBFCFF] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#0B3473]">Justificativa geral da DFD coletiva</h3>
            <p className="mt-1 text-xs leading-5 text-[#526070]">
              {detail.room.description || detail.room.scope || "Ainda não há justificativa geral registrada."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReviewTab("informacoes")}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#0B4AA2]"
          >
            <PencilSimple size={14} weight="bold" /> Editar justificativa
          </button>
        </div>
      </div>
      <EventsPanel events={detail.events} />
    </Panel>
  );
}

function ApprovalSummary({
  detail,
  totalValue,
  breakdown,
  checklist,
  canConvert,
  converting,
  onConvert,
  onSaveAndExit,
}: {
  detail: RoomDetail;
  totalValue: number;
  breakdown: ExpenseBreakdown;
  checklist: Record<string, boolean>;
  canConvert: boolean;
  converting: boolean;
  onConvert: () => void;
  onSaveAndExit: () => void;
}) {
  return (
    <Panel>
      <h2 className="text-base font-semibold text-[#0B3473]">Resumo para aprovação</h2>
      <SummaryRows detail={detail} breakdown={breakdown} totalValue={totalValue} />
      <div className="mt-5 rounded-md border border-[#BBD6FF] bg-[#F7FBFF] p-4 text-xs leading-5 text-[#0B4AA2]">
        Após finalizar, os responsáveis receberão a DFD oficial gerada a partir da consolidação desta sala.
      </div>
      <Checklist title="Checklist de revisão" checklist={checklist} />
      <div className="mt-5 border-t border-[#E2E8F0] pt-5">
        <h3 className="text-sm font-semibold text-[#0B3473]">Fluxo de aprovação</h3>
        <ol className="mt-4 grid gap-4 text-sm">
          <ApprovalStep index={1} title="Envio para aprovação" description="Esta DFD será enviada aos responsáveis." />
          <ApprovalStep index={2} title="Análise" description="Os responsáveis analisarão as informações." />
          <ApprovalStep index={3} title="Aprovação" description="Após aprovação, a DFD seguirá para as próximas etapas." />
        </ol>
      </div>
      <button
        type="button"
        onClick={onConvert}
        disabled={!canConvert || converting || detail.items.length === 0}
        className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {converting ? "Enviando..." : "Enviar para aprovação"} <PaperPlaneTilt size={17} weight="bold" />
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
              <span className="text-[#344054]">{event.message}</span>
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
    <div className="flex min-w-[130px] items-center gap-3 rounded-lg border border-[#DDE5EF] bg-[#FBFCFF] px-4 py-3">
      <div className="text-[#0B4AA2]">{icon}</div>
      <div>
        <p className="text-xs text-[#526070]">{label}</p>
        <p className="text-base font-semibold text-[#0F172A]">{value}</p>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-[#0B4AA2]">
      {icon}
      <h2 className="text-base font-semibold text-[#0B3473]">{title}</h2>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]", className)}>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mt-4 flex items-center justify-between gap-4 border-b border-[#EEF2F7] pb-3 text-sm last:border-b-0 last:pb-0">
      <span className="text-[#526070]">{label}</span>
      <span className="max-w-[150px] text-right font-semibold text-[#0F172A]">{value}</span>
    </div>
  );
}

function QuickNav({ label, count }: { label: string; count: number }) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="font-medium text-[#0B4AA2]">{label}</span>
      <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-xs font-semibold text-[#667085]">{count}</span>
    </div>
  );
}

function FilterCheck({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-2">
        <span className={cn("flex h-4 w-4 items-center justify-center rounded border", checked ? "border-[#0B4AA2] bg-[#0B4AA2]" : "border-[#CBD5E1] bg-white")}>
          {checked && <CheckCircle size={12} weight="fill" className="text-white" />}
        </span>
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status, compact }: { status: RoomStatus; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-3 py-1 font-semibold",
        compact ? "text-[11px]" : "text-xs",
        status === "aberta" && "bg-[#D8F8E7] text-[#087443]",
        status === "em_revisao" && "bg-[#FFF2CC] text-[#8A5A00]",
        status === "convertida" && "bg-[#EAF2FF] text-[#0B4AA2]",
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
            "-ml-1 first:ml-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white",
            index === 0 && "bg-[#9B8DD8]",
            index === 1 && "bg-[#79C8E8]",
            index === 2 && "bg-[#2F9DD8]",
          )}
        >
          {getInitial(contributor.user_name || contributor.user_email || "U")}
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

function Avatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md";
}) {
  const [broken, setBroken] = useState(false);
  const classes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-10 w-10 text-xs",
  }[size];

  if (!src || broken) {
    return (
      <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] font-semibold text-[#0B4AA2]", classes)}>
        {getInitial(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      className={cn("shrink-0 rounded-full object-cover", classes)}
    />
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
