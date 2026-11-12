"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClockCounterClockwise } from "@/components/icons/phosphor/exports/ClockCounterClockwise";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Calendar } from "@/components/icons/phosphor/exports/Calendar";
import { CurrencyCircleDollar } from "@/components/icons/phosphor/exports/CurrencyCircleDollar";
import { ListNumbers } from "@/components/icons/phosphor/exports/ListNumbers";
import { ArrowUUpLeft } from "@/components/icons/phosphor/exports/ArrowUUpLeft";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { Info } from "@/components/icons/phosphor/exports/Info";
import { X } from "@/components/icons/phosphor/exports/X";
import { Hash } from "@/components/icons/phosphor/exports/Hash";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { ProductSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { withLegacyHistoryViewFallback } from "@/lib/legacy-history";
import { CatalogDescriptionDialog } from "@/components/catalog/CatalogDescriptionDialog";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LegacyDemand {
  legacy_year: number;
  demand_code: string;
  campus: string | null;
  status: string | null;
  object: string | null;
  total_estimated: number | null;
  items_count: number | null;
}

interface LegacyItem {
  id: string;
  efisco_code: string | null;
  efisco_description: string | null;
  quantity_numeric: number | null;
  quantity_text: string | null;
  unit: string | null;
  item_price: number | null;
}

export default function HistoricoPage() {
  const [selectedYear, setSelectedYear] = useState<number | "todos">("todos");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<LegacyDemand[]>([]);

  const [selectedDemand, setSelectedDemand] = useState<LegacyDemand | null>(null);
  const [selectedItems, setSelectedItems] = useState<LegacyItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    const fetchLegacy = async () => {
      setLoading(true);
      try {
        const { data, error } = await withLegacyHistoryViewFallback<LegacyDemand>(
          async (viewName) =>
            await supabase
              .from(viewName)
              .select(
                "legacy_year,demand_code,campus,status,object,total_estimated,items_count",
              )
              .order("legacy_year", { ascending: false })
              .order("demand_code", { ascending: false }),
        );

        if (error) throw error;
        setRecords((data || []) as LegacyDemand[]);
      } catch (error: any) {
        toast.error("Erro ao carregar histórico legado: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLegacy();
  }, []);

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          records
            .map((item) => item.legacy_year)
            .filter((year): year is number => Number.isFinite(year)),
        ),
      ).sort((a, b) => b - a),
    [records],
  );

  const filteredData = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return records.filter((item) => {
      const matchesYear =
        selectedYear === "todos" || item.legacy_year === selectedYear;
      if (!normalizedSearch) return matchesYear;

      const text = `${item.object || ""} ${item.demand_code} ${item.campus || ""}`.toLowerCase();
      return matchesYear && text.includes(normalizedSearch);
    });
  }, [records, search, selectedYear]);

  const openDetailSidebar = async (demand: LegacyDemand) => {
    setSelectedDemand(demand);
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("legacy_pa_itens")
        .select(
          "id,efisco_code,efisco_description,quantity_numeric,quantity_text,unit,item_price",
        )
        .eq("legacy_year", demand.legacy_year)
        .eq("demand_code", demand.demand_code)
        .order("efisco_code", { ascending: true });

      if (error) throw error;
      setSelectedItems((data || []) as LegacyItem[]);
    } catch (error: any) {
      toast.error("Erro ao carregar itens: " + error.message);
      setSelectedItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <div className="p-8 space-y-10 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-semibold text-[var(--p-color-fg-strong)] tracking-tighter uppercase">
            Histórico de Demandas
          </h1>
          <p className="text-[var(--p-color-fg-muted)] text-sm font-medium flex items-center gap-2">
            <ClockCounterClockwise
              size={18}
              weight="bold"
              className="text-[var(--p-color-brand-400)]"
            />
            Consulta de demandas legadas para referência de planejamento
          </p>
          <p className="text-[var(--p-color-fg-subtle)] text-xs font-semibold uppercase tracking-[0.12em]">
            Também disponível em Minhas DFDs {">"} Legadas
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-[var(--p-color-border)] shadow-sm space-y-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedYear("todos")}
            className={cn(
              "px-6 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-widest transition-all",
              selectedYear === "todos"
                ? "bg-[var(--p-color-fg-strong)] text-white shadow-lg"
                : "bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-400)] hover:bg-[var(--p-color-info-border)]",
            )}
          >
            Todos os Anos
          </button>
          {years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={cn(
                "px-8 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-widest transition-all",
                selectedYear === year
                  ? "bg-[var(--p-color-brand-400)] text-white shadow-lg"
                  : "bg-white border border-[var(--p-color-border)] text-[var(--p-color-fg-muted)] hover:border-[var(--p-color-brand-400)]",
              )}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="relative group">
          <MagnifyingGlass
            className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--p-color-brand-400)]/40 group-focus-within:text-[var(--p-color-brand-400)] transition-colors"
            size={22}
            weight="bold"
          />
          <input
            type="text"
            aria-label="Buscar no histórico por objeto, campus ou código"
            placeholder="Pesquise por objeto, campus ou código da demanda..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-14 pr-6 py-4 rounded-2xl bg-[var(--p-color-bg-muted)] border-none focus:ring-2 focus:ring-[var(--p-color-info-border)] transition-all font-medium"
          />
        </div>
      </div>

      <div
        className={cn(
          "grid gap-6 items-start",
          selectedDemand ? "xl:grid-cols-[380px_1fr]" : "grid-cols-1",
        )}
      >
        <AnimatePresence initial={false}>
          {selectedDemand && (
            <motion.aside
              key="historico-sidebar"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white border border-[var(--p-color-border)] rounded-[32px] p-6 xl:sticky xl:top-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="type-kicker font-semibold uppercase tracking-widest text-black/30">
                    Demanda Selecionada
                  </p>
                  <p className="font-mono text-xs font-bold text-[var(--p-color-brand-400)] mt-1">
                    {selectedDemand.demand_code}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDemand(null);
                    setSelectedItems([]);
                  }}
                  className="w-8 h-8 rounded-xl bg-black/5 hover:bg-black/10 flex items-center justify-center"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <h2 className="mt-4 text-lg font-display font-semibold text-[var(--p-color-fg-strong)] leading-tight">
                {selectedDemand.object || "Demanda sem descrição"}
              </h2>

              <div className="mt-5 space-y-2 text-sm text-black/60 font-medium">
                <p>
                  Campus:{" "}
                  <span className="font-semibold text-black/70">
                    {selectedDemand.campus || "Não informado"}
                  </span>
                </p>
                <p>
                  Status:{" "}
                  <span className="font-semibold text-black/70">
                    {selectedDemand.status || "Em pactuação"}
                  </span>
                </p>
                <p>
                  Valor estimado:{" "}
                  <span className="font-semibold text-black/70">
                    {(selectedDemand.total_estimated || 0).toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" },
                    )}
                  </span>
                </p>
              </div>

              <div className="mt-6 pt-6 border-t border-black/5">
                <p className="type-kicker font-semibold uppercase tracking-widest text-black/30 mb-3">
                  Itens Legados
                </p>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {loadingItems &&
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="h-16 rounded-xl bg-black/5 animate-pulse" />
                    ))}

                  {!loadingItems &&
                    selectedItems.map((item) => (
                      <div key={item.id} className="p-3 rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-muted)]">
                        <div className="flex items-center gap-2 type-kicker font-semibold text-[var(--p-color-brand-400)] uppercase tracking-wider">
                          <Hash size={12} weight="bold" />
                          {item.efisco_code || "Sem código"}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[var(--p-color-fg-strong)] line-clamp-2">
                          {item.efisco_description || "Descrição não informada"}
                        </p>
                        <CatalogDescriptionDialog title="Item do histórico" code={item.efisco_code || undefined} description={item.efisco_description || "Descrição não informada"} />
                        <p className="mt-1 type-caption text-black/50 font-medium">
                          {item.quantity_numeric || item.quantity_text || 0}{" "}
                          {item.unit || ""} •{" "}
                          {Number(item.item_price || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </p>
                      </div>
                    ))}

                  {!loadingItems && selectedItems.length === 0 && (
                    <p className="text-xs font-semibold uppercase tracking-wider text-black/30">
                      Nenhum item associado.
                    </p>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {loading &&
              [...Array(6)].map((_, index) => <ProductSkeleton key={index} />)}

            {!loading &&
              filteredData.map((item, index) => (
                <motion.div
                  layout
                  key={`${item.legacy_year}-${item.demand_code}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group bg-white border border-[var(--p-color-border)] rounded-[32px] p-8 flex flex-col md:flex-row gap-8 hover:shadow-xl hover:border-[var(--p-color-brand-400)]/20 transition-all relative overflow-hidden"
                >
                  <div className="flex flex-col items-center justify-center bg-[var(--p-color-surface-subtle)] w-24 h-24 rounded-2xl shrink-0 group-hover:bg-[var(--p-color-brand-400)] transition-colors duration-500">
                    <span className="type-kicker font-semibold uppercase text-[var(--p-color-brand-400)] group-hover:text-white/60 tracking-widest leading-none mb-1">
                      ANO
                    </span>
                    <span className="text-2xl font-display font-semibold text-[var(--p-color-brand-400)] group-hover:text-white leading-none">
                      {item.legacy_year}
                    </span>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="font-mono text-xs font-bold text-[var(--p-color-brand-400)]/40">
                        {item.demand_code}
                      </span>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full type-kicker font-semibold uppercase tracking-widest">
                        <Calendar size={14} weight="bold" />
                        {item.status || "Em pactuação"}
                      </div>
                    </div>

                    <h3 className="font-display font-semibold text-xl text-[var(--p-color-fg-strong)] tracking-tight leading-tight">
                      {item.object || "Demanda sem descrição"}
                    </h3>

                    <div className="flex flex-wrap gap-8 pt-4">
                      <div className="flex flex-col">
                        <span className="type-kicker uppercase font-semibold text-black/30 tracking-tighter flex items-center gap-1">
                          <CurrencyCircleDollar size={14} /> Valor Estimado
                        </span>
                        <span className="text-lg font-semibold text-[var(--p-color-fg-strong)]">
                          {(item.total_estimated || 0).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="type-kicker uppercase font-semibold text-black/30 tracking-tighter flex items-center gap-1">
                          <ListNumbers size={14} /> Qtd. Itens
                        </span>
                        <span className="text-lg font-semibold text-[var(--p-color-fg-strong)]">
                          {item.items_count || 0}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="type-kicker uppercase font-semibold text-black/30 tracking-tighter flex items-center gap-1">
                          <Info size={14} /> Campus
                        </span>
                        <span className="text-lg font-semibold text-[var(--p-color-fg-strong)]">
                          {item.campus || "Não informado"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col justify-end gap-3 pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-black/5 md:pl-8">
                    <button
                      onClick={() => openDetailSidebar(item)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-[var(--p-color-bg-muted)] text-[var(--p-color-fg-strong)] rounded-2xl font-semibold text-xs uppercase tracking-widest hover:bg-[var(--p-color-info-border)] transition-all"
                    >
                      <Files size={20} weight="bold" />
                      Ver Itens
                    </button>
                    <a href="/catalogo" className="flex-1 md:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-[var(--p-color-fg-strong)] text-white rounded-2xl font-semibold text-xs hover:bg-[var(--p-color-brand-400)] shadow-lg shadow-black/10 transition-all">
                      <ArrowUUpLeft size={20} weight="bold" />
                      Criar nova solicitação
                    </a>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>

          {!loading && filteredData.length === 0 && (
            <div role="status" className="py-12 text-center">
              <h3 className="font-display font-semibold text-xl text-[var(--p-color-fg)]">
                Nenhum registro antigo encontrado
              </h3>
              <p className="mt-2 text-sm text-[var(--p-color-fg-muted)]">{search || selectedYear !== "todos" ? "Ajuste a busca ou o ano selecionado para consultar o histórico." : "Ainda não há registros históricos disponíveis nesta visão."}</p>
              {(search || selectedYear !== "todos") && <button type="button" onClick={() => { setSearch(""); setSelectedYear("todos"); }} className="mt-4 min-h-10 rounded-xl border border-[var(--p-color-border)] px-4 text-sm font-semibold text-[var(--p-color-brand-500)]">Limpar busca e ano</button>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4 items-start">
        <Info size={24} weight="fill" className="text-amber-600 shrink-0" />
        <p className="text-xs font-medium text-amber-800 leading-relaxed uppercase tracking-tight">
          Os dados exibidos nesta tela são legados e servem apenas para
          referência de planejamento institucional.
        </p>
      </div>
    </div>
  );
}



