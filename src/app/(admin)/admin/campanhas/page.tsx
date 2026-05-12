"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  Lock,
  LockOpen,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { getSafeUser, supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { normalizeRole, type UserRole } from "@/lib/access";
import {
  parseLocalDateTimeToIso,
  sanitizeLongText,
  sanitizePlainText,
  validateDateRange,
} from "@/lib/settings-sanitize";

type CicloStatus = "planejado" | "aberto" | "pausado" | "encerrado";
type FaseCiclo =
  | "planejamento"
  | "triagem_chefia"
  | "consolidacao_proplan"
  | "exportacao_estadual"
  | "fechado";

interface GovernancaCiclo {
  id: string;
  nome: string;
  status: CicloStatus;
  fase_atual: FaseCiclo;
  janela_inicio: string | null;
  janela_fim: string | null;
  janela_chefia_inicio: string | null;
  janela_chefia_fim: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS: Array<{ value: CicloStatus; label: string }> = [
  { value: "planejado", label: "Planejado" },
  { value: "aberto", label: "Aberto" },
  { value: "pausado", label: "Pausado" },
  { value: "encerrado", label: "Encerrado" },
];

const FASE_OPTIONS: Array<{ value: FaseCiclo; label: string }> = [
  { value: "planejamento", label: "Planejamento" },
  { value: "triagem_chefia", label: "Triagem da Chefia" },
  { value: "consolidacao_proplan", label: "Consolidação PROPLAN" },
  { value: "exportacao_estadual", label: "Exportação Estadual" },
  { value: "fechado", label: "Fechado" },
];

function formatDate(value: string | null): string {
  if (!value) return "Não definida pelo superadmin";
  return new Date(value).toLocaleString("pt-BR");
}

function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function deriveAutoStatus(cycle: {
  fase_atual?: FaseCiclo | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
}): CicloStatus {
  if (cycle.fase_atual === "fechado") return "encerrado";
  if (!cycle.janela_inicio || !cycle.janela_fim) return "planejado";

  const now = Date.now();
  const start = new Date(cycle.janela_inicio).getTime();
  const end = new Date(cycle.janela_fim).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "planejado";

  if (now < start) return "planejado";
  if (now > end) return "encerrado";
  return "aberto";
}

export default function AdminCampanhas() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cycles, setCycles] = useState<GovernancaCiclo[]>([]);
  const [currentUserRole, setCurrentUserRole] =
    useState<UserRole>("solicitante");
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  const [newCycle, setNewCycle] = useState({
    nome: "",
    fase_atual: "planejamento" as FaseCiclo,
    janela_inicio: "",
    janela_fim: "",
    janela_chefia_inicio: "",
    janela_chefia_fim: "",
    observacoes: "",
  });
  const [activeWindowStart, setActiveWindowStart] = useState("");
  const [activeWindowEnd, setActiveWindowEnd] = useState("");
  const [activeChefiaWindowStart, setActiveChefiaWindowStart] = useState("");
  const [activeChefiaWindowEnd, setActiveChefiaWindowEnd] = useState("");

  const isSuperadmin = currentUserRole === "superadmin";

  const resolveCurrentUserRole = useCallback(async () => {
    const user = await getSafeUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    setCurrentUserRole(normalizeRole(profile?.role, user.email));
  }, []);

  const enqueueCycleMilestoneAlerts = useCallback(async (active: GovernancaCiclo | null) => {
    if (!active?.janela_fim) return;

    const endAt = new Date(active.janela_fim);
    if (!Number.isFinite(endAt.getTime())) return;

    const msToEnd = endAt.getTime() - Date.now();
    const daysToEnd = Math.ceil(msToEnd / (1000 * 60 * 60 * 24));
    const milestones = [15, 7, 1].filter((day) => daysToEnd <= day && daysToEnd >= 0);
    if (milestones.length === 0) return;

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id,email,full_name")
      .not("email", "is", null);

    if (usersError || !users || users.length === 0) return;

    const titles = milestones.map(
      (day) => `[PERCATA] Encerramento do ciclo ${active.nome} em ${day} dia(s)`,
    );
    const userIds = users.map((user) => user.id).filter(Boolean);

    const { data: existing } = await supabase
      .from("notifications")
      .select("id,user_id,title")
      .in("title", titles)
      .in("user_id", userIds);

    const existingSet = new Set(
      (existing || []).map((entry: any) => `${entry.user_id}::${entry.title}`),
    );

    const rows: Array<{ user_id: string; title: string; message: string; type: "warning" }> = [];
    for (const user of users) {
      for (const day of milestones) {
        const title = `[PERCATA] Encerramento do ciclo ${active.nome} em ${day} dia(s)`;
        const key = `${user.id}::${title}`;
        if (existingSet.has(key)) continue;
        rows.push({
          user_id: user.id,
          title,
          message: `O ciclo ${active.nome} encerra em ${day} dia(s). Finalize suas ações no PERCATA até o horário definido na janela do ciclo.`,
          type: "warning",
        });
      }
    }

    if (rows.length > 0) {
      await supabase.from("notifications").insert(rows);
    }
  }, []);

  const fetchCycles = useCallback(async () => {
    setLoading(true);
    setDbMessage(null);
    const { data, error } = await supabase
      .from("governanca_ciclos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setDbMessage(
        "Tabela de governança não encontrada. Execute a migration 0005_governanca_superadmin.sql.",
      );
      setCycles([]);
      setLoading(false);
      return;
    }

    const normalized = ((data || []) as GovernancaCiclo[]).map((cycle) => ({
      ...cycle,
      status: deriveAutoStatus(cycle),
    }));

    if (isSuperadmin && normalized.length > 0) {
      const updates = normalized.filter((cycle) => cycle.status !== (data || []).find((raw: any) => raw.id === cycle.id)?.status);
      if (updates.length > 0) {
        await Promise.all(
          updates.map((cycle) =>
            supabase
              .from("governanca_ciclos")
              .update({ status: cycle.status })
              .eq("id", cycle.id),
          ),
        );
      }
      await enqueueCycleMilestoneAlerts(normalized.find((cycle) => cycle.ativo) || null);
    }

    setCycles(normalized);
    setLoading(false);
  }, [enqueueCycleMilestoneAlerts, isSuperadmin]);

  useEffect(() => {
    async function bootstrap() {
      await resolveCurrentUserRole();
      await fetchCycles();
    }
    bootstrap();
  }, [fetchCycles, resolveCurrentUserRole]);

  const activeCycle = useMemo(
    () => cycles.find((cycle) => cycle.ativo) || cycles[0] || null,
    [cycles],
  );

  useEffect(() => {
    setActiveWindowStart(toLocalInputValue(activeCycle?.janela_inicio || null));
    setActiveWindowEnd(toLocalInputValue(activeCycle?.janela_fim || null));
    setActiveChefiaWindowStart(
      toLocalInputValue(activeCycle?.janela_chefia_inicio || null),
    );
    setActiveChefiaWindowEnd(
      toLocalInputValue(activeCycle?.janela_chefia_fim || null),
    );
  }, [
    activeCycle?.id,
    activeCycle?.janela_inicio,
    activeCycle?.janela_fim,
    activeCycle?.janela_chefia_inicio,
    activeCycle?.janela_chefia_fim,
  ]);

  async function createCycle() {
    if (!isSuperadmin) {
      toast.warning("Somente superadmin pode criar ciclos de governança.");
      return;
    }
    const cycleName = sanitizePlainText(newCycle.nome, 140);
    if (!cycleName) {
      toast.error("Informe o nome do ciclo.");
      return;
    }

    setSaving(true);
    const draftForStatus = {
      fase_atual: newCycle.fase_atual,
      janela_inicio: parseLocalDateTimeToIso(newCycle.janela_inicio),
      janela_fim: parseLocalDateTimeToIso(newCycle.janela_fim),
    };
    const generalRange = validateDateRange(draftForStatus.janela_inicio, draftForStatus.janela_fim);
    const chefiaStart = parseLocalDateTimeToIso(newCycle.janela_chefia_inicio);
    const chefiaEnd = parseLocalDateTimeToIso(newCycle.janela_chefia_fim);
    const chefiaRange = validateDateRange(chefiaStart, chefiaEnd);
    if (!generalRange.ok || !chefiaRange.ok) {
      setSaving(false);
      toast.error(generalRange.ok ? chefiaRange.error : generalRange.error);
      return;
    }

    const payloadBase = {
      nome: cycleName,
      status: deriveAutoStatus(draftForStatus),
      fase_atual: newCycle.fase_atual,
      janela_inicio: draftForStatus.janela_inicio,
      janela_fim: draftForStatus.janela_fim,
      observacoes: sanitizeLongText(newCycle.observacoes, 1500) || null,
      ativo: false,
    };

    let error: { message: string } | null = null;
    const firstAttempt = await supabase.from("governanca_ciclos").insert({
      ...payloadBase,
      janela_chefia_inicio: chefiaStart,
      janela_chefia_fim: chefiaEnd,
    });
    error = firstAttempt.error;

    if (error && /janela_chefia/i.test(String(error.message || ""))) {
      const fallbackAttempt = await supabase
        .from("governanca_ciclos")
        .insert(payloadBase);
      error = fallbackAttempt.error;
      if (!error) {
        toast.warning(
          "Ciclo criado sem janela da chefia. Aplique a migration 0012 para habilitar este recurso.",
        );
      }
    }

    setSaving(false);
    if (error) {
      toast.error(`Erro ao criar ciclo: ${error.message}`);
      return;
    }

    toast.success("Novo ciclo criado.");
    setNewCycle({
      nome: "",
      fase_atual: "planejamento",
      janela_inicio: "",
      janela_fim: "",
      janela_chefia_inicio: "",
      janela_chefia_fim: "",
      observacoes: "",
    });
    fetchCycles();
  }

  async function updateCycle(id: string, patch: Partial<GovernancaCiclo>) {
    if (!isSuperadmin) {
      toast.warning("Somente superadmin pode alterar governança.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("governanca_ciclos")
      .update(patch)
      .eq("id", id);
    setSaving(false);

    if (error) {
      toast.error(`Erro ao atualizar ciclo: ${error.message}`);
      return;
    }
    fetchCycles();
  }

  async function activateCycle(id: string) {
    if (!isSuperadmin) {
      toast.warning("Somente superadmin pode definir o ciclo ativo.");
      return;
    }

    setSaving(true);
    const disablePrevious = await supabase
      .from("governanca_ciclos")
      .update({ ativo: false })
      .neq("id", id);

    if (disablePrevious.error) {
      setSaving(false);
      toast.error(
        `Erro ao desativar ciclo anterior: ${disablePrevious.error.message}`,
      );
      return;
    }

    const enableCurrent = await supabase
      .from("governanca_ciclos")
      .update({ ativo: true })
      .eq("id", id);

    setSaving(false);
    if (enableCurrent.error) {
      toast.error(`Erro ao ativar ciclo: ${enableCurrent.error.message}`);
      return;
    }

    toast.success("Ciclo ativo atualizado.");
    fetchCycles();
  }

  async function saveActiveWindow() {
    if (!activeCycle) {
      toast.warning("Nenhum ciclo ativo para atualizar.");
      return;
    }
    const start = parseLocalDateTimeToIso(activeWindowStart);
    const end = parseLocalDateTimeToIso(activeWindowEnd);
    const range = validateDateRange(start, end);
    if (!range.ok) {
      toast.error(range.error);
      return;
    }

    await updateCycle(activeCycle.id, {
      janela_inicio: start,
      janela_fim: end,
      status: deriveAutoStatus({
        fase_atual: activeCycle.fase_atual,
        janela_inicio: start,
        janela_fim: end,
      }),
    });
    toast.success("Janela geral do ciclo atualizada.");
  }

  async function saveChefiaWindow() {
    if (!activeCycle) {
      toast.warning("Nenhum ciclo ativo para atualizar.");
      return;
    }
    const start = parseLocalDateTimeToIso(activeChefiaWindowStart);
    const end = parseLocalDateTimeToIso(activeChefiaWindowEnd);
    const range = validateDateRange(start, end);
    if (!range.ok) {
      toast.error(range.error);
      return;
    }

    await updateCycle(activeCycle.id, {
      janela_chefia_inicio: start,
      janela_chefia_fim: end,
    });
    toast.success("Janela da chefia atualizada.");
  }

  return (
    <div className="p-8 bg-[#F3F2F1] min-h-screen space-y-8 text-[#1C1B1F]">
      <div className="flex flex-col gap-3 rounded-[32px] border border-[#D2D0CE] bg-white p-8 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-[#164073] tracking-tighter uppercase">
            Governança do Ciclo PCA
          </h1>
          <p className="text-sm font-medium text-black/50">
            Sem datas fixas em código. Janelas são geridas pelo superadmin e
            respeitam a data e o horário definidos pelo superadmin.
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-widest ${
            isSuperadmin
              ? "bg-upe-accent-washed-blue/25 text-upe-blue-upe"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <ShieldCheck size={18} weight="fill" />
          {isSuperadmin ? "Modo Superadmin" : "Modo Somente Leitura"}
        </div>
      </div>

      {dbMessage && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <div className="flex items-center gap-2 text-sm font-bold">
            <WarningCircle size={20} weight="fill" />
            Governança ainda não provisionada no banco
          </div>
          <p className="mt-2 text-sm">{dbMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <div className="rounded-[32px] border border-[#D2D0CE] bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold uppercase tracking-tight text-[#164073]">
                Ciclo Ativo
              </h2>
              {activeCycle?.ativo ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                  <LockOpen size={14} weight="fill" />
                  Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <Lock size={14} weight="fill" />
                  Sem ciclo ativo
                </span>
              )}
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-slate-500">
                Carregando governança...
              </p>
            ) : activeCycle ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <InfoCard label="Nome do Ciclo" value={activeCycle.nome} />
                  <InfoCard
                    label="Status"
                    value={
                      STATUS_OPTIONS.find((s) => s.value === activeCycle.status)
                        ?.label || activeCycle.status
                    }
                  />
                  <InfoCard
                    label="Fase Atual"
                    value={
                      FASE_OPTIONS.find(
                        (f) => f.value === activeCycle.fase_atual,
                      )?.label || activeCycle.fase_atual
                    }
                  />
                  <InfoCard
                    label="Atualizado em"
                    value={new Date(activeCycle.updated_at).toLocaleString(
                      "pt-BR",
                    )}
                  />
                  <InfoCard
                    label="Início da Janela"
                    value={formatDate(activeCycle.janela_inicio)}
                  />
                  <InfoCard
                    label="Fim da Janela"
                    value={formatDate(activeCycle.janela_fim)}
                  />
                  <InfoCard
                    label="Início Janela Chefia"
                    value={formatDate(activeCycle.janela_chefia_inicio)}
                  />
                  <InfoCard
                    label="Fim Janela Chefia"
                    value={formatDate(activeCycle.janela_chefia_fim)}
                  />
                </div>

                {isSuperadmin && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-upe-accent-washed-blue/70 bg-upe-accent-washed-blue/25 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-blue-medium">
                        Janela Geral do Ciclo
                      </p>
                      <div className="mt-3 grid gap-3">
                        <input
                          type="datetime-local"
                          value={activeWindowStart}
                          onChange={(e) => setActiveWindowStart(e.target.value)}
                          className="rounded-xl border border-upe-accent-washed-blue/70 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                          disabled={saving}
                        />
                        <input
                          type="datetime-local"
                          value={activeWindowEnd}
                          onChange={(e) => setActiveWindowEnd(e.target.value)}
                          className="rounded-xl border border-upe-accent-washed-blue/70 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                          disabled={saving}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 h-8 rounded-xl text-[10px] uppercase"
                        onClick={saveActiveWindow}
                        disabled={saving}
                      >
                        Salvar Janela Geral
                      </Button>
                    </div>

                    <div className="rounded-2xl border border-upe-accent-washed-blue/70 bg-upe-accent-washed-blue/25 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-upe-blue-medium">
                        Janela da Chefia
                      </p>
                      <div className="mt-3 grid gap-3">
                        <input
                          type="datetime-local"
                          value={activeChefiaWindowStart}
                          onChange={(e) => setActiveChefiaWindowStart(e.target.value)}
                          className="rounded-xl border border-upe-accent-washed-blue/70 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                          disabled={saving}
                        />
                        <input
                          type="datetime-local"
                          value={activeChefiaWindowEnd}
                          onChange={(e) => setActiveChefiaWindowEnd(e.target.value)}
                          className="rounded-xl border border-upe-accent-washed-blue/70 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                          disabled={saving}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 h-8 rounded-xl text-[10px] uppercase"
                        onClick={saveChefiaWindow}
                        disabled={saving}
                      >
                        Salvar Janela Chefia
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Nenhum ciclo cadastrado. Crie o primeiro ciclo de governança.
              </p>
            )}
          </div>

          <div className="rounded-[32px] border border-[#D2D0CE] bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold uppercase tracking-tight text-[#164073]">
              Ciclos Cadastrados
            </h2>
            <div className="mt-4 space-y-3">
              {cycles.map((cycle) => (
                <div
                  key={cycle.id}
                  className="rounded-2xl border border-slate-200 bg-[#F3F2F1] p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-tight text-slate-900">
                        {cycle.nome}
                      </p>
                      <p className="text-xs text-slate-500">
                        {FASE_OPTIONS.find((f) => f.value === cycle.fase_atual)
                          ?.label || cycle.fase_atual}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                        {STATUS_OPTIONS.find((s) => s.value === cycle.status)
                          ?.label || cycle.status}
                      </span>
                      {cycle.ativo && (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
                          Ativo
                        </span>
                      )}
                      {isSuperadmin && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-xl text-[10px] uppercase"
                            disabled={saving}
                            onClick={() => activateCycle(cycle.id)}
                          >
                            Ativar
                          </Button>
                          <select
                            className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-bold uppercase"
                            value={cycle.fase_atual}
                            onChange={(e) =>
                              updateCycle(cycle.id, {
                                fase_atual: e.target.value as FaseCiclo,
                                status: deriveAutoStatus({
                                  fase_atual: e.target.value as FaseCiclo,
                                  janela_inicio: cycle.janela_inicio,
                                  janela_fim: cycle.janela_fim,
                                }),
                              })
                            }
                          >
                            {FASE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!loading && cycles.length === 0 && (
                <p className="rounded-2xl bg-[#F3F2F1] p-4 text-sm text-slate-500">
                  Nenhum ciclo disponível.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-[#D2D0CE] bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold uppercase tracking-tight text-[#164073]">
            Novo Ciclo
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Superadmin define as regras de cada fase sem hardcode de datas.
            Início e fim respeitam exatamente a data e o horário informados.
          </p>

          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Nome
              </label>
              <input
                value={newCycle.nome}
                onChange={(e) =>
                  setNewCycle((prev) => ({ ...prev, nome: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                placeholder="Ex: PCA 2027 - Ciclo Oficial"
                disabled={!isSuperadmin || saving}
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Fase
                </label>
                <select
                  value={newCycle.fase_atual}
                  onChange={(e) =>
                    setNewCycle((prev) => ({
                      ...prev,
                      fase_atual: e.target.value as FaseCiclo,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  disabled={!isSuperadmin || saving}
                >
                  {FASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  <Calendar size={12} />
                  Janela Início
                </label>
                <input
                  type="datetime-local"
                  value={newCycle.janela_inicio}
                  onChange={(e) =>
                    setNewCycle((prev) => ({
                      ...prev,
                      janela_inicio: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  disabled={!isSuperadmin || saving}
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  <Clock size={12} />
                  Janela Fim
                </label>
                <input
                  type="datetime-local"
                  value={newCycle.janela_fim}
                  onChange={(e) =>
                    setNewCycle((prev) => ({
                      ...prev,
                      janela_fim: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  disabled={!isSuperadmin || saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  <Calendar size={12} />
                  Início Janela Chefia
                </label>
                <input
                  type="datetime-local"
                  value={newCycle.janela_chefia_inicio}
                  onChange={(e) =>
                    setNewCycle((prev) => ({
                      ...prev,
                      janela_chefia_inicio: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  disabled={!isSuperadmin || saving}
                />
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  <Clock size={12} />
                  Fim Janela Chefia
                </label>
                <input
                  type="datetime-local"
                  value={newCycle.janela_chefia_fim}
                  onChange={(e) =>
                    setNewCycle((prev) => ({
                      ...prev,
                      janela_chefia_fim: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                  disabled={!isSuperadmin || saving}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                Observações
              </label>
              <textarea
                value={newCycle.observacoes}
                onChange={(e) =>
                  setNewCycle((prev) => ({
                    ...prev,
                    observacoes: e.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-upe-accent-washed-blue/70"
                disabled={!isSuperadmin || saving}
              />
            </div>

            <Button
              onClick={createCycle}
              disabled={!isSuperadmin || saving || !!dbMessage}
              className="w-full bg-[#164073] hover:bg-upe-blue-deep"
            >
              {saving ? "Salvando..." : "Criar Ciclo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F3F2F1] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}

