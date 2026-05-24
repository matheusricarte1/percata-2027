"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Buildings,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  Package,
  Plus,
  UsersThree,
} from "@phosphor-icons/react";
import { getSafeUser, supabase } from "@/lib/supabase";
import { fetchActiveCycleYear } from "@/lib/cycle";
import { cn } from "@/lib/utils";

type UnitOption = {
  unit_id: string;
  unit_type: "departamento" | "laboratorio";
  nome: string;
  role_in_unit: string | null;
};

type RoomListItem = {
  id: string;
  title: string;
  description: string | null;
  scope: string | null;
  status:
    | "proposta"
    | "aberta"
    | "em_consolidacao_chefia"
    | "pronta_para_conversao"
    | "convertida"
    | "arquivada";
  unit_id: string;
  unit_type: "departamento" | "laboratorio";
  unit_name: string;
  actor_role?: "membro" | "chefia" | "admin" | "superadmin";
  updated_at: string;
  summary?: {
    participantCount: number;
    itemCount: number;
    totalQuantity: number;
    totalValue: number;
    userHasContributed: boolean;
  };
};

const STATUS_LABELS: Record<RoomListItem["status"], string> = {
  proposta: "Proposta",
  aberta: "Aberta",
  em_consolidacao_chefia: "Consolidação da chefia",
  pronta_para_conversao: "Pronta para conversão",
  convertida: "Convertida",
  arquivada: "Arquivada",
};

const PAGE_SIZE = 6;

