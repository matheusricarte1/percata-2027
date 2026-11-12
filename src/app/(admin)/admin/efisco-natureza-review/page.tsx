"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@/components/icons/phosphor/exports/ArrowClockwise";
import { CheckCircle } from "@/components/icons/phosphor/exports/CheckCircle";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { toast } from "sonner";
import { EfiscoIntelligenceNav } from "@/components/admin/EfiscoIntelligenceNav";
import { EfiscoIntelligenceSummary } from "@/components/admin/EfiscoIntelligenceSummary";
import { cn } from "@/lib/utils";
import { MechanicalValue } from "@/components/ui/MechanicalValue";

type ReviewStatus =
  | "pendente"
  | "em_analise"
  | "saneado"
  | "substituido"
  | "bloqueado";

type ReviewItem = {
  id: number;
  efisco_item_id: number;
  dfd_id: string | null;
  dfd_item_id: string | null;
  decision_scope: "catalogo" | "dfd_item";
  status: ReviewStatus;
  codigo_natureza_despesa: string | null;
  replacement_efisco_item_id: number | null;
  codigo_efisco: string;
  descricao: string;
  tipo_objeto: string | null;
  nome_grupo: string | null;
  nome_classe: string | null;
  numero_protocolo: string | null;
  dfd_status: string | null;
  quantidade: number | null;
  valor_total_item: number | null;
  justificativa: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewPayload = {
  generated_at: string;
  summary: {
    total: number;
    abertos: number;
    pendentes: number;
    em_analise: number;
    saneados: number;
    substituidos: number;
    bloqueados: number;
    vinculados_a_dfd: number;
    apenas_catalogo: number;
  } | null;
  items: ReviewItem[];
};

const STATUS_OPTIONS: Array<{ value: ReviewStatus | "todos"; label: string }> = [
  { value: "pendente", label: "Pendentes" },
  { value: "em_analise", label: "Em análise" },
  { value: "saneado", label: "Saneados" },
  { value: "substituido", label: "Substituídos" },
  { value: "bloqueado", label: "Bloqueados" },
  { value: "todos", label: "Todos" },
];

const DECISION_OPTIONS: Array<{ value: ReviewStatus; label: string }> = [
  { value: "em_analise", label: "Colocar em análise" },
  { value: "saneado", label: "Sanear com natureza" },
  { value: "substituido", label: "Substituir por outro item" },
  { value: "bloqueado", label: "Bloquear uso" },
  { value: "pendente", label: "Voltar para pendente" },
];

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function statusLabel(status: string) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label ||
    String(status || "Sem status")
  );
}

function statusTone(status: string) {
  if (status === "saneado") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "bloqueado") return "bg-red-50 text-red-700 border-red-200";
  if (status === "substituido") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "em_analise") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone?: "warning" | "good" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-4 shadow-sm",
        tone === "danger" && "border-red-200",
        tone === "warning" && "border-amber-200",
        tone === "good" && "border-emerald-200",
        !tone && "border-slate-200",
      )}
    >
      <p className="type-kicker font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 min-w-0 overflow-visible text-2xl font-semibold text-[var(--p-color-brand-500)]">
        <MechanicalValue value={formatNumber(value)} />
      </p>
    </div>
  );
}

