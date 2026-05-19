"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Buildings,
  FunnelSimple,
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
  status: "aberta" | "em_revisao" | "convertida" | "arquivada";
  unit_id: string;
  unit_type: "departamento" | "laboratorio";
  unit_name: string;
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
  aberta: "Aberta",
  em_revisao: "Em revisão",
  convertida: "Convertida",
  arquivada: "Arquivada",
};

const COLLECTIVE_GUIDE = [
  {
    icon: <Plus size={18} weight="bold" />,
    title: "Abra com contexto",
    description: "Defina o tema, o recorte e o que faz sentido entrar nesta DFD coletiva.",
  },
  {
    icon: <UsersThree size={18} weight="bold" />,
    title: "Receba contribuições",
    description: "Cada participante adiciona itens com justificativa, quantidade e referência.",
  },
  {
    icon: <ArrowRight size={18} weight="bold" />,
    title: "Revise antes de converter",
    description: "A sala consolida a demanda do setor antes de virar DFD oficial.",
  },
] as const;

export default function DfdsColetivasPage() {
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ativas");
  const [search, setSearch] = useState("");
  const [cycleYear, setCycleYear] = useState(new Date().getFullYear());
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
      if (statusFilter !== "ativas") params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/collective-rooms?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Erro ao carregar DFDs coletivas.");
      const nextRooms = (payload.rooms || []) as RoomListItem[];
      setRooms(
        statusFilter === "ativas"
          ? nextRooms.filter((room) => room.status !== "arquivada")
          : nextRooms,
      );
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar DFDs coletivas.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

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
      toast.success("DFD coletiva criada.");
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
      rooms: rooms.length,
      participants: rooms.reduce(
        (acc, room) => acc + Number(room.summary?.participantCount || 0),
        0,
      ),
      items: rooms.reduce((acc, room) => acc + Number(room.summary?.itemCount || 0), 0),
    }),
    [rooms],
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-7 text-[#111827]">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7">
        <section className="rounded-lg border border-[#E2E8F0] bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-[#0F1F3D]">
                DFDs coletivas para construir demandas em conjunto
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[#526070]">
                Reuna contribuições do setor num fluxo mais claro: a equipe adiciona itens, a sala consolida a demanda
                e a chefia transforma tudo em DFD oficial com menos ruído no caminho.
              </p>
              <div className="mt-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#D8E0EA] bg-[#FBFCFF] px-4 py-2 text-sm text-[#526070]">
                <UsersThree size={16} className="text-[#0B4AA2]" weight="duotone" />
                Uma sala coletiva organiza a conversa antes da formalização.
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={<Buildings size={30} weight="duotone" />} label="DFDs" value={totals.rooms} />
              <Metric icon={<UsersThree size={30} weight="duotone" />} label="Participantes" value={totals.participants} />
              <Metric icon={<Package size={30} weight="duotone" />} label="Itens" value={totals.items} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {COLLECTIVE_GUIDE.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-[#DDE5EF] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF4FF] text-[#0B4AA2]">
                {item.icon}
              </div>
              <h2 className="mt-4 text-base font-semibold text-[#0F1F3D]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#526070]">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={createRoom}
            className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#0B4AA2] text-[#0B4AA2]">
                <Plus size={22} weight="bold" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F1F3D]">Abra uma DFD coletiva com contexto</h2>
                <p className="text-sm text-[#667085]">
                  Defina o tema, o setor e o recorte da sala antes de convidar contribuições.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#DDE5EF] bg-[#FBFCFF] p-4">
              <p className="text-sm font-semibold text-[#0B3473]">O que precisa ficar claro desde o início</p>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#526070]">
                <li>• qual problema ou necessidade a sala pretende reunir;</li>
                <li>• qual unidade responde pela consolidação;</li>
                <li>• que tipo de item deve ou não deve entrar.</li>
              </ul>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-[#4B5563]">
              Título
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                required
                className="mt-2 w-full rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#0B4AA2]"
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
                className="mt-2 w-full rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#0B4AA2]"
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
                className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#0B4AA2]"
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
                className="mt-2 w-full resize-none rounded-md border border-[#CBD5E1] px-4 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#0B4AA2]"
                placeholder="Descreva o que entra, o que fica fora e o critério usado para as contribuições."
              />
            </label>

            <button
              type="submit"
              disabled={creating || units.length === 0}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#063F8F] px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={16} weight="bold" />
              {creating ? "Criando..." : "Criar DFD coletiva"}
            </button>
          </form>

          <section className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-[0_16px_42px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-[#0F1F3D]">Salas abertas e histórico recente</p>
                <p className="mt-1 text-sm text-[#667085]">
                  Acompanhe o que já está em andamento, retome revisões e veja onde sua equipe já contribuiu.
                </p>
                <div className="relative mt-4">
                  <MagnifyingGlass
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#667085]"
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-[#CBD5E1] py-3 pl-12 pr-4 text-sm outline-none focus:border-[#0B4AA2]"
                    placeholder="Buscar por tema, descrição ou escopo"
                  />
                </div>
              </div>
              <div className="relative">
                <FunnelSimple
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0B4AA2]"
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="min-w-[190px] appearance-none rounded-md border border-[#CBD5E1] bg-white py-3 pl-10 pr-8 text-sm font-medium outline-none focus:border-[#0B4AA2]"
                >
                  <option value="ativas">Ativas e histórico</option>
                  <option value="aberta">Abertas</option>
                  <option value="em_revisao">Em revisão</option>
                  <option value="convertida">Convertidas</option>
                  <option value="arquivada">Arquivadas</option>
                  <option value="todas">Todas</option>
                </select>
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
              ) : rooms.length === 0 ? (
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
                    Abrir nova DFD coletiva
                  </button>
                </div>
              ) : (
                rooms.map((room) => <RoomCard key={room.id} room={room} />)
              )}
            </div>
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
    <div className="flex min-w-[160px] items-center gap-4 rounded-lg border border-[#D8E0EA] bg-[#FBFCFF] px-5 py-4">
      <div className="text-[#0B4AA2]">{icon}</div>
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
    room.status === "aberta"
      ? "Recebendo contribuições do setor."
      : room.status === "em_revisao"
        ? "Em conferência antes da conversão."
        : room.status === "convertida"
          ? "Já gerou DFD oficial."
          : "Sala encerrada para novas contribuições.";
  return (
    <Link
      href={`/dfds-coletivas/${room.id}`}
      className="group rounded-lg border border-[#E5E7EB] bg-white p-5 no-underline transition hover:border-[#0B4AA2] hover:bg-[#FBFCFF]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                room.status === "aberta" && "bg-[#E8F5E9] text-[#1B5E20]",
                room.status === "em_revisao" && "bg-[#FFF7ED] text-[#9A3412]",
                room.status === "convertida" && "bg-[#E8EDF2] text-[#164073]",
                room.status === "arquivada" && "bg-[#F3F4F6] text-[#4B5563]",
              )}
            >
              {STATUS_LABELS[room.status]}
            </span>
            {summary?.userHasContributed && (
              <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#047857]">
                Você contribuiu
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-[#0B3473]">
            {room.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-[#5B6472]">
            {room.description || room.scope || "DFD coletiva sem descrição."}
          </p>
          <p className="mt-2 text-xs font-semibold text-[#0B4AA2]">{stageHint}</p>
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
      <div className="mt-3 flex items-center justify-end text-xs font-semibold uppercase tracking-wider text-[#0B4AA2]">
        Entrar na sala <ArrowRight size={14} className="ml-1" weight="bold" />
      </div>
    </Link>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-[#F3F6FA] px-2 py-2 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280]">
        {label}
      </p>
      <p className="truncate text-xs font-semibold text-[#0B3473]">{value}</p>
    </div>
  );
}
