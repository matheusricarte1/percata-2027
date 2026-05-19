"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass,
  ShoppingCart,
  Plus,
  Check,
  Heart,
  Package,
  PaintRoller,
  BookOpen,
  Queue,
  WarningCircle,
  Hash,
  X,
  Trash,
  ArrowRight,
  UsersThree,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useCarrinhoStore } from "@/store/carrinho";
import { supabase } from "@/lib/supabase";
import { ProductSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  analyzeCatalogSearchQuery,
  rerankCatalogSearchResults,
} from "@/lib/catalog-search-ranking";
import { classifyGnd } from "@/lib/dfd-gnd";
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

function sanitizeSearchInput(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

function isValidReferenceLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function deriveGndFromNatureza(value: unknown): string | null {
  const natureza = String(value || "").trim();
  if (natureza.length < 6) return null;
  return `${natureza[0]}.${natureza[1]}.${natureza.slice(2, 4)}.${natureza.slice(
    4,
    6,
  )}`;
}

function getDescriptionSize(value: unknown): "compact" | "wide" | "full" {
  const length = String(value || "").replace(/\s+/g, " ").trim().length;
  if (length > 700) return "full";
  if (length > 240) return "wide";
  return "compact";
}

function toFavoriteItemId(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function getCatalogExpenseBadge(value?: string | number | null) {
  const classification = classifyGnd(value);
  if (!classification) {
    return {
      label: "Natureza não identificada",
      detail: "Sem GND preferencial",
      className: "border-slate-200 bg-slate-50 text-slate-600",
    };
  }

  if (classification.expenseClass === "custeio") {
    return {
      label: "Corrente",
      detail: `GND ${classification.gnd} · ${classification.elementLabel}`,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (classification.expenseClass === "investimento") {
    return {
      label: "Capital",
      detail: `GND ${classification.gnd} · ${classification.elementLabel}`,
      className: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }

  return {
    label: "Outra natureza",
    detail: `GND ${classification.gnd} · ${classification.elementLabel}`,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

const categories = [
  { id: "all", label: "Tudo", icon: Queue },
  { id: "material", label: "Materiais", icon: PaintRoller },
  { id: "servico", label: "Serviços", icon: BookOpen },
  { id: "kits", label: "Kits Prontos", icon: Package },
];

const UNIT_OPTIONS = ["UN", "CX", "PCT", "KG", "L", "M", "M2", "M3"];
const MIN_ITEM_JUSTIFICATIVA_CHARS = 12;
const CATALOG_RANDOM_ID_RANGE: Record<string, { min: number; max: number }> = {
  all: { min: 471117, max: 645063 },
  material: { min: 540791, max: 645063 },
  servico: { min: 471117, max: 540790 },
};

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

function buildRandomCatalogAnchor(category: string, pageSize: number) {
  const range = CATALOG_RANDOM_ID_RANGE[category] ?? CATALOG_RANDOM_ID_RANGE.all;
  const maxStart = Math.max(range.min, range.max - pageSize * 2);
  return Math.floor(Math.random() * (maxStart - range.min + 1)) + range.min;
}

export default function CatalogoPage() {
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState("all");
  const [products, setProducts] = useState<any[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortMode, setSortMode] = useState<
    "relevance" | "name" | "code" | "favorites_first"
  >("relevance");
  const [gndFilter, setGndFilter] = useState<"all" | "material" | "servico">(
    "all",
  );
  const [classeFilter, setClasseFilter] = useState("all");
  const [onlyNotInCart, setOnlyNotInCart] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteSavingId, setFavoriteSavingId] = useState<number | null>(null);
  const [cartShakeKey, setCartShakeKey] = useState(0);
  const [cartSidebarOpen, setCartSidebarOpen] = useState(false);
  const [collectiveRooms, setCollectiveRooms] = useState<Array<{ id: string; title: string; unit_name?: string }>>([]);
  const [selectedCollectiveRoomId, setSelectedCollectiveRoomId] = useState("");
  const [sendingToCollectiveRoom, setSendingToCollectiveRoom] = useState(false);
  const [flyingChip, setFlyingChip] = useState<{
    id: string;
    label: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [flyingParticles, setFlyingParticles] = useState<FlyingParticle[]>([]);
  const cartIconRef = useRef<HTMLDivElement | null>(null);
  const emptySearchAnchorRef = useRef(CATALOG_RANDOM_ID_RANGE.all.min);
  const { addItem, items, removeItem, updateItem, clearCarrinho } = useCarrinhoStore();

  const triggerCartShake = useCallback(() => {
    setCartShakeKey((prev) => prev + 1);
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
        loadFavorites(nextUserId);
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
    const kit = kits.find((row) => row.id === kitId);
    const { data: items } = await supabase
      .from("kit_items")
      .select("*, catalogo(*)")
      .eq("kit_id", kitId);

    if (items && items.length > 0) {
      items.forEach((ki) => {
        const efiscoCode = ki.catalogo?.codigo_efisco ?? ki.catalogo?.id;
        if (!efiscoCode) return;
        addItem(
          {
            codigo_tce: String(efiscoCode),
            descricao: ki.catalogo.descricao,
            gnd:
              ki.catalogo.gnd_preferencial ||
              (normalizeTipoObjeto(ki.catalogo.tipo_objeto || ki.catalogo.tipo) ===
              "servico"
                ? "3.3.90.39"
                : "3.3.90.30"),
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
            gnd_derivado: ki.catalogo.gnd_preferencial,
            natureza_count: Number(ki.catalogo.natureza_count || 0),
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

  const cartCodeSet = useMemo(() => {
    const codes = items
      .map((item) => normalizeCode(item.item_efisco.codigo_tce))
      .filter((code): code is string => Boolean(code));
    return new Set(codes);
  }, [items]);

  const cartBlockingSummary = useMemo(() => {
    let invalidItems = 0;
    const reasons: string[] = [];

    items.forEach((item, index) => {
      const itemCode = String(item.item_efisco?.codigo_tce || index + 1);
      const quantidade = Number(item.quantidade || 0);
      const valorUnitario = Number(item.valor_unitario_estimado || 0);
      const unidade = String(item.item_efisco?.unidade_medida || "").trim();
      const justificativa = String(item.justificativa_item || "").trim();
      const linkReferencia = String(item.link_referencia || "").trim();

      const itemErrors: string[] = [];
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        itemErrors.push("quantidade inválida");
      }
      if (!unidade) {
        itemErrors.push("unidade não informada");
      }
      if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
        itemErrors.push("valor unitário deve ser maior que zero");
      }
      if (justificativa.length < MIN_ITEM_JUSTIFICATIVA_CHARS) {
        itemErrors.push("justificativa técnica obrigatória");
      }
      if (!linkReferencia) {
        itemErrors.push("link de referência obrigatório");
      } else if (!isValidReferenceLink(linkReferencia)) {
        itemErrors.push("link de referência inválido");
      }

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
    const normalized = sanitizeSearchInput(debouncedSearch).toLowerCase();
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
      next = next.filter((product) =>
        gndFilter === "servico"
          ? normalizeTipoObjeto(product.tipo_objeto || product.category) === "servico"
          : normalizeTipoObjeto(product.tipo_objeto || product.category) !== "servico",
      );
    }

    if (classeFilter !== "all") {
      next = next.filter((product) => String(product.classe) === classeFilter);
    }

    if (onlyFavorites) {
      next = next.filter((product) => favoriteIds.has(Number(product.id)));
    }

    if (onlyNotInCart) {
      next = next.filter((product) => {
        const code = normalizeCode(product.siad);
        return !code || !cartCodeSet.has(code);
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
    cartCodeSet,
    favoriteIds,
    sortMode,
  ]);

  useEffect(() => {
    const handler = setTimeout(
      () => setDebouncedSearch(sanitizeSearchInput(search)),
      350,
    );
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!cartSidebarOpen) return;

    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCartSidebarOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [cartSidebarOpen]);

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

  const fetchProductsPage = useCallback(
    async (targetPage: number, isNewSearch = false) => {
      if (selectedCat === "kits") {
        setProducts([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      if (isNewSearch) setLoading(true);

      const isEmptySearch = !sanitizeSearchInput(debouncedSearch);
      const pageSize = isEmptySearch ? PAGE_SIZE : SEARCH_PAGE_SIZE;
      const catalogColumns =
        "id,codigo_efisco,descricao,tipo,categoria,grupo,classe,tipo_objeto,codigo_grupo,nome_grupo,codigo_classe,nome_classe,codigo_material_servico,nome_material_servico,codigo_natureza_preferencial,gnd_preferencial,natureza_count,unidade_medida";

      const result = isEmptySearch
        ? await (() => {
            let query = supabase
              .from("catalogo")
              .select(catalogColumns)
              .gte("id", emptySearchAnchorRef.current + targetPage * pageSize)
              .order("id", { ascending: true })
              .limit(pageSize);

            if (selectedCat === "material") {
              query = query.eq("tipo_objeto", "MATERIAL");
            } else if (selectedCat === "servico") {
              query = query.eq("tipo_objeto", "SERVIÇO");
            } else {
              query = query.in("tipo_objeto", ["MATERIAL", "SERVIÇO"]);
            }

            return query;
          })()
        : await fetch(
            `/api/catalog-search?q=${encodeURIComponent(
              sanitizeSearchInput(debouncedSearch),
            )}&category=${encodeURIComponent(selectedCat)}&limit=${pageSize}&offset=${
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
        toast.error("Falha ao consultar catálogo inteligente.");
      }

      if (data) {
        const newProducts = data.map((p: any, idx: number) => {
          const normalizedCode =
            normalizeCode(p.codigo_efisco) ??
            normalizeCode(p.codigo_tce) ??
            normalizeCode(p.id) ??
            `CUSTOM-${targetPage * pageSize + idx + 1}`;

          return {
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
            gnd:
              p.gnd_preferencial ||
              deriveGndFromNatureza(p.codigo_natureza_preferencial) ||
              (normalizeTipoObjeto(p.tipo_objeto || p.tipo || p.categoria) ===
              "servico"
                ? "3.3.90.39"
                : "3.3.90.30"),
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
            codigo_natureza_despesa: p.codigo_natureza_preferencial,
            natureza_count: Number(p.natureza_count || 0),
            rank: Number(p.rank || 0),
          };
        });
        const rankedProducts = isEmptySearch
          ? newProducts
          : rerankCatalogSearchResults(debouncedSearch, newProducts);

        setProducts((prev) =>
          isNewSearch ? rankedProducts : [...prev, ...rankedProducts],
        );
        setHasMore(isEmptySearch ? data.length === pageSize : apiHasMore);
      }
      setLoading(false);
    },
    [debouncedSearch, selectedCat],
  );

  useEffect(() => {
    setPage(0);
    if (selectedCat === "kits") {
      setProducts([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    emptySearchAnchorRef.current = sanitizeSearchInput(debouncedSearch)
      ? CATALOG_RANDOM_ID_RANGE.all.min
      : buildRandomCatalogAnchor(selectedCat, PAGE_SIZE);
    fetchProductsPage(0, true);
  }, [debouncedSearch, selectedCat, fetchProductsPage]);

  useEffect(() => {
    if (page > 0) fetchProductsPage(page, false);
  }, [page, fetchProductsPage]);

  const handleAddProduct = useCallback(
    (product: any, sourceEl?: HTMLElement | null) => {
      const productCode = normalizeCode(
        product.siad ?? product.efiscoCode ?? product.id,
      );
      if (!productCode) {
        toast.error("Item sem código e-Fisco válido.");
        return;
      }

      if (cartCodeSet.has(productCode)) return;

      addItem(
        {
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
        },
        "Não definido",
      );

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
    [addItem, cartCodeSet, triggerCartShake],
  );

  const displayCount = selectedCat === "kits" ? kits.length : visibleProducts.length;
  const totalFound = selectedCat === "kits" ? kits.length : products.length;
  const favoritesCount = favoriteIds.size;
  const categoryLabel =
    categories.find((cat) => cat.id === selectedCat)?.label || "Tudo";

  return (
    <div className="p-6 space-y-8 pb-40 min-h-screen bg-[#F3F2F1]">
      {/* Hero + Search */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-[36px] bg-gradient-to-br from-[#164073] to-[#0D1452] p-8 text-white shadow-2xl shadow-upe-blue-deep/20 border border-white/10"
        >
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em]">
                <Queue size={14} weight="bold" />
                Catálogo institucional
              </span>
              <h1 className="font-display text-4xl font-semibold tracking-tight leading-none uppercase">
                Catálogo e-Fisco
              </h1>
              <p className="text-white/70 text-sm font-medium">
                Busca inteligente com foco em resultados relevantes para o PCA.
              </p>
            </div>
            <div className="hidden md:flex w-20 h-20 rounded-[28px] bg-white/10 border border-white/20 items-center justify-center shrink-0">
              <Package size={36} weight="duotone" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
                Exibindo
              </p>
              <p className="text-2xl font-semibold tracking-tight">
                {displayCount}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
                Categoria
              </p>
              <p className="text-sm font-semibold tracking-tight">
                {categoryLabel}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">
                Favoritos
              </p>
              <p className="text-2xl font-semibold tracking-tight">
                {favoritesCount}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative rounded-[36px] bg-white border border-[#D2D0CE] p-6 shadow-xl flex flex-col justify-between gap-6"
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40 mb-3">
              Pesquisa inteligente
            </p>
            <div className="relative">
              <MagnifyingGlass
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1C1B1F]/40"
                size={20}
                weight="bold"
              />
              <input
                type="text"
                placeholder="Pesquise por nome, SIAD ou categoria..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Pesquisar no catálogo e-Fisco"
                className="w-full pl-12 pr-6 py-4 rounded-3xl bg-[#F4F7FA] border border-[#D2D0CE] shadow-sm focus:ring-4 focus:ring-[#2D5D94]/10 focus:border-[#2D5D94]/20 transition-all font-display text-base font-semibold text-[#1C1B1F] placeholder:text-black/20"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#F4F7FA] border border-[#E7E0EC] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#2D5D94] mb-1">
              Estratégia da busca
            </p>
            <p className="text-xs text-[#49454F] font-medium leading-relaxed">
              {searchIntent === "empty" &&
                "Comece por classe, grupo ou código e-Fisco para receber resultados mais rápidos e consistentes."}
              {searchIntent === "code" &&
                "Busca em modo código: o sistema prioriza correspondências exatas e prefixos de e-Fisco."}
              {searchIntent === "text" &&
                "Busca em modo textual: o sistema pondera descrição, classe e grupo para reduzir ruído."}
              {searchIntent === "broad" &&
                "Termo muito curto detectado. Use mais caracteres para evitar itens pouco relevantes."}
            </p>
            {searchIntent === "text" &&
            (searchAnalysis.primaryTerms.length > 0 ||
              searchAnalysis.specificationTerms.length > 0) ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {searchAnalysis.primaryTerms.slice(0, 3).map((term) => (
                  <span
                    key={`primary-${term}`}
                    className="rounded-full bg-[#164073] px-3 py-1 text-[11px] font-bold text-white"
                  >
                    Foco: {term}
                  </span>
                ))}
                {searchAnalysis.specificationTerms.slice(0, 4).map((term) => (
                  <span
                    key={`spec-${term}`}
                    className="rounded-full border border-[#D2D0CE] bg-white px-3 py-1 text-[11px] font-bold text-[#164073]"
                  >
                    Refino: {term}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none bg-white border border-[#D2D0CE] rounded-2xl p-2">
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
                ? "bg-[#2D5D94] text-white shadow-md"
                : "bg-white text-[#49454F] hover:bg-black/5 border border-[#D2D0CE]",
            )}
          >
            <cat.icon size={16} weight="bold" />
            {cat.label}
          </button>
        ))}
      </div>

      {selectedCat !== "kits" && (
        <div className="rounded-2xl border border-[#D2D0CE] bg-white p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto_auto_auto] gap-2">
          <div className="h-10 px-3 rounded-xl border border-black/10 bg-[#F4F7FA] text-[11px] font-semibold uppercase tracking-wider text-[#2D5D94] flex items-center">
            Exibindo {displayCount} de {totalFound} itens
          </div>

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
            className="h-10 min-w-[180px] rounded-xl border border-black/10 px-3 text-xs font-semibold text-[#164073] bg-white outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
            aria-label="Ordenação dos itens"
          >
            <option value="relevance">Ordenar: relevância</option>
            <option value="favorites_first">Ordenar: favoritos primeiro</option>
            <option value="name">Ordenar: nome</option>
            <option value="code">Ordenar: código e-Fisco</option>
          </select>

          <select
            value={gndFilter}
            onChange={(event) =>
              setGndFilter(
                event.target.value as "all" | "material" | "servico",
              )
            }
            className="h-10 min-w-[160px] rounded-xl border border-black/10 px-3 text-xs font-semibold text-[#164073] bg-white outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
            aria-label="Filtro por tipo"
          >
            <option value="all">Tipo: todos</option>
            <option value="material">Tipo: material</option>
            <option value="servico">Tipo: serviço</option>
          </select>

          <select
            value={classeFilter}
            onChange={(event) => setClasseFilter(event.target.value)}
            className="h-10 min-w-[200px] rounded-xl border border-black/10 px-3 text-xs font-semibold text-[#164073] bg-white outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
            aria-label="Filtro por classe"
          >
            <option value="all">Classe: todas</option>
            {classeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setOnlyFavorites((prev) => !prev)}
            aria-pressed={onlyFavorites}
            className={cn(
              "h-10 px-4 rounded-xl border text-[10px] font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5",
              onlyFavorites
                ? "border-[#EC2029] bg-[#EC2029] text-white"
                : "border-black/10 bg-white text-[#EC2029] hover:bg-[#FFF1F3]",
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
              "h-10 px-4 rounded-xl border text-[10px] font-semibold uppercase tracking-widest transition-colors",
              onlyNotInCart
                ? "border-[#2D5D94] bg-[#2D5D94] text-white"
                : "border-black/10 bg-white text-[#2D5D94] hover:bg-[#E8EDF2]",
            )}
          >
            {onlyNotInCart ? "Somente não adicionados" : "Ocultar já adicionados"}
          </button>
        </div>
      )}

      {/* Masonry Layout Grid */}
      <div className="relative min-h-[400px]">
        <AnimatePresence mode="wait">
          {loading && page === 0 ? (
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
                  className="bg-white border-2 border-[#164073]/5 p-8 rounded-[40px] shadow-sm hover:shadow-xl hover:border-[#164073]/20 transition-all group shrink-0"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-[#164073] text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Package size={28} weight="fill" />
                    </div>
                    <span className="bg-slate-100 text-slate-400 text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-widest">
                      {kit.categoria}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tighter uppercase text-[#164073] mb-2">
                    {kit.nome}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mb-8 line-clamp-3">
                    {kit.descricao ||
                      "Este kit contém os itens essenciais homologados pela PROPLAN para esta atividade."}
                  </p>
                  <Button
                    onClick={() => addKitToCart(kit.id)}
                    className="w-full h-14 rounded-2xl bg-[#164073] text-white font-semibold uppercase tracking-tight hover:bg-[#164073]/90 shadow-xl shadow-upe-accent-washed-blue/60"
                  >
                    Adicionar Kit Completo
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start [grid-auto-flow:dense]">
                {visibleProducts.map((product, idx) => (
                  <ProductCard
                    key={`${product.id}-${product.siad}`}
                    product={product}
                    index={idx % 30}
                    inCart={cartCodeSet.has(String(product.siad || "").trim())}
                    isFavorite={favoriteIds.has(Number(product.id))}
                    favoritePending={favoriteSavingId === Number(product.id)}
                    onAdd={handleAddProduct}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loading}
                    className="px-8 py-3 rounded-full bg-white border border-[#E7E0EC] font-display font-semibold text-xs tracking-widest text-[#2D5D94] hover:bg-[#2D5D94] hover:text-white transition-all shadow-sm"
                  >
                    {loading ? "CARREGANDO..." : "CARREGAR MAIS REGISTROS"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <img
                src="/guidance/catalog-no-results.png"
                alt=""
                className="mb-5 aspect-[16/9] w-full max-w-[360px] object-contain"
              />
              <p className="font-display font-semibold text-xl mt-4">
                {products.length > 0
                  ? "Nenhum resultado para os filtros ativos"
                  : "Nenhum resultado relevante"}
              </p>
              <p className="mt-2 max-w-xl text-xs font-medium text-[#164073]">
                Tente buscar por código e-Fisco exato, filtrar por tipo
                (material/serviço), ou marcar seus itens recorrentes como
                favoritos para acesso rápido.
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Checkout */}
      {items.length > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <button
            type="button"
            onClick={() => setCartSidebarOpen(true)}
            aria-label="Abrir resumo do carrinho"
            className="flex items-center justify-between bg-[#1C1B1F] text-white p-2.5 pl-6 rounded-full shadow-2xl hover:scale-[1.02] transition-all w-full"
          >
            <div className="flex items-center gap-3">
              <motion.div
                ref={cartIconRef}
                key={cartShakeKey}
                initial={{ rotate: 0, scale: 1 }}
                animate={{
                  rotate: [0, -18, 14, -10, 6, 0],
                  scale: [1, 1.14, 1],
                }}
                transition={{ duration: 0.55, ease: "easeInOut" }}
              >
                <ShoppingCart
                  size={22}
                  weight="fill"
                  className="text-[#F5A3A3]"
                />
              </motion.div>
              <span className="font-display font-semibold text-xs uppercase tracking-tighter">
                {items.length} itens
              </span>
            </div>
            <div className="bg-[#2D5D94] px-7 py-3.5 rounded-full font-display font-semibold text-[10px] tracking-widest">
              PROSSEGUIR
            </div>
          </button>
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
                className="absolute -left-10 top-1/2 -translate-y-1/2 w-11 h-1 rounded-full bg-gradient-to-r from-[#2D5D94]/80 to-transparent blur-[1px]"
              />
            <div className="px-2.5 py-1 rounded-lg bg-[#2D5D94] text-white text-[10px] font-semibold uppercase tracking-widest shadow-xl">
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
              initial={{ x: 520 }}
              animate={{ x: 0 }}
              exit={{ x: 520 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 z-[80] h-screen w-full max-w-[520px] bg-white border-l border-black/10 shadow-2xl flex flex-col"
            >
              <div className="h-[92px] px-6 border-b border-black/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-black/35 font-semibold">
                    Resumo da seleção
                  </p>
                  <h3 className="font-display text-2xl font-semibold text-[#164073] uppercase tracking-tight">
                    Carrinho
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCartSidebarOpen(false)}
                  aria-label="Fechar carrinho"
                  className="w-10 h-10 rounded-xl bg-[#E8EDF2] text-[#2D5D94] flex items-center justify-center hover:bg-[#DCEAF0]"
                >
                  <X size={18} weight="bold" />
                </button>
              </div>

              <div className="p-6 border-b border-black/5 bg-[#F3F2F1] grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#D2D0CE] bg-white p-3">
                  <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                    Itens
                  </p>
                  <p className="text-2xl font-semibold text-[#164073]">{items.length}</p>
                </div>
                <div className="rounded-2xl border border-[#D2D0CE] bg-white p-3">
                  <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                    Total estimado
                  </p>
                  <p className="text-sm font-semibold text-[#164073]">
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

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {items.map((entry, index) => {
                  const justificativaTexto = String(entry.justificativa_item || "");
                  const justificativaLength = justificativaTexto.trim().length;
                  const hasJustificativa =
                    justificativaLength >= MIN_ITEM_JUSTIFICATIVA_CHARS;
                  const linkReferencia = String(entry.link_referencia || "");
                  const hasValidReferenceLink = isValidReferenceLink(linkReferencia.trim());

                  return (
                    <div
                      key={entry.uid}
                      className={cn(
                        "rounded-2xl border p-4 flex gap-3",
                        index % 2 === 0 ? "bg-[#FFFDF2]" : "bg-[#FFFBEB]",
                        hasJustificativa
                          ? "border-black/5"
                          : "border-[#C9A646]/45 shadow-[0_0_0_1px_rgba(201,166,70,0.12)]",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                          Código e-Fisco: {entry.item_efisco.codigo_tce}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#1C1B1F] leading-tight">
                          {entry.item_efisco.descricao}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-widest",
                              hasJustificativa && hasValidReferenceLink
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700",
                            )}
                          >
                            <WarningCircle size={12} weight="fill" />
                            {hasJustificativa && hasValidReferenceLink
                              ? "Item completo"
                              : "Pendência obrigatória"}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                            {justificativaLength}/240
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] uppercase tracking-widest text-black/35 font-semibold">
                          Qtd: {entry.quantidade} {entry.item_efisco.unidade_medida || "UN"} | GND:{" "}
                          {entry.item_efisco.gnd}
                        </p>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
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
                            className="mt-1 h-9 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#1C1B1F] outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
                          />
                        </label>

                        <label className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                          Unidade
                          <select
                            value={String(entry.item_efisco.unidade_medida || "UN")}
                            onChange={(event) =>
                              updateItem(index, {
                                item_efisco: {
                                  ...entry.item_efisco,
                                  unidade_medida: event.target.value,
                                },
                              })
                            }
                            className="mt-1 h-9 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#1C1B1F] outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
                          >
                            {UNIT_OPTIONS.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-[10px] font-semibold uppercase tracking-widest text-black/35">
                          Valor unitário
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={entry.valor_unitario_estimado}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              if (!Number.isFinite(nextValue)) return;
                              updateItem(index, {
                                valor_unitario_estimado: Math.max(0, nextValue),
                              });
                            }}
                            className="mt-1 h-9 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#1C1B1F] outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
                          />
                        </label>
                      </div>
                        <label className="mt-2 block text-[10px] font-semibold uppercase tracking-widest text-black/35">
                          Link de referência
                          <input
                            type="url"
                            inputMode="url"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            value={linkReferencia}
                            onChange={(event) =>
                              updateItem(index, {
                                link_referencia: event.target.value,
                              })
                            }
                            placeholder="https://paineldeprecos.planejamento.gov.br/..."
                            className={cn(
                              "mt-1 h-9 w-full rounded-xl border px-3 text-xs font-semibold text-[#1C1B1F] outline-none focus:ring-2",
                              hasValidReferenceLink
                                ? "border-black/10 bg-white focus:ring-[#2D5D94]/20"
                                : "border-[#C9A646]/50 bg-[#FFF8E6] focus:ring-[#C9A646]/25",
                            )}
                          />
                        </label>
                        <label className="mt-2 block text-[10px] font-semibold uppercase tracking-widest text-black/35">
                          Justificativa do item
                          <textarea
                            rows={2}
                            maxLength={240}
                            value={justificativaTexto}
                            onChange={(event) =>
                              updateItem(index, {
                                justificativa_item: event.target.value,
                              })
                            }
                            placeholder="Ex: necessidade técnica, compatibilidade, uso obrigatório..."
                            className={cn(
                              "mt-1 w-full rounded-xl border px-3 py-2 text-xs font-medium text-[#1C1B1F] outline-none focus:ring-2 resize-none",
                              hasJustificativa
                                ? "border-black/10 bg-white focus:ring-[#2D5D94]/20"
                                : "border-[#C9A646]/50 bg-[#FFF8E6] focus:ring-[#C9A646]/25",
                            )}
                          />
                        </label>
                        <p
                          className={cn(
                            "mt-1 text-[10px] font-semibold tracking-wide",
                            hasJustificativa ? "text-emerald-700/90" : "text-amber-700",
                          )}
                        >
                          {hasJustificativa
                            ? hasValidReferenceLink
                              ? "Pronto para análise da chefia."
                              : "Informe um link http/https de referência antes de gerar a DFD."
                            : "Sem justificativa técnica, a chefia não consegue avaliar corretamente."}
                        </p>
                        <p className="mt-2 text-[10px] uppercase tracking-widest text-[#2D5D94] font-semibold">
                          Subtotal:{" "}
                          {(Number(entry.quantidade || 0) *
                            Number(entry.valor_unitario_estimado || 0)).toLocaleString(
                            "pt-BR",
                            {
                              style: "currency",
                              currency: "BRL",
                            },
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(entry.uid)}
                        aria-label={`Remover ${entry.item_efisco.descricao} do carrinho`}
                        className="w-9 h-9 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center shrink-0"
                      >
                        <Trash size={16} weight="bold" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="p-6 border-t border-black/5 bg-white space-y-3">
                {cartBlockingSummary.invalidItems > 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                    {cartBlockingSummary.invalidItems} item(ns) com pendências
                    obrigatórias.
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                    Campos obrigatórios preenchidos. Fluxo liberado para Nova DFD.
                  </div>
                )}
                <div className="rounded-2xl border border-[#D2D0CE] bg-[#F8FAFC] p-3">
                  <div className="flex items-center gap-2 text-[#164073]">
                    <UsersThree size={16} weight="bold" />
                    <p className="text-[11px] font-semibold uppercase tracking-widest">
                      Enviar para DFD coletiva
                    </p>
                  </div>
                  <select
                    value={selectedCollectiveRoomId}
                    onChange={(event) => setSelectedCollectiveRoomId(event.target.value)}
                    className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[#1C1B1F] outline-none focus:ring-2 focus:ring-[#2D5D94]/20"
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
                  <button
                    type="button"
                    onClick={sendCartToCollectiveRoom}
                    disabled={
                      sendingToCollectiveRoom ||
                      collectiveRooms.length === 0 ||
                      !cartBlockingSummary.canProceed
                    }
                    className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#1B5E20] text-xs font-semibold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UsersThree size={15} weight="bold" />
                    {sendingToCollectiveRoom ? "Enviando..." : "Enviar para sala"}
                  </button>
                </div>
                <Button
                  onClick={() => {
                    if (!cartBlockingSummary.canProceed) {
                      toast.error(
                        `Preencha os campos obrigatórios antes de continuar. ${cartBlockingSummary.reasons.join(" | ")}`,
                      );
                      return;
                    }
                    setCartSidebarOpen(false);
                    router.push("/nova-dfd");
                  }}
                  className="w-full h-12 rounded-2xl bg-[#164073] hover:bg-[#11185b] text-white font-semibold uppercase tracking-widest text-xs"
                >
                  Continuar para Nova DFD
                  <ArrowRight size={16} className="ml-2" weight="bold" />
                </Button>
                <button
                  type="button"
                  onClick={() => setCartSidebarOpen(false)}
                  className="w-full h-11 rounded-2xl border border-black/10 text-[#2D5D94] font-semibold uppercase tracking-widest text-xs hover:bg-[#F4F7FA]"
                >
                  Continuar navegando no catálogo
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
function ProductCard({
  product,
  index,
  inCart,
  isFavorite,
  favoritePending,
  onAdd,
  onToggleFavorite,
}: {
  product: any;
  index: number;
  inCart: boolean;
  isFavorite: boolean;
  favoritePending: boolean;
  onAdd: (product: any, sourceEl?: HTMLElement | null) => void;
  onToggleFavorite: (product: any) => void;
}) {
  const fullDescription = String(product.name || "Descrição não informada")
    .replace(/\s+/g, " ")
    .trim();
  const descriptionSize = getDescriptionSize(fullDescription);
  const sizeClass =
    descriptionSize === "full"
      ? "md:col-span-2 xl:col-span-3 2xl:col-span-4"
      : descriptionSize === "wide"
        ? "md:col-span-2 xl:col-span-2"
        : "";
  const cardPadding = descriptionSize === "compact" ? "p-4" : "p-5 md:p-6";
  const titleSize =
    descriptionSize === "compact"
      ? "text-[13px]"
      : descriptionSize === "wide"
        ? "text-[14px]"
        : "text-[15px]";
  const expenseBadge = getCatalogExpenseBadge(
    product.gnd || product.gnd_derivado || product.codigo_natureza_despesa,
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.01 }}
      className={cn(
        "break-inside-avoid group bg-white border rounded-[28px] flex flex-col gap-3 hover:shadow-xl transition-all relative min-w-0",
        sizeClass,
        cardPadding,
        inCart
          ? "border-[#2D5D94]/40 shadow-md shadow-[#2D5D94]/10"
          : "border-black/5 hover:border-[#2D5D94]/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#E8EDF2] text-[9px] font-semibold tracking-tighter text-[#2D5D94]">
          <Hash size={10} weight="bold" />
          {product.siadLabel}
        </div>
        <div className="flex items-center gap-1">
          {product.rank > 0.05 && (
            <div className="px-2 py-0.5 rounded-md bg-[#2D5D94]/10 text-[8px] font-semibold uppercase text-[#2D5D94]">
              Relevante
            </div>
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
              "h-7 w-7 rounded-lg border flex items-center justify-center transition-colors",
              isFavorite
                ? "border-[#EC2029]/30 bg-[#FFF1F3] text-[#EC2029]"
                : "border-black/10 bg-white text-black/35 hover:bg-[#FFF1F3] hover:text-[#EC2029]",
            )}
            disabled={favoritePending}
          >
            <Heart size={13} weight={isFavorite ? "fill" : "regular"} />
          </button>
        </div>
      </div>

      <h3
        title={String(product.name || "")}
        className={cn(
          "font-display font-semibold text-[#1C1B1F] leading-snug tracking-tight group-hover:text-[#2D5D94] transition-colors whitespace-normal break-words [overflow-wrap:anywhere]",
          titleSize,
        )}
      >
        {fullDescription}
      </h3>

      <p className="text-[10px] font-semibold uppercase tracking-widest text-black/40 whitespace-normal break-words">
        {product.category || "Sem categoria"}
      </p>

      <p className="text-[10px] uppercase tracking-widest text-black/45 font-semibold whitespace-normal break-words">
        Classe: {product.classe}
      </p>

      <p className="text-[10px] uppercase tracking-widest text-black/45 font-semibold">
        Codigo e-Fisco: {product.efiscoCode}
      </p>

      <div
        className={cn(
          "rounded-xl border px-3 py-2 text-[10px] font-semibold uppercase tracking-widest",
          expenseBadge.className,
        )}
      >
        <span>{expenseBadge.label}</span>
        <p className="mt-1 normal-case tracking-normal text-[11px] font-medium opacity-85">
          {expenseBadge.detail}
        </p>
      </div>

      <div className="w-full h-1.5 rounded-full bg-[#E8EDF2] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            product.rank > 0.1
              ? "bg-emerald-500"
              : product.rank > 0.03
                ? "bg-amber-500"
                : "bg-[#2D5D94]/40",
          )}
          style={{ width: `${Math.min(100, Math.max(12, product.rank * 100))}%` }}
        />
      </div>

      <div className="flex justify-between items-center pt-1">
        <div
          className={cn(
            "text-[8px] font-semibold uppercase tracking-widest px-2 py-1 rounded-md",
            normalizeTipoObjeto(product.tipo_objeto || product.category) === "servico"
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700",
          )}
        >
          {normalizeTipoObjeto(product.tipo_objeto || product.category) === "servico"
            ? "Serviço"
            : "Material"}
        </div>

        <button
          onClick={(event) => onAdd(product, event.currentTarget)}
          aria-label={
            inCart
              ? `Item ${product.name} já está no carrinho`
              : `Adicionar ${product.name} ao carrinho`
          }
          className={cn(
            "h-8 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 px-3",
            inCart
              ? "bg-[#2D5D94] text-white"
              : "bg-white border border-[#D2D0CE] text-[#2D5D94] hover:bg-[#E8EDF2]",
          )}
        >
          {inCart ? (
            <span className="inline-flex items-center gap-1">
              <Check size={14} weight="bold" />
              <span className="text-[9px] font-semibold uppercase tracking-wider">
                no carrinho
              </span>
            </span>
          ) : (
            <Plus size={14} weight="bold" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
