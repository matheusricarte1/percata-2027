"use client";

import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, TrendUp, CursorClick, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Metrics = {
  searches_7d: number;
  clicks_7d: number;
  unique_queries_7d: number;
  click_through_rate: number;
};

type QueryInsight = {
  query_norm: string;
  query_label: string;
  searches: number;
  clicks: number;
  zero_result_searches: number;
  total_result_count: number;
  avg_result_count: number;
  latest_result_count: number;
  categories: string[];
  contexts: string[];
  last_searched_at: string;
  last_clicked_at: string | null;
  top_clicked_code: string | null;
  top_clicked_label: string | null;
};

type LogRow = {
  id: number;
  query_text: string;
  query_norm: string;
  category: string;
  context: string;
  source: string;
  result_count: number;
  top_catalog_id?: number | null;
  top_codigo_efisco?: string | null;
  created_at: string;
};

type ClickRow = {
  id: number;
  action_type: string;
  query_text?: string | null;
  query_norm?: string | null;
  category: string;
  context: string;
  source: string;
  result_position?: number | null;
  catalog_id?: number | null;
  codigo_efisco?: string | null;
  item_descricao?: string | null;
  created_at: string;
};

type OverrideRow = {
  id: number;
  query_norm: string;
  match_mode: "exact" | "contains";
  override_type: "boost" | "block";
  catalog_id?: number | null;
  codigo_efisco?: string | null;
  weight: number;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ActionQueues = {
  no_click_queries: QueryInsight[];
  zero_result_queries: QueryInsight[];
  low_ctr_queries: QueryInsight[];
};

type InsightsPayload = {
  metrics: Metrics;
  queries: QueryInsight[];
  actionQueues: ActionQueues;
  recentLogs: LogRow[];
  recentClicks: ClickRow[];
  overrides: OverrideRow[];
};

type OverrideDraft = {
  query_norm: string;
  match_mode: "exact" | "contains";
  override_type: "boost" | "block";
  catalog_id: string;
  codigo_efisco: string;
  weight: string;
  notes: string;
};

const EMPTY_DRAFT: OverrideDraft = {
  query_norm: "",
  match_mode: "exact",
  override_type: "boost",
  catalog_id: "",
  codigo_efisco: "",
  weight: "300",
  notes: "",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export default function AdminCatalogoBuscaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<InsightsPayload | null>(null);
  const [draft, setDraft] = useState<OverrideDraft>(EMPTY_DRAFT);
  const [filter, setFilter] = useState("");

  async function loadInsights() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/catalog-search");
      const nextPayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(nextPayload?.error || "Falha ao carregar painel.");
      setPayload(nextPayload as InsightsPayload);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar painel da busca.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, []);

  async function createOverride() {
    if (!draft.query_norm.trim()) {
      toast.warning("Informe a query do override.");
      return;
    }
    if (!draft.catalog_id.trim() && !draft.codigo_efisco.trim()) {
      toast.warning("Informe o item por catalog_id ou código e-Fisco.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/catalog-search/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_norm: draft.query_norm,
          match_mode: draft.match_mode,
          override_type: draft.override_type,
          catalog_id: draft.catalog_id || null,
          codigo_efisco: draft.codigo_efisco || null,
          weight: Number(draft.weight || 0),
          notes: draft.notes,
        }),
      });
      const nextPayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(nextPayload?.error || "Falha ao criar override.");
      toast.success("Override salvo.");
      setDraft(EMPTY_DRAFT);
      await loadInsights();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao criar override.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleOverride(override: OverrideRow) {
    try {
      const response = await fetch(`/api/admin/catalog-search/overrides/${override.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !override.is_active }),
      });
      const nextPayload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(nextPayload?.error || "Falha ao atualizar override.");
      toast.success(override.is_active ? "Override desativado." : "Override ativado.");
      await loadInsights();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao atualizar override.");
    }
  }

  function prefillOverride(queryNorm: string, click?: ClickRow | QueryInsight, overrideType: "boost" | "block" = "boost") {
    setDraft({
      query_norm: queryNorm,
      match_mode: "exact",
      override_type: overrideType,
      catalog_id: click && "catalog_id" in click && click.catalog_id ? String(click.catalog_id) : "",
      codigo_efisco: click && "codigo_efisco" in click ? String(click.codigo_efisco || "") : "",
      weight: overrideType === "block" ? "0" : "300",
      notes:
        click && "item_descricao" in click
          ? `Criado a partir do clique recente em ${click.item_descricao || click.codigo_efisco || "item do catálogo"}.`
          : click && "top_clicked_label" in click
            ? `Criado a partir do item mais clicado para a query ${queryNorm}.`
            : "",
    });
  }

  const visibleQueries = useMemo(() => {
    const queries = payload?.queries || [];
    const term = filter.trim().toLowerCase();
    if (!term) return queries;
    return queries.filter((query) =>
      `${query.query_label} ${query.top_clicked_label || ""} ${query.top_clicked_code || ""}`
        .toLowerCase()
      .includes(term),
    );
  }, [filter, payload?.queries]);

  const noClickQueries = payload?.actionQueues.no_click_queries || [];
  const zeroResultQueries = payload?.actionQueues.zero_result_queries || [];
  const lowCtrQueries = payload?.actionQueues.low_ctr_queries || [];

  return (
    <main className="space-y-6">
      <section className="rounded-[28px] border border-[#DDE5EF] bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#526070]">
              Administração
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#164073]">
              Busca do catálogo
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[#526070]">
              Leituras reais da busca: consultas feitas, itens escolhidos e overrides manuais para subir ou bloquear resultados.
            </p>
          </div>
          <button
            type="button"
            onClick={loadInsights}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#CBD5E1] px-4 text-sm font-semibold text-[#164073]"
          >
            <MagnifyingGlass size={16} weight="bold" /> Atualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Buscas 7 dias"
          value={String(payload?.metrics.searches_7d || 0)}
          icon={<MagnifyingGlass size={18} weight="bold" />}
        />
        <MetricCard
          label="Cliques 7 dias"
          value={String(payload?.metrics.clicks_7d || 0)}
          icon={<CursorClick size={18} weight="bold" />}
        />
        <MetricCard
          label="Queries únicas"
          value={String(payload?.metrics.unique_queries_7d || 0)}
          icon={<Sparkle size={18} weight="bold" />}
        />
        <MetricCard
          label="CTR"
          value={formatPercent(payload?.metrics.click_through_rate || 0)}
          icon={<TrendUp size={18} weight="bold" />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <QueueCard
          title="Sem clique"
          description="Consultas recorrentes que retornam itens, mas ninguém escolhe nada."
          icon={<CursorClick size={18} weight="bold" />}
          accent="amber"
          count={noClickQueries.length}
          items={noClickQueries}
          onBoost={(query) => prefillOverride(query.query_norm, query, "boost")}
        />
        <QueueCard
          title="Sem resultado"
          description="Consultas que precisam de sinônimo, expansão ou tratamento de gap."
          icon={<WarningCircle size={18} weight="bold" />}
          accent="rose"
          count={zeroResultQueries.length}
          items={zeroResultQueries}
          onBoost={(query) => prefillOverride(query.query_norm, query, "boost")}
        />
        <QueueCard
          title="CTR baixo"
          description="Consultas com volume real e pouca confirmação por clique."
          icon={<TrendUp size={18} weight="bold" />}
          accent="blue"
          count={lowCtrQueries.length}
          items={lowCtrQueries}
          onBoost={(query) => prefillOverride(query.query_norm, query, "boost")}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[28px] border border-[#DDE5EF] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[#164073]">Consultas observadas</h2>
              <p className="mt-1 text-sm text-[#526070]">
                Use a query real e o item clicado como base para calibrar overrides.
              </p>
            </div>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filtrar query, item ou código"
              className="h-11 rounded-2xl border border-[#CBD5E1] px-4 text-sm outline-none focus:border-[#164073]"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#E5EDF5]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[#526070]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Query</th>
                  <th className="px-4 py-3 font-semibold">Uso</th>
                  <th className="px-4 py-3 font-semibold">Item mais clicado</th>
                  <th className="px-4 py-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#667085]">
                      Carregando consultas...
                    </td>
                  </tr>
                ) : visibleQueries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#667085]">
                      Nenhuma consulta encontrada.
                    </td>
                  </tr>
                ) : (
                  visibleQueries.map((query) => (
                    <tr key={query.query_norm} className="border-t border-[#EEF2F7] align-top">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#0F172A]">{query.query_label}</div>
                        <div className="mt-1 text-xs text-[#667085]">{query.query_norm}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#526070]">
                          {query.contexts.map((context) => (
                            <span key={context} className="rounded-full bg-[#F3F6FB] px-2 py-1">
                              {context}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#344054]">
                        <div>{query.searches} busca(s)</div>
                        <div>{query.clicks} clique(s)</div>
                        <div>{query.zero_result_searches} sem resultado</div>
                        <div className="mt-1 text-xs text-[#667085]">
                          Última: {formatDateTime(query.last_searched_at)} · {query.latest_result_count} resultado(s)
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#344054]">
                        <div className="font-medium">{query.top_clicked_label || "Sem clique ainda"}</div>
                        <div className="mt-1 text-xs text-[#667085]">
                          {query.top_clicked_code || "Sem código"}
                        </div>
                        <div className="mt-1 text-xs text-[#667085]">
                          Média de resultados: {Math.round(query.avg_result_count)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => prefillOverride(query.query_norm, query, "boost")}
                            className="rounded-xl bg-[#164073] px-3 py-2 text-xs font-semibold text-white"
                          >
                            Boostar
                          </button>
                          <button
                            type="button"
                            onClick={() => prefillOverride(query.query_norm, query, "block")}
                            className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#7A271A]"
                          >
                            Bloquear
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#DDE5EF] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#164073]">Novo override</h2>
            <p className="mt-1 text-sm text-[#526070]">
              Crie uma regra explícita para uma query problemática.
            </p>
            <div className="mt-5 grid gap-4">
              <label className="text-sm font-medium text-[#344054]">
                Query normalizada
                <input
                  value={draft.query_norm}
                  onChange={(event) => setDraft((current) => ({ ...current, query_norm: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#CBD5E1] px-4 outline-none focus:border-[#164073]"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-[#344054]">
                  Modo
                  <select
                    value={draft.match_mode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        match_mode: event.target.value as OverrideDraft["match_mode"],
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-[#CBD5E1] px-4 outline-none focus:border-[#164073]"
                  >
                    <option value="exact">Exato</option>
                    <option value="contains">Contém</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-[#344054]">
                  Tipo
                  <select
                    value={draft.override_type}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        override_type: event.target.value as OverrideDraft["override_type"],
                      }))
                    }
                    className="mt-2 h-11 w-full rounded-2xl border border-[#CBD5E1] px-4 outline-none focus:border-[#164073]"
                  >
                    <option value="boost">Boost</option>
                    <option value="block">Block</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-[#344054]">
                  Catalog ID
                  <input
                    value={draft.catalog_id}
                    onChange={(event) => setDraft((current) => ({ ...current, catalog_id: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-[#CBD5E1] px-4 outline-none focus:border-[#164073]"
                  />
                </label>
                <label className="text-sm font-medium text-[#344054]">
                  Código e-Fisco
                  <input
                    value={draft.codigo_efisco}
                    onChange={(event) => setDraft((current) => ({ ...current, codigo_efisco: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-[#CBD5E1] px-4 outline-none focus:border-[#164073]"
                  />
                </label>
              </div>
              <label className="text-sm font-medium text-[#344054]">
                Peso
                <input
                  value={draft.weight}
                  onChange={(event) => setDraft((current) => ({ ...current, weight: event.target.value }))}
                  className="mt-2 h-11 w-full rounded-2xl border border-[#CBD5E1] px-4 outline-none focus:border-[#164073]"
                />
              </label>
              <label className="text-sm font-medium text-[#344054]">
                Observação
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-[#CBD5E1] px-4 py-3 outline-none focus:border-[#164073]"
                />
              </label>
              <button
                type="button"
                onClick={createOverride}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#164073] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Sparkle size={16} weight="bold" /> {saving ? "Salvando..." : "Salvar override"}
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-[#DDE5EF] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#164073]">Overrides ativos e históricos</h2>
            <div className="mt-5 space-y-3">
              {(payload?.overrides || []).map((override) => (
                <div
                  key={override.id}
                  className="rounded-2xl border border-[#E5EDF5] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#0F172A]">{override.query_norm}</div>
                      <div className="mt-1 text-xs text-[#667085]">
                        {override.override_type} · {override.match_mode} · código {override.codigo_efisco || "—"} · peso {override.weight}
                      </div>
                      {override.notes && (
                        <p className="mt-2 text-sm text-[#344054]">{override.notes}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleOverride(override)}
                      className={cn(
                        "rounded-xl px-3 py-2 text-xs font-semibold",
                        override.is_active
                          ? "bg-[#FEF3F2] text-[#B42318]"
                          : "bg-[#ECFDF3] text-[#027A48]",
                      )}
                    >
                      {override.is_active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-[#667085]">
                    Atualizado em {formatDateTime(override.updated_at)}
                  </div>
                </div>
              ))}
              {(payload?.overrides || []).length === 0 && (
                <p className="text-sm text-[#667085]">Nenhum override cadastrado.</p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#DDE5EF] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#164073]">Buscas recentes</h2>
            <div className="mt-4 space-y-3">
              {(payload?.recentLogs || []).slice(0, 10).map((log) => (
                <div key={log.id} className="rounded-2xl border border-[#E5EDF5] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#0F172A]">
                        {log.query_text || log.query_norm}
                      </div>
                      <div className="mt-1 text-xs text-[#667085]">
                        {log.context} · {log.source} · {formatDateTime(log.created_at)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        log.result_count === 0
                          ? "bg-[#FEF3F2] text-[#B42318]"
                          : "bg-[#ECFDF3] text-[#027A48]",
                      )}
                    >
                      {log.result_count} resultado(s)
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => prefillOverride(log.query_norm || log.query_text, undefined, "boost")}
                      className="rounded-xl bg-[#164073] px-3 py-2 text-xs font-semibold text-white"
                    >
                      Preparar boost
                    </button>
                    {log.result_count === 0 && (
                      <button
                        type="button"
                        onClick={() => prefillOverride(log.query_norm || log.query_text, undefined, "boost")}
                        className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#164073]"
                      >
                        Tratar gap
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#DDE5EF] bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#164073]">Cliques recentes</h2>
            <div className="mt-4 space-y-3">
              {(payload?.recentClicks || []).slice(0, 12).map((click) => (
                <div key={click.id} className="rounded-2xl border border-[#E5EDF5] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#0F172A]">
                        {click.item_descricao || click.codigo_efisco || "Item"}
                      </div>
                      <div className="mt-1 text-xs text-[#667085]">
                        {click.query_text || click.query_norm || "Sem query"} · {click.action_type} · {formatDateTime(click.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => prefillOverride(click.query_norm || click.query_text || "", click, "boost")}
                        className="rounded-xl bg-[#164073] px-3 py-2 text-xs font-semibold text-white"
                      >
                        Boost
                      </button>
                      <button
                        type="button"
                        onClick={() => prefillOverride(click.query_norm || click.query_text || "", click, "block")}
                        className="rounded-xl border border-[#CBD5E1] px-3 py-2 text-xs font-semibold text-[#7A271A]"
                      >
                        Block
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[#DDE5EF] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#526070]">{label}</span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F3F6FB] text-[#164073]">
          {icon}
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-[#164073]">{value}</div>
    </section>
  );
}

function QueueCard({
  title,
  description,
  count,
  icon,
  items,
  accent,
  onBoost,
}: {
  title: string;
  description: string;
  count: number;
  icon: React.ReactNode;
  items: QueryInsight[];
  accent: "amber" | "rose" | "blue";
  onBoost: (query: QueryInsight) => void;
}) {
  const accentClass =
    accent === "rose"
      ? "bg-[#FEF3F2] text-[#B42318]"
      : accent === "amber"
        ? "bg-[#FFFAEB] text-[#B54708]"
        : "bg-[#EFF6FF] text-[#1D4ED8]";

  return (
    <section className="rounded-[24px] border border-[#DDE5EF] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[#164073]">{title}</div>
          <p className="mt-1 text-sm text-[#526070]">{description}</p>
        </div>
        <span className={cn("inline-flex h-10 min-w-10 items-center justify-center rounded-2xl px-3 text-sm font-semibold", accentClass)}>
          {icon}
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-[#164073]">{count}</div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D7E2EE] px-4 py-4 text-sm text-[#667085]">
            Nada crítico nesta fila agora.
          </div>
        ) : (
          items.slice(0, 3).map((query) => (
            <div key={query.query_norm} className="rounded-2xl border border-[#E5EDF5] px-4 py-3">
              <div className="font-semibold text-[#0F172A]">{query.query_label}</div>
              <div className="mt-1 text-xs text-[#667085]">
                {query.searches} busca(s) · {query.clicks} clique(s) · última em {formatDateTime(query.last_searched_at)}
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => onBoost(query)}
                  className="rounded-xl bg-[#164073] px-3 py-2 text-xs font-semibold text-white"
                >
                  Abrir no override
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