export default function EfiscoNaturezaReviewPage() {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [status, setStatus] = useState<ReviewStatus | "todos">("pendente");
  const [scope, setScope] = useState<"todos" | "catalogo" | "dfd_item">("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReviewItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [decisionStatus, setDecisionStatus] = useState<ReviewStatus>("em_analise");
  const [natureza, setNatureza] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [justificativa, setJustificativa] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "120", status });
      if (scope !== "todos") params.set("scope", scope);
      const response = await fetch(`/api/admin/efisco-natureza-review?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao carregar saneamento.");
      setPayload(data);
      if (selected && !data.items.some((item: ReviewItem) => item.id === selected.id)) {
        setSelected(null);
      }
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar saneamento e-Fisco.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, scope]);

  function selectItem(item: ReviewItem) {
    setSelected(item);
    setDecisionStatus(item.status === "pendente" ? "em_analise" : item.status);
    setNatureza(item.codigo_natureza_despesa || "");
    setReplacementId(item.replacement_efisco_item_id ? String(item.replacement_efisco_item_id) : "");
    setJustificativa(item.justificativa || "");
  }

  async function saveDecision() {
    if (!selected) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/efisco-natureza-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: decisionStatus,
          efisco_item_id: selected.efisco_item_id,
          dfd_item_id: selected.dfd_item_id,
          codigo_natureza_despesa: natureza,
          replacement_efisco_item_id: replacementId,
          justificativa,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao salvar decisão.");
      toast.success("Decisão registrada.");
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar decisão.");
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payload?.items || [];
    return (payload?.items || []).filter((item) =>
      [
        item.codigo_efisco,
        item.descricao,
        item.nome_grupo,
        item.nome_classe,
        item.numero_protocolo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [payload?.items, search]);

  const summary = payload?.summary;
  const exportHref = `/api/admin/efisco-natureza-review?format=csv&status=${status}${
    scope !== "todos" ? `&scope=${scope}` : ""
  }`;

  return (
    <main className="min-h-screen bg-[var(--p-color-bg-muted)] p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
            Administração interna
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
            Saneamento de natureza e-Fisco
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Fila restrita a admin e superadmin para tratar itens sem natureza,
            registrar decisão oficial e reaproveitar a correção nos próximos DFDs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={exportHref}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-[var(--p-color-brand-500)] hover:bg-slate-50"
          >
            <DownloadSimple size={16} />
            Exportar CSV
          </a>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--p-color-brand-500)] px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-[var(--p-color-brand-700)] disabled:opacity-60"
          >
            <ArrowClockwise size={16} className={loading ? "animate-spin" : ""} />
            Atualizar
          </button>
        </div>
      </div>

      <EfiscoIntelligenceNav />
      <EfiscoIntelligenceSummary />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Abertos" value={summary?.abertos} tone="danger" />
        <Metric label="Pendentes" value={summary?.pendentes} tone="warning" />
        <Metric label="Em análise" value={summary?.em_analise} tone="warning" />
        <Metric label="Saneados" value={summary?.saneados} tone="good" />
        <Metric label="Vinculados a DFD" value={summary?.vinculados_a_dfd} />
        <Metric label="Total histórico" value={summary?.total} />
      </div>

      <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex gap-2">
          <WarningCircle size={18} className="mt-0.5 shrink-0" />
          <p>
            Esta fila trata falha cadastral da base e-Fisco. A decisão fica
            interna: o solicitante e a chefia continuam usando as DFDs sem ver a
            pendência administrativa.
          </p>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ReviewStatus | "todos")}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[var(--p-color-brand-500)]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as typeof scope)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-[var(--p-color-brand-500)]"
            >
              <option value="todos">Catálogo e DFD</option>
              <option value="catalogo">Somente catálogo</option>
              <option value="dfd_item">Somente DFD</option>
            </select>
            <label className="flex h-10 min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500">
              <MagnifyingGlass size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filtrar código, descrição ou protocolo"
                className="h-full flex-1 bg-transparent outline-none"
              />
            </label>
          </div>
          <div className="max-h-[680px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 type-kicker uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => selectItem(item)}
                    className={cn(
                      "cursor-pointer hover:bg-slate-50",
                      selected?.id === item.id && "bg-blue-50/70",
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--p-color-brand-500)]">
                        {item.codigo_efisco}
                      </p>
                      <p className="mt-1 line-clamp-2 max-w-xl text-xs text-slate-600">
                        {item.descricao}
                      </p>
                      <p className="mt-1 type-kicker uppercase tracking-wider text-slate-400">
                        {item.tipo_objeto || "-"} · {item.nome_classe || item.nome_grupo || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {item.numero_protocolo || "Catálogo"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 type-kicker font-semibold uppercase tracking-wider",
                          statusTone(item.status),
                        )}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {item.valor_total_item ? formatCurrency(item.valor_total_item) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filteredItems.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">
                Nenhum item encontrado para os filtros atuais.
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="type-kicker font-semibold uppercase tracking-widest text-slate-500">
                  Decisão administrativa
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--p-color-brand-500)]">
                  {selected.codigo_efisco}
                </h2>
                <p className="mt-1 text-sm text-slate-600 line-clamp-3">
                  {selected.descricao}
                </p>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Status</span>
                <select
                  value={decisionStatus}
                  onChange={(event) => setDecisionStatus(event.target.value as ReviewStatus)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                >
                  {DECISION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Natureza oficial
                </span>
                <input
                  value={natureza}
                  onChange={(event) => setNatureza(event.target.value)}
                  placeholder="Ex.: 33903016"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Item substituto e-Fisco
                </span>
                <input
                  value={replacementId}
                  onChange={(event) => setReplacementId(event.target.value)}
                  placeholder="ID interno do item"
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">
                  Justificativa interna
                </span>
                <textarea
                  value={justificativa}
                  onChange={(event) => setJustificativa(event.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={saveDecision}
                disabled={saving}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--p-color-brand-500)] px-4 text-xs font-semibold uppercase tracking-widest text-white hover:bg-[var(--p-color-brand-700)] disabled:opacity-60"
              >
                <CheckCircle size={16} />
                Salvar decisão
              </button>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center text-sm text-slate-500">
              <WarningCircle size={28} className="mb-3 text-slate-400" />
              Selecione um item da fila para registrar a decisão de saneamento.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
