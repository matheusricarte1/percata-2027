"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowClockwise } from "@/components/icons/phosphor/exports/ArrowClockwise";
import { CaretDown } from "@/components/icons/phosphor/exports/CaretDown";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { Database } from "@/components/icons/phosphor/exports/Database";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { ListChecks } from "@/components/icons/phosphor/exports/ListChecks";
import { Scales } from "@/components/icons/phosphor/exports/Scales";
import { WarningCircle } from "@/components/icons/phosphor/exports/WarningCircle";
import { toast } from "sonner";
import { EfiscoIntelligenceNav } from "@/components/admin/EfiscoIntelligenceNav";
import { EfiscoIntelligenceSummary } from "@/components/admin/EfiscoIntelligenceSummary";
import { buildCsv, protectReportRow } from "@/lib/admin-reports";
import { cn } from "@/lib/utils";
import { MechanicalValue } from "@/components/ui/MechanicalValue";

type Quality = {
  itens_com_natureza_ausente: number;
  itens_misturam_custeio_investimento: number;
  itens_multiplas_naturezas: number;
  itens_nome_muito_longo: number;
  total_itens: number;
  refreshed_at: string;
};

type QueueItem = {
  efisco_item_id: number;
  codigo_efisco: string;
  descricao: string;
  tipo_objeto: string;
  nome_grupo: string;
  nome_classe: string;
  nome_material_servico: string;
  natureza_count: number;
  gnds?: string[] | null;
  naturezas?: string[] | null;
};

type TaxonomyRow = {
  codigo_grupo: string;
  nome_grupo: string;
  codigo_classe: string;
  nome_classe: string;
  tipo_objeto: string;
  itens: number;
  vinculos_natureza: number;
  naturezas_distintas: number;
  itens_mistos: number;
  itens_sem_natureza: number;
};

type TaxonomyItem = {
  id: number;
  codigo_efisco: string;
  descricao: string;
  tipo_objeto: string;
  codigo_grupo: string;
  nome_grupo: string;
  codigo_classe: string;
  nome_classe: string;
  codigo_natureza_preferencial: string | null;
  gnd_preferencial: string | null;
  natureza_count: number;
  has_missing_natureza: boolean;
  has_mixed_expense_classes: boolean;
};

type GovernancePayload = {
  generated_at: string;
  quality: Quality | null;
  gndDistribution: Array<{
    gnd: string;
    classe_despesa: string;
    vinculos: number;
    itens_distintos: number;
  }>;
  taxonomy: TaxonomyRow[];
  planningSignals: Array<{
    codigo_item: string;
    nome_item: string;
    tipo_objeto: string;
    nome_grupo: string;
    nome_classe: string;
    natureza_count: number;
    has_mixed_expense_classes: boolean;
    has_missing_natureza: boolean;
    sinal_planejamento: string;
  }>;
  queues: {
    missingNatureza: QueueItem[];
    mixedExpenseClasses: QueueItem[];
  };
};

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatPercent(part: unknown, total: unknown) {
  const denominator = Number(total || 0);
  if (!denominator) return "0%";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Number(part || 0) / denominator);
}

