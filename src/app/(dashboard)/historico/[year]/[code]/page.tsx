"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Files, Hash, CurrencyCircleDollar } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { ProductSkeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { withLegacyHistoryViewFallback } from "@/lib/legacy-history";

interface LegacyDemandHeader {
  legacy_year: number;
  demand_code: string;
  campus: string | null;
  status: string | null;
  object: string | null;
  total_estimated: number | null;
  items_count: number | null;
}

export default function HistoricoDetailByYearPage() {
  const params = useParams<{ year: string; code: string }>();
  const demandCode = decodeURIComponent(params?.code || "");
  const demandYear = Number(params?.year || 0);

  const [loading, setLoading] = useState(true);
  const [demand, setDemand] = useState<LegacyDemandHeader | null>(null);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!demandCode || !Number.isFinite(demandYear) || demandYear <= 0) return;
      setLoading(true);
      try {
        const { data: demandRows, error: demandError } =
          await withLegacyHistoryViewFallback<LegacyDemandHeader>(
            async (viewName) =>
              await supabase
                .from(viewName)
                .select("*")
                .eq("demand_code", demandCode)
                .eq("legacy_year", demandYear)
                .limit(1),
          );
        if (demandError) throw demandError;

        const selected = (demandRows || [])[0] as LegacyDemandHeader | undefined;
        if (!selected) {
          setDemand(null);
          setItems([]);
          return;
        }
        setDemand(selected);

        const { data: itemRows, error: itemError } = await supabase
          .from("legacy_pa_itens")
          .select(
            "id,efisco_code,efisco_description,quantity_numeric,quantity_text,unit,item_price,local_uso,item_justification",
          )
          .eq("legacy_year", selected.legacy_year)
          .eq("demand_code", selected.demand_code)
          .order("efisco_code", { ascending: true });
        if (itemError) throw itemError;
        setItems(itemRows || []);
      } catch (error: any) {
        toast.error("Erro ao carregar detalhe legado: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [demandCode, demandYear]);

  const totalItens = useMemo(
    () =>
      items.reduce((acc, item) => {
        const qty = Number(item.quantity_numeric || 0);
        const unit = Number(item.item_price || 0);
        return acc + qty * unit;
      }, 0),
    [items],
  );

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {[...Array(6)].map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!demand) {
    return (
      <div className="p-8 space-y-6">
        <Link
          href="/historico"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#D2D0CE] text-sm font-semibold"
        >
          <ArrowLeft size={18} weight="bold" />
          Voltar ao Histórico
        </Link>
        <div className="bg-white rounded-3xl p-10 border border-[#D2D0CE] text-center">
          <h2 className="text-xl font-semibold text-black/50 uppercase tracking-wider">
            Demanda não encontrada
          </h2>
          <p className="text-sm text-black/40 mt-2">
            Você não possui acesso a essa demanda legada ou ela não existe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <Link
        href="/historico"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#D2D0CE] text-sm font-semibold hover:bg-[#F3F2F1]"
      >
        <ArrowLeft size={18} weight="bold" />
        Voltar ao Histórico
      </Link>

      <div className="bg-white rounded-[32px] border border-[#D2D0CE] p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs font-bold text-[#2D5D94]/50">
            {demand.demand_code}
          </span>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold uppercase tracking-widest">
            {demand.status || "Em pactuação"}
          </span>
          <span className="px-3 py-1 bg-slate-50 text-slate-700 rounded-full text-[10px] font-semibold uppercase tracking-widest">
            Ano {demand.legacy_year}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1C1B1F]">
          {demand.object || "Demanda sem descrição"}
        </h1>
        <div className="flex flex-wrap gap-6 text-sm text-black/60 font-medium">
          <span className="inline-flex items-center gap-2">
            <Files size={18} weight="bold" />
            {demand.items_count || items.length} itens
          </span>
          <span className="inline-flex items-center gap-2">
            <CurrencyCircleDollar size={18} weight="bold" />
            {(demand.total_estimated || totalItens || 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-[#D2D0CE] overflow-hidden">
        <div className="px-8 py-5 border-b border-black/5">
          <h2 className="text-lg font-semibold uppercase tracking-tight text-[#1C1B1F]">
            Itens da Demanda
          </h2>
        </div>
        <div className="divide-y divide-black/5">
          {items.map((item) => (
            <div key={item.id} className="p-6 md:p-8 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#E8EDF2] text-[#2D5D94]">
                  <Hash size={12} weight="bold" />
                  {item.efisco_code || "Sem código"}
                </span>
              </div>
              <p className="font-semibold text-[#1C1B1F]">
                {item.efisco_description || "Descrição não informada"}
              </p>
              <div className="text-sm text-black/60 flex flex-wrap gap-6">
                <span>
                  Quantidade: {item.quantity_numeric || item.quantity_text || 0}{" "}
                  {item.unit || ""}
                </span>
                <span>
                  Preço:{" "}
                  {Number(item.item_price || 0).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
                <span>Local: {item.local_uso || "Não informado"}</span>
              </div>
              {item.item_justification && (
                <p className="text-sm text-black/50 bg-slate-50 rounded-xl p-3 border border-[#D2D0CE]">
                  {item.item_justification}
                </p>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <div className="p-10 text-center text-black/40 font-semibold uppercase tracking-widest">
              Nenhum item disponível para esta demanda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
