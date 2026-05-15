"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  UsersThree,
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
};

type AggregatedItem = {
  codigo_item_efisco?: string | null;
  codigo_tce?: string | null;
  descricao?: string | null;
  quantidade: number;
  valor_unitario_estimado: number;
  gnd?: string | null;
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

const STATUS_LABELS: Record<RoomStatus, string> = {
  aberta: "Aberta",
  em_revisao: "Em revisão",
  convertida: "Convertida",
  arquivada: "Arquivada",
};

export default function DfdColetivaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const roomId = String(params?.id || "");
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [converting, setConverting] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogHasMore, setCatalogHasMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [contributionDraft, setContributionDraft] = useState({
    quantidade: 1,
    valor_unitario_estimado: 0,
    link_referencia: "",
    justificativa_item: "",
  });

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
        // Continua para a consulta direta abaixo.
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

  const canEdit = Boolean(detail?.room.can_edit_metadata);
  const isOpen = detail?.room.status === "aberta";

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
          status: form.get("status"),
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

  async function addContribution(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem) {
      toast.warning("Escolha um item do catálogo.");
      return;
    }
    try {
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
            quantidade: contributionDraft.quantidade,
            valor_unitario_estimado: contributionDraft.valor_unitario_estimado,
            link_referencia: contributionDraft.link_referencia,
            justificativa_item: contributionDraft.justificativa_item,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao adicionar item.");
      toast.success("Item adicionado à DFD coletiva.");
      setSelectedItem(null);
      setCatalogSearch("");
      setCatalogItems([]);
      setContributionDraft({
        quantidade: 1,
        valor_unitario_estimado: 0,
        link_referencia: "",
        justificativa_item: "",
      });
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao adicionar item.");
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
    const quantidade = window.prompt(
      "Quantidade",
      String(contribution.quantidade || 1),
    );
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
      await loadDetail();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao converter DFD coletiva.");
    } finally {
      setConverting(false);
    }
  }

  const totalValue = useMemo(
    () =>
      (detail?.items || []).reduce(
        (acc, item) =>
          acc +
          Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0),
        0,
      ),
    [detail?.items],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F7F5] p-6">
        <div className="mx-auto h-[70vh] max-w-7xl animate-pulse rounded-lg bg-white" />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-[#F7F7F5] p-6">
        <div className="mx-auto max-w-4xl rounded-lg border border-[#DAD7D2] bg-white p-8 text-center">
          <p className="font-semibold text-[#164073]">DFD coletiva não encontrada.</p>
          <button
            onClick={() => router.push("/dfds-coletivas")}
            className="mt-4 rounded-md bg-[#164073] px-4 py-2 text-sm font-semibold text-white"
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] px-5 py-6 text-[#1F2933]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <Link
          href="/dfds-coletivas"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#164073] no-underline"
        >
          <ArrowLeft size={16} weight="bold" /> Voltar para DFDs coletivas
        </Link>

        <section className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#E8EDF2] px-2.5 py-1 text-[11px] font-semibold text-[#164073]">
                  {STATUS_LABELS[detail.room.status]}
                </span>
                <span className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]">
                  {detail.room.unit_name}
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-[#164073]">
                {detail.room.title}
              </h1>
              <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm text-[#5B6472]">
                {detail.room.description || "Sala sem descrição."}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Pessoas" value={detail.participants.length} />
              <Metric label="Itens" value={detail.items.length} />
              <Metric
                label="Valor"
                value={totalValue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                })}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="flex flex-col gap-5">
            <section className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <UsersThree size={20} className="text-[#164073]" weight="bold" />
                <h2 className="text-base font-semibold text-[#164073]">Participantes</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {detail.participants.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Nenhuma contribuição registrada.</p>
                ) : (
                  detail.participants.map((participant) => (
                    <div
                      key={participant.user_id}
                      className="flex items-center gap-3 rounded-md bg-[#F8FAFC] p-3"
                    >
                      <Avatar
                        name={participant.user_name || participant.user_email || "Usuário"}
                        src={participant.user_avatar_url}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#164073]">
                          {participant.user_name || participant.user_email || "Usuário"}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {participant.quantidade} item(ns) ·{" "}
                          {participant.total.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {canEdit && (
              <form
                onSubmit={saveMetadata}
                className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <PencilSimple size={18} className="text-[#164073]" weight="bold" />
                  <h2 className="text-base font-semibold text-[#164073]">
                    Ajustes da chefia
                  </h2>
                </div>
                <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                  Título
                  <input
                    name="title"
                    defaultValue={detail.room.title}
                    className="mt-1 w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#164073]"
                  />
                </label>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                  Descrição
                  <textarea
                    name="description"
                    defaultValue={detail.room.description || ""}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#164073]"
                  />
                </label>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                  Escopo
                  <textarea
                    name="scope"
                    defaultValue={detail.room.scope || ""}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#164073]"
                  />
                </label>
                <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                  Status
                  <select
                    name="status"
                    defaultValue={detail.room.status}
                    className="mt-1 w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal outline-none focus:border-[#164073]"
                  >
                    <option value="aberta">Aberta</option>
                    <option value="em_revisao">Em revisão</option>
                    <option value="arquivada">Arquivada</option>
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={savingMeta}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#164073] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingMeta ? "Salvando..." : "Salvar ajustes"}
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {isOpen && (
              <section className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <MagnifyingGlass size={18} className="text-[#164073]" weight="bold" />
                  <h2 className="text-base font-semibold text-[#164073]">
                    Adicionar item pelo catálogo
                  </h2>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
                  <div>
                    <input
                      value={catalogSearch}
                      onChange={(event) => setCatalogSearch(event.target.value)}
                      className="w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm outline-none focus:border-[#164073]"
                      placeholder="Buscar item por nome ou código"
                    />
                    <div className="mt-3 grid gap-2">
                      {catalogLoading && (
                        <p className="text-sm text-[#6B7280]">Buscando catálogo...</p>
                      )}
                      {catalogItems.map((item) => {
                        const expenseBadge = getCatalogExpenseBadge(
                          item.gnd_preferencial ||
                            deriveGndFromNatureza(item.codigo_natureza_preferencial),
                        );

                        return (
                          <button
                            key={`${item.id}-${item.codigo_efisco || item.codigo_tce}`}
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            className={cn(
                              "rounded-md border p-3 text-left transition",
                              selectedItem?.id === item.id
                                ? "border-[#164073] bg-[#E8EDF2]"
                                : "border-[#E5E7EB] bg-white hover:bg-[#F8FAFC]",
                            )}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="text-sm font-semibold text-[#164073]">
                                {item.descricao}
                              </p>
                              <span
                                className={cn(
                                  "inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
                                  expenseBadge.className,
                                )}
                              >
                                {expenseBadge.label}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[#6B7280]">
                              {item.codigo_efisco || item.codigo_tce || item.id} ·{" "}
                              {item.nome_classe || item.classe || item.nome_grupo || item.grupo || "Sem classe"}
                            </p>
                            <p className="mt-1 text-xs font-medium text-[#4B5563]">
                              {expenseBadge.detail}
                            </p>
                          </button>
                        );
                      })}
                      {!catalogLoading && catalogQuery && catalogItems.length === 0 && (
                        <div className="rounded-md border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-sm text-[#6B7280]">
                          Nenhum item encontrado. Tente termos mais gerais, parte do código e-Fisco ou uma palavra da classe.
                        </div>
                      )}
                      {(catalogPageState.hasPrevious || catalogHasMore || catalogItems.length > 0) && (
                        <div className="flex flex-col gap-2 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-semibold text-[#6B7280]">
                            Página {catalogPageState.displayPage} · {catalogItems.length} resultado(s)
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setCatalogPage((current) => Math.max(0, current - 1))}
                              disabled={!catalogPageState.hasPrevious || catalogLoading}
                              className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#164073] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Anterior
                            </button>
                            <button
                              type="button"
                              onClick={() => setCatalogPage((current) => current + 1)}
                              disabled={!catalogHasMore || catalogLoading}
                              className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-semibold text-[#164073] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <form onSubmit={addContribution} className="rounded-md bg-[#F8FAFC] p-4">
                    <p className="text-sm font-semibold text-[#164073]">
                      {selectedItem?.descricao || "Selecione um item"}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                        Qtd.
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
                          className="mt-1 w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal"
                        />
                      </label>
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                        Valor unitário
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={contributionDraft.valor_unitario_estimado}
                          onChange={(event) =>
                            setContributionDraft((current) => ({
                              ...current,
                              valor_unitario_estimado: Number(event.target.value || 0),
                            }))
                          }
                          className="mt-1 w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal"
                        />
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                      Link de referência
                      <input
                        value={contributionDraft.link_referencia}
                        onChange={(event) =>
                          setContributionDraft((current) => ({
                            ...current,
                            link_referencia: event.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal"
                        placeholder="https://..."
                      />
                    </label>
                    <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
                      Justificativa
                      <textarea
                        value={contributionDraft.justificativa_item}
                        onChange={(event) =>
                          setContributionDraft((current) => ({
                            ...current,
                            justificativa_item: event.target.value,
                          }))
                        }
                        rows={3}
                        className="mt-1 w-full resize-none rounded-md border border-[#CBD5E1] px-3 py-2 text-sm normal-case tracking-normal"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#164073] px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <Plus size={16} weight="bold" /> Adicionar à sala
                    </button>
                  </form>
                </div>
              </section>
            )}

            <section className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#164073]">
                    Itens consolidados
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Itens iguais são agrupados automaticamente com distribuição por usuário.
                  </p>
                </div>
                {detail.room.can_convert && (
                  <button
                    type="button"
                    onClick={convertRoom}
                    disabled={converting || detail.items.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1B5E20] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    <CheckCircle size={16} weight="bold" />
                    {converting ? "Gerando..." : "Gerar DFD oficial"}
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                {detail.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#CBD5E1] p-8 text-center text-sm text-[#6B7280]">
                    Nenhum item adicionado à sala.
                  </div>
                ) : (
                  detail.items.map((item) => (
                    <div
                      key={`${item.codigo_item_efisco || item.codigo_tce}-${item.gnd}`}
                      className="rounded-lg border border-[#E5E7EB] p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#164073]">
                            {item.descricao}
                          </p>
                          <p className="mt-1 text-xs text-[#6B7280]">
                            {item.codigo_item_efisco || item.codigo_tce || "Sem código"} · GND{" "}
                            {item.gnd || "não informado"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-right">
                          <MiniMetric label="Quantidade" value={item.quantidade} />
                          <MiniMetric
                            label="Subtotal"
                            value={(
                              Number(item.quantidade || 0) *
                              Number(item.valor_unitario_estimado || 0)
                            ).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(item.contributors || []).map((contributor) => (
                          <span
                            key={contributor.user_id}
                            className="rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#4B5563]"
                          >
                            {contributor.user_name || contributor.user_email || "Usuário"}:{" "}
                            {contributor.quantidade}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[#164073]">Contribuições</h2>
              <div className="mt-4 grid gap-2">
                {detail.contributions.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Ainda não há contribuições.</p>
                ) : (
                  detail.contributions.map((contribution) => (
                    <div
                      key={contribution.id}
                      className="flex flex-col gap-3 rounded-md bg-[#F8FAFC] p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          name={contribution.user_name || contribution.user_email || "Usuário"}
                          src={contribution.user_avatar_url || null}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#164073]">
                            {contribution.descricao}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {contribution.user_name || contribution.user_email || "Usuário"} ·{" "}
                            {contribution.quantidade} un.
                          </p>
                        </div>
                      </div>
                      {contribution.can_edit && isOpen && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => editContribution(contribution)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#164073]"
                          >
                            <PencilSimple size={14} weight="bold" /> Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeContribution(contribution)}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#FCA5A5] px-3 py-2 text-xs font-semibold text-[#B91C1C]"
                          >
                            <Trash size={14} weight="bold" /> Remover
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {detail.linkedDfds.length > 0 && (
              <section className="rounded-lg border border-[#DAD7D2] bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-[#164073]">
                  DFDs oficiais geradas
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.linkedDfds.map((link) => (
                    <Link
                      key={link.dfd_id}
                      href={`/dfd/${link.dfd_id}`}
                      className="rounded-md bg-[#E8EDF2] px-3 py-2 text-sm font-semibold text-[#164073] no-underline"
                    >
                      {link.expense_class || "DFD"} · abrir
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
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
      detail: "Natureza da despesa não identificada",
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-[96px] rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </p>
      <p className="truncate text-lg font-semibold text-[#164073]">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-[#F3F4F6] px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </p>
      <p className="truncate text-xs font-semibold text-[#164073]">{value}</p>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const initials = String(name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  if (!src || broken) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#164073] text-xs font-semibold text-white">
        {initials || "U"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
    />
  );
}