function exportCsv(name: string, rows: QueueItem[]) {
  const headers = [
    "fila",
    "codigo_efisco",
    "descricao",
    "tipo_objeto",
    "efisco_item_id",
    "nome_grupo",
    "nome_classe",
    "nome_material_servico",
    "natureza_count",
    "gnds",
    "naturezas",
  ];
  const fila = name.includes("misto") ? "misto_custeio_capital" : "sem_natureza";
  const csv = buildCsv(
    rows.map((row) =>
      protectReportRow({
        fila,
        efisco_item_id: row.efisco_item_id,
        codigo_efisco: row.codigo_efisco,
        descricao: row.descricao,
        tipo_objeto: row.tipo_objeto,
        nome_grupo: row.nome_grupo,
        nome_classe: row.nome_classe,
        nome_material_servico: row.nome_material_servico,
        natureza_count: row.natureza_count,
        gnds: (row.gnds || []).join("|"),
        naturezas: (row.naturezas || []).join("|"),
      }),
    ),
    headers,
  );
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "critical" | "good";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-5 shadow-sm",
        tone === "critical" && "border-red-200",
        tone === "warning" && "border-amber-200",
        tone === "good" && "border-emerald-200",
        tone === "neutral" && "border-slate-200",
      )}
    >
      <p className="type-kicker font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 min-w-0 overflow-visible text-3xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
        <MechanicalValue value={value} />
      </p>
      <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function buildTaxonomyTree(rows: TaxonomyRow[]) {
  const groups = new Map<
    string,
    {
      key: string;
      codigo: string;
      nome: string;
      itens: number;
      semNatureza: number;
      mistos: number;
      naturezas: number;
      types: Map<
        string,
        {
          key: string;
          nome: string;
          itens: number;
          semNatureza: number;
          mistos: number;
          naturezas: number;
          classes: TaxonomyRow[];
        }
      >;
    }
  >();

  for (const row of rows) {
    const groupKey = `${row.codigo_grupo || "sem-codigo"}:${row.nome_grupo || "Sem grupo"}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        codigo: row.codigo_grupo || "-",
        nome: row.nome_grupo || "Sem grupo informado",
        itens: 0,
        semNatureza: 0,
        mistos: 0,
        naturezas: 0,
        types: new Map(),
      });
    }

    const group = groups.get(groupKey)!;
    const typeKey = row.tipo_objeto || "Sem tipo";
    if (!group.types.has(typeKey)) {
      group.types.set(typeKey, {
        key: `${groupKey}:${typeKey}`,
        nome: typeKey,
        itens: 0,
        semNatureza: 0,
        mistos: 0,
        naturezas: 0,
        classes: [],
      });
    }

    const type = group.types.get(typeKey)!;
    group.itens += Number(row.itens || 0);
    group.semNatureza += Number(row.itens_sem_natureza || 0);
    group.mistos += Number(row.itens_mistos || 0);
    group.naturezas += Number(row.naturezas_distintas || 0);
    type.itens += Number(row.itens || 0);
    type.semNatureza += Number(row.itens_sem_natureza || 0);
    type.mistos += Number(row.itens_mistos || 0);
    type.naturezas += Number(row.naturezas_distintas || 0);
    type.classes.push(row);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      types: Array.from(group.types.values())
        .map((type) => ({
          ...type,
          classes: type.classes.sort((a, b) => Number(b.itens || 0) - Number(a.itens || 0)),
        }))
        .sort((a, b) => b.itens - a.itens),
    }))
    .sort((a, b) => b.itens - a.itens);
}

function CatalogTaxonomyTree({ rows }: { rows: TaxonomyRow[] }) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const [openTypes, setOpenTypes] = useState<Set<string>>(() => new Set());
  const [openClasses, setOpenClasses] = useState<Set<string>>(() => new Set());
  const [classItems, setClassItems] = useState<Record<string, TaxonomyItem[]>>({});
  const [loadingClasses, setLoadingClasses] = useState<Set<string>>(() => new Set());
  const tree = useMemo(() => buildTaxonomyTree(rows), [rows]);

  function toggleGroup(key: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleType(key: string) {
    setOpenTypes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function toggleClass(row: TaxonomyRow, classKey: string) {
    const willOpen = !openClasses.has(classKey);
    setOpenClasses((current) => {
      const next = new Set(current);
      if (next.has(classKey)) next.delete(classKey);
      else next.add(classKey);
      return next;
    });

    if (!willOpen || classItems[classKey] || loadingClasses.has(classKey)) return;

    setLoadingClasses((current) => new Set(current).add(classKey));
    try {
      const params = new URLSearchParams({
        codigo_classe: row.codigo_classe,
        tipo_objeto: row.tipo_objeto,
        limit: "80",
      });
      const response = await fetch(`/api/admin/efisco-governance/taxonomy-items?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao carregar itens da classe.");
      setClassItems((current) => ({
        ...current,
        [classKey]: data.items || [],
      }));
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar itens da classe.");
      setOpenClasses((current) => {
        const next = new Set(current);
        next.delete(classKey);
        return next;
      });
    } finally {
      setLoadingClasses((current) => {
        const next = new Set(current);
        next.delete(classKey);
        return next;
      });
    }
  }

  if (tree.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
        Nenhuma família carregada.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tree.slice(0, 12).map((group) => {
        const groupOpen = openGroups.has(group.key);
        return (
          <div key={group.key} className="rounded-xl border border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition hover:bg-slate-50"
              aria-expanded={groupOpen}
            >
              <span className="flex min-w-0 gap-2">
                {groupOpen ? (
                  <CaretDown size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--p-color-brand-400)]" />
                ) : (
                  <CaretRight size={16} weight="bold" className="mt-0.5 shrink-0 text-[var(--p-color-brand-400)]" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-700 line-clamp-2">
                    {group.nome}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Grupo {group.codigo} · {formatNumber(group.types.length)} tipo(s) · {formatNumber(group.semNatureza)} sem natureza
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold text-[var(--p-color-brand-500)]">
                {formatNumber(group.itens)}
              </span>
            </button>

            {groupOpen ? (
              <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="space-y-2">
                  {group.types.map((type) => {
                    const typeOpen = openTypes.has(type.key);
                    return (
                      <div key={type.key} className="rounded-lg border border-slate-100 bg-white">
                        <button
                          type="button"
                          onClick={() => toggleType(type.key)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50"
                          aria-expanded={typeOpen}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            {typeOpen ? (
                              <CaretDown size={14} weight="bold" className="shrink-0 text-[var(--p-color-brand-400)]" />
                            ) : (
                              <CaretRight size={14} weight="bold" className="shrink-0 text-[var(--p-color-brand-400)]" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                {type.nome}
                              </span>
                              <span className="type-caption text-slate-500">
                                {formatNumber(type.classes.length)} classe(s) · {formatNumber(type.semNatureza)} sem natureza
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-[var(--p-color-brand-500)]">
                            {formatNumber(type.itens)}
                          </span>
                        </button>

                        {typeOpen ? (
                          <div className="space-y-1 border-t border-slate-100 px-3 py-2">
                            {type.classes.map((row) => {
                              const classKey = `${group.key}:${type.key}:${row.codigo_classe}`;
                              const classOpen = openClasses.has(classKey);
                              const items = classItems[classKey] || [];
                              const classLoading = loadingClasses.has(classKey);
                              return (
                              <div
                                key={classKey}
                                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleClass(row, classKey)}
                                  className="flex w-full justify-between gap-3 text-left"
                                  aria-expanded={classOpen}
                                >
                                  <span className="flex min-w-0 gap-2">
                                    {classOpen ? (
                                      <CaretDown size={13} weight="bold" className="mt-0.5 shrink-0 text-[var(--p-color-brand-400)]" />
                                    ) : (
                                      <CaretRight size={13} weight="bold" className="mt-0.5 shrink-0 text-[var(--p-color-brand-400)]" />
                                    )}
                                    <span className="min-w-0">
                                      <span className="block text-xs font-semibold text-slate-700 line-clamp-2">
                                        {row.nome_classe}
                                      </span>
                                      <span className="mt-1 block type-caption text-slate-500">
                                        Grupo {row.codigo_grupo} · Classe {row.codigo_classe} · {formatNumber(row.naturezas_distintas)} naturezas · {formatNumber(row.itens_sem_natureza)} sem natureza
                                      </span>
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-xs font-semibold text-[var(--p-color-brand-500)]">
                                    {formatNumber(row.itens)}
                                  </span>
                                </button>

                                {classOpen ? (
                                  <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                                    {classLoading ? (
                                      <p className="px-2 py-2 text-xs text-slate-500">Carregando itens e-Fisco...</p>
                                    ) : items.length === 0 ? (
                                      <p className="px-2 py-2 text-xs text-slate-500">Nenhum item carregado nesta classe.</p>
                                    ) : (
                                      items.map((item) => (
                                        <div
                                          key={item.id}
                                          className="rounded-md border border-slate-100 bg-white px-3 py-2"
                                        >
                                          <div className="flex justify-between gap-3">
                                            <p className="text-xs font-semibold text-[var(--p-color-brand-500)]">
                                              {item.codigo_efisco}
                                            </p>
                                            <span className="shrink-0 type-kicker font-semibold uppercase tracking-wide text-slate-500">
                                              {formatNumber(item.natureza_count)} nat.
                                            </span>
                                          </div>
                                          <p className="mt-1 type-caption text-slate-600 line-clamp-2">
                                            {item.descricao}
                                          </p>
                                          <p className="mt-1 type-kicker text-slate-400">
                                            {item.gnd_preferencial || "Sem GND"} · {item.codigo_natureza_preferencial || "Sem natureza"}
                                            {item.has_missing_natureza ? " · pendente natureza" : ""}
                                            {item.has_mixed_expense_classes ? " · misto" : ""}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function QueueTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: QueueItem[];
  kind: "missing" | "mixed";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--p-color-brand-500)]">{title}</h2>
          <p className="text-xs text-slate-500">
            {formatNumber(rows.length)} registros exibidos na fila operacional.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(`efisco-${kind}.csv`, rows)}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-[var(--p-color-brand-500)] hover:bg-slate-50"
        >
          <DownloadSimple size={16} />
          CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 type-kicker uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Classe</th>
              <th className="px-4 py-3">Naturezas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={`${kind}-${row.efisco_item_id}`}>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-[var(--p-color-brand-500)]">
                  {row.codigo_efisco}
                </td>
                <td className="max-w-xl px-4 py-3 text-xs text-slate-600">
                  <p className="line-clamp-2">{row.descricao}</p>
                  <p className="mt-1 type-kicker uppercase tracking-wider text-slate-400">
                    {row.tipo_objeto} · {row.nome_grupo}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {row.nome_classe || row.nome_material_servico}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {kind === "mixed"
                    ? `${formatNumber(row.natureza_count)} naturezas · ${(row.gnds || []).join(", ")}`
                    : "Natureza ausente"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function EfiscoGovernancePage() {
  const [payload, setPayload] = useState<GovernancePayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/efisco-governance?limit=120");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Falha ao carregar governança.");
      setPayload(data);
    } catch (error: any) {
      toast.error(error?.message || "Falha ao carregar governança e-Fisco.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const topGnds = useMemo(
    () => (payload?.gndDistribution || []).slice(0, 10),
    [payload],
  );
  const total = payload?.quality?.total_itens || 0;

  return (
    <main className="min-h-screen bg-[var(--p-color-bg-muted)] p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="type-kicker font-semibold uppercase tracking-[0.22em] text-[var(--p-color-brand-400)]">
            Engenharia de dados
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
            Governança do cadastro e-Fisco
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            Qualidade cadastral, distribuição fiscal, filas de saneamento e sinais
            de planejamento gerados a partir do DBAtualizado.csv.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--p-color-brand-500)] px-5 text-xs font-semibold uppercase tracking-widest text-white hover:bg-[var(--p-color-brand-700)] disabled:opacity-60"
        >
          <ArrowClockwise size={16} className={loading ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      <EfiscoIntelligenceNav />
      <EfiscoIntelligenceSummary />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Itens"
          value={formatNumber(total)}
          detail="Itens únicos normalizados no cadastro."
          tone="good"
        />
        <MetricCard
          label="Sem natureza"
          value={formatNumber(payload?.quality?.itens_com_natureza_ausente)}
          detail={formatPercent(payload?.quality?.itens_com_natureza_ausente, total)}
          tone="critical"
        />
        <MetricCard
          label="Múltiplas naturezas"
          value={formatNumber(payload?.quality?.itens_multiplas_naturezas)}
          detail={formatPercent(payload?.quality?.itens_multiplas_naturezas, total)}
          tone="warning"
        />
        <MetricCard
          label="Custeio + capital"
          value={formatNumber(payload?.quality?.itens_misturam_custeio_investimento)}
          detail={formatPercent(payload?.quality?.itens_misturam_custeio_investimento, total)}
          tone="critical"
        />
        <MetricCard
          label="Descrições longas"
          value={formatNumber(payload?.quality?.itens_nome_muito_longo)}
          detail="Itens que exigem revisão de descrição."
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Scales size={18} className="text-[var(--p-color-brand-400)]" />
            <h2 className="font-semibold text-[var(--p-color-brand-500)]">Distribuição por GND</h2>
          </div>
          <div className="space-y-3">
            {topGnds.map((row) => {
              const pct = Number(row.itens_distintos || 0) / Math.max(total, 1);
              return (
                <div key={`${row.gnd}-${row.classe_despesa}`}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {row.gnd} · {row.classe_despesa}
                    </span>
                    <span className="text-slate-500">
                      {formatNumber(row.itens_distintos)} itens
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[var(--p-color-brand-400)]"
                      style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-[var(--p-color-brand-400)]" />
              <h2 className="font-semibold text-[var(--p-color-brand-500)]">Maiores famílias do catálogo</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 type-kicker font-semibold uppercase tracking-wide text-slate-500">
              Árvore
            </span>
          </div>
          <CatalogTaxonomyTree rows={payload?.taxonomy || []} />
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks size={18} className="text-[var(--p-color-brand-400)]" />
          <h2 className="font-semibold text-[var(--p-color-brand-500)]">Sinais para planejamento</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(payload?.planningSignals || []).slice(0, 12).map((row) => (
            <div key={row.codigo_item} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start gap-2">
                <WarningCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-700 line-clamp-2">
                    {row.codigo_item} · {row.nome_item}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.sinal_planejamento} · {formatNumber(row.natureza_count)} naturezas
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6">
        <QueueTable
          title="Fila de saneamento: sem natureza"
          rows={payload?.queues.missingNatureza || []}
          kind="missing"
        />
        <QueueTable
          title="Fila de decisão: custeio e capital no mesmo item"
          rows={payload?.queues.mixedExpenseClasses || []}
          kind="mixed"
        />
      </div>
    </main>
  );
}