export default function DfdsColetivasPage() {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("operacionais");
  const [search, setSearch] = useState("");
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear());
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    scope: "",
    unitKey: "",
  });

  async function loadUnits() {
    const user = await getSafeUser();
    if (!user) return;
    const { data: links, error } = await supabase
      .from("user_units")
      .select("unit_id,unit_type,role_in_unit")
      .eq("user_id", user.id);
    if (error) throw error;
    const rows = (links || []) as Array<{
      unit_id: string;
      unit_type: "departamento" | "laboratorio";
      role_in_unit: string | null;
    }>;
    const deptIds = rows
      .filter((row) => row.unit_type === "departamento")
      .map((row) => row.unit_id);
    const labIds = rows
      .filter((row) => row.unit_type === "laboratorio")
      .map((row) => row.unit_id);
    const [deptResult, labResult] = await Promise.all([
      deptIds.length
        ? supabase.from("departamentos").select("id,nome").in("id", deptIds)
        : Promise.resolve({ data: [], error: null }),
      labIds.length
        ? supabase.from("laboratorios").select("id,nome").in("id", labIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (deptResult.error) throw deptResult.error;
    if (labResult.error) throw labResult.error;

    const names = new Map<string, string>();
    (deptResult.data || []).forEach((row: any) =>
      names.set(`departamento:${row.id}`, String(row.nome || "")),
    );
    (labResult.data || []).forEach((row: any) =>
      names.set(`laboratorio:${row.id}`, String(row.nome || "")),
    );
    const nextUnits = rows.map((row) => ({
      ...row,
      nome:
        names.get(`${row.unit_type}:${row.unit_id}`) ||
        "Unidade vinculada",
    }));
    setUnits(nextUnits);
    setDraft((current) => ({
      ...current,
      unitKey: current.unitKey || unitKey(nextUnits[0]),
    }));
  }

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/collective-rooms?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar DFDs coletivas.");
      const nextRooms = (payload.rooms || []) as RoomListItem[];
      setRooms(nextRooms);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar DFDs coletivas.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadUnits().catch((error) => {
      toast.error(error?.message || "Erro ao carregar seus setores.");
    });
    fetchActiveCycleYear().then(setCycleYear).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadRooms();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadRooms]);

  const selectedUnit = useMemo(
    () => units.find((unit) => unitKey(unit) === draft.unitKey) || null,
    [draft.unitKey, units],
  );
  const selectedUnitIsChefia = selectedUnit?.role_in_unit === "chefia";
  const visibleRooms = useMemo(() => {
    if (statusFilter === "propostas") {
      return rooms.filter((room) => room.status === "proposta");
    }
    if (statusFilter === "abertas") {
      return rooms.filter((room) => room.status === "aberta");
    }
    if (statusFilter === "consolidacao") {
      return rooms.filter(
        (room) =>
          room.status === "em_consolidacao_chefia" ||
          room.status === "pronta_para_conversao",
      );
    }
    if (statusFilter === "finalizadas") {
      return rooms.filter(
        (room) => room.status === "convertida" || room.status === "arquivada",
      );
    }
    return rooms.filter(
      (room) =>
        room.status === "aberta" ||
        room.status === "em_consolidacao_chefia" ||
        room.status === "pronta_para_conversao",
    );
  }, [rooms, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(visibleRooms.length / PAGE_SIZE));
  const paginatedRooms = useMemo(
    () => visibleRooms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, visibleRooms],
  );
  const filterTabs = useMemo(
    () => [
      {
        value: "operacionais",
        label: "Operacionais",
        count: rooms.filter(
          (room) =>
            room.status === "aberta" ||
            room.status === "em_consolidacao_chefia" ||
            room.status === "pronta_para_conversao",
        ).length,
      },
      {
        value: "propostas",
        label: "Propostas",
        count: rooms.filter((room) => room.status === "proposta").length,
      },
      {
        value: "abertas",
        label: "Abertas",
        count: rooms.filter((room) => room.status === "aberta").length,
      },
      {
        value: "consolidacao",
        label: "Sob consolidação",
        count: rooms.filter(
          (room) =>
            room.status === "em_consolidacao_chefia" ||
            room.status === "pronta_para_conversao",
        ).length,
      },
      {
        value: "finalizadas",
        label: "Finalizadas",
        count: rooms.filter((room) => room.status === "convertida" || room.status === "arquivada").length,
      },
    ],
    [rooms],
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!selectedUnit) {
      toast.warning("Selecione um setor ou laboratório.");
      return;
    }
    setCreating(true);
    try {
      const response = await fetch("/api/collective-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          scope: draft.scope,
          unit_id: selectedUnit.unit_id,
          unit_type: selectedUnit.unit_type,
          cycle_year: cycleYear,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao criar sala.");
      toast.success(
        selectedUnitIsChefia
          ? "DFD coletiva aberta para o setor."
          : "Proposta enviada para publicação da chefia.",
      );
      setDraft({
        title: "",
        description: "",
        scope: "",
        unitKey: draft.unitKey,
      });
      await loadRooms();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar DFD coletiva.");
    } finally {
      setCreating(false);
    }
  }

  const totals = useMemo(
    () => ({
      rooms: rooms.filter((room) => room.status !== "convertida" && room.status !== "arquivada").length,
      participants: rooms.reduce(
        (acc, room) => acc + Number(room.summary?.participantCount || 0),
        0,
      ),
      items: rooms.reduce((acc, room) => acc + Number(room.summary?.itemCount || 0), 0),
    }),
    [rooms],
  );

  return (
    <main className="min-h-screen bg-[var(--semantic-neutral-soft)] px-5 py-7 text-[#111827]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7">
        <section className="ux-panel relative overflow-hidden rounded-[24px] p-7">
          <div className="ux-accent-rule absolute inset-x-0 top-0 h-1" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="ux-kicker">Coautoria do setor</p>
              <h1 className="ux-title mt-1 text-3xl font-semibold">
                DFDs coletivas para construir demandas em conjunto
              </h1>
              <p className="ux-muted mt-3 max-w-2xl text-base leading-7">
                Pares contribuem. A chefia homologa. A sala vira uma ou mais DFDs oficiais com autoria preservada.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="ux-chip ux-chip-collab text-sm">Membro propõe</span>
                <span className="ux-chip ux-chip-warning text-sm">Chefia publica e consolida</span>
                <span className="ux-chip ux-chip-success text-sm">Autoria preservada</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={<Buildings size={30} weight="duotone" />} label="DFDs" value={totals.rooms} />
              <Metric icon={<UsersThree size={30} weight="duotone" />} label="Participantes" value={totals.participants} />
              <Metric icon={<Package size={30} weight="duotone" />} label="Itens" value={totals.items} />
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={createRoom}
            className="ux-panel rounded-[22px] p-6"
          >
            <div className="flex items-center gap-2">
              <div className="ux-icon-collab flex h-11 w-11 items-center justify-center rounded-full border border-[var(--semantic-collab-border)]">
                <Plus size={22} weight="bold" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F1F3D]">Abra uma DFD coletiva com contexto</h2>
                <p className="text-sm text-[#667085]">
                  {selectedUnitIsChefia
                    ? "Como chefia, você já pode abrir a sala para a unidade contribuir."
                    : "Como membro, você propõe o rascunho e a chefia publica para o restante do setor."}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--semantic-warning-border)] bg-[var(--semantic-warning-soft)] p-4">
              <p className="text-sm font-semibold text-[#8A5A00]">Antes de abrir</p>
              <p className="mt-2 text-sm leading-6 text-[#526070]">
                Informe problema, unidade responsável e critério do que entra ou fica fora da sala.
              </p>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              Título
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                required
                className="mt-2 w-full rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[var(--semantic-collab)]"
                placeholder="Ex.: Equipamentos para salas de aula"
              />
            </label>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              Unidade
              <select
                value={draft.unitKey}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, unitKey: event.target.value }))
                }
                className="mt-2 w-full rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[var(--semantic-collab)]"
              >
                {units.map((unit) => (
                  <option key={unitKey(unit)} value={unitKey(unit)}>
                    {unit.nome} ({unit.unit_type === "laboratorio" ? "Lab" : "Setor"})
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              Descrição
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                maxLength={500}
                className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[var(--semantic-collab)]"
                placeholder="Explique por que esta DFD coletiva foi aberta e qual contexto ela atende."
              />
            </label>

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              Escopo
              <textarea
                value={draft.scope}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, scope: event.target.value }))
                }
                rows={4}
                maxLength={500}
                className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[var(--semantic-collab)]"
                placeholder="Descreva o que entra, o que fica fora e o critério usado para as contribuições."
              />
            </label>

            <button
              type="submit"
              disabled={creating || units.length === 0}
              className="ux-btn-collab mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={16} weight="bold" />
              {creating
                ? "Criando..."
                : selectedUnitIsChefia
                  ? "Abrir DFD coletiva"
                  : "Propor DFD coletiva"}
            </button>
          </form>

          <section className="ux-panel rounded-[22px] p-6">
            <div className="flex flex-col gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-[#0F1F3D]">Salas por etapa</p>
                <p className="mt-1 text-sm text-[#667085]">
                  Operacionais primeiro; finalizadas ficam em aba própria.
                </p>
                <div className="relative mt-4">
                  <MagnifyingGlass
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667085]"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-[#CBD5E1] py-3 pl-12 pr-4 text-sm outline-none focus:border-[var(--semantic-collab)]"
                    placeholder="Buscar por tema, descrição ou escopo"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar DFDs coletivas por etapa">
                {filterTabs.map((tab) => {
                  const active = statusFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusFilter(tab.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                        active
                          ? "border-[var(--semantic-action)] bg-[var(--semantic-action)] text-white shadow-sm"
                          : "border-[var(--semantic-neutral-border)] bg-white text-[#42526B] hover:border-[var(--semantic-collab)] hover:text-[var(--semantic-action)]",
                      )}
                    >
                      {tab.label}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          active ? "bg-white/20 text-white" : "bg-[#EEF2F7] text-[#526070]",
                        )}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 animate-pulse rounded-lg border border-[#E5E7EB] bg-[#F3F4F6]"
                  />
                ))
              ) : visibleRooms.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#FBFCFF] p-10 text-center">
                  <img
                    src="/guidance/collective-empty-room.png"
                    alt=""
                    className="aspect-[16/9] w-full max-w-[360px] object-contain"
                  />
                  <p className="mt-6 text-lg font-semibold text-[#0F1F3D]">
                    Nenhuma DFD coletiva encontrada
                  </p>
                  <p className="mt-2 max-w-md text-sm text-[#667085]">
                    Crie uma nova DFD coletiva ou ajuste a busca para reencontrar uma sala já iniciada pelo setor.
                  </p>
                  <button
                    type="button"
                    onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Ex.: Equipamentos para salas de aula"]')?.focus()}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-[#0B4AA2] px-5 py-3 text-sm font-semibold text-[#0B4AA2]"
                  >
                    <Plus size={16} weight="bold" />
                    {selectedUnitIsChefia ? "Abrir nova DFD coletiva" : "Propor nova DFD coletiva"}
                  </button>
                </div>
              ) : (
                paginatedRooms.map((room) => <RoomCard key={room.id} room={room} />)
              )}
            </div>
            {!loading && visibleRooms.length > 0 ? (
              <RoomsPagination
                page={page}
                totalPages={totalPages}
                count={visibleRooms.length}
                onPageChange={setPage}
              />
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

function unitKey(unit?: UnitOption | null) {
  if (!unit) return "";
  return `${unit.unit_type}:${unit.unit_id}`;
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-[160px] items-center gap-4 rounded-2xl border border-[var(--semantic-neutral-border)] bg-white px-5 py-4 shadow-sm">
      <div className="text-[var(--semantic-collab)]">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase text-[#667085]">{label}</p>
        <p className="text-2xl font-semibold text-[#0F1F3D]">{value}</p>
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: RoomListItem }) {
  const summary = room.summary;
  const stageHint =
    room.status === "proposta"
      ? "Rascunho visível apenas ao proponente e à chefia."
      : room.status === "aberta"
      ? "Recebendo contribuições do setor."
      : room.status === "em_consolidacao_chefia"
        ? "A chefia assumiu a consolidação e pode reescrever contribuições."
        : room.status === "pronta_para_conversao"
          ? "Prévia pronta para gerar uma ou mais DFDs oficiais."
        : room.status === "convertida"
          ? "Já gerou DFD oficial."
          : "Sala encerrada para novas contribuições.";
  return (
    <Link
      href={`/dfds-coletivas/${room.id}`}
      className="group rounded-[18px] border border-[#E5E7EB] bg-white p-5 no-underline shadow-sm transition hover:border-[var(--semantic-collab)] hover:bg-[#FBFCFF]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                room.status === "proposta" && "ux-chip-insight",
                room.status === "aberta" && "ux-chip-collab",
                room.status === "em_consolidacao_chefia" && "ux-chip-warning",
                room.status === "pronta_para_conversao" && "ux-chip-warning",
                room.status === "convertida" && "ux-chip-success",
                room.status === "arquivada" && "bg-[#F3F4F6] text-[#4B5563]",
              )}
            >
              {STATUS_LABELS[room.status]}
            </span>
            {summary?.userHasContributed && (
              <span className="ux-chip ux-chip-success px-2.5 py-1 text-[11px]">
                Você contribuiu
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-[var(--semantic-text)]">
            {room.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-[#5B6472]">
            {room.description || room.scope || "DFD coletiva sem descrição."}
          </p>
          <p className="mt-2 text-xs font-semibold text-[var(--semantic-collab)]">{stageHint}</p>
          <p className="mt-2 text-xs font-medium text-[#6B7280]">
            {room.unit_name} · Atualizada em{" "}
            {new Date(room.updated_at).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="grid min-w-[280px] grid-cols-4 gap-2">
          <MiniMetric label="Pessoas" value={summary?.participantCount || 0} />
          <MiniMetric label="Itens" value={summary?.itemCount || 0} />
          <MiniMetric label="Qtd." value={summary?.totalQuantity || 0} />
          <MiniMetric
            label="Valor"
            value={(summary?.totalValue || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            })}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end text-xs font-semibold uppercase tracking-wider text-[var(--semantic-collab)]">
        Entrar na sala <ArrowRight size={14} className="ml-1" weight="bold" />
      </div>
    </Link>
  );
}

function RoomsPagination({
  page,
  totalPages,
  count,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  count: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--semantic-neutral-border)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-[#667085]">
        {count} salas · página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="ux-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretLeft size={14} weight="bold" />
          Anterior
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="ux-btn-secondary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
        >
          Próxima
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-[var(--semantic-neutral-soft)] px-2 py-2 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </p>
      <p className="truncate text-xs font-semibold text-[var(--semantic-text)]">{value}</p>
    </div>
  );
}
