"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileCsv,
  Selection,
  Lightning,
  ArrowsClockwise,
  DownloadSimple,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadWorkbookFromSheets } from "@/lib/export-excel";
import {
  buildCsv,
  buildDfdItemDetailRows,
  buildDfdSheetRows,
  buildItemSheetRows,
  collectExportHeaders,
  FULL_EXPORT_PREFERRED_HEADERS,
  protectSpreadsheetCell,
  summarizeByKey,
  type DfdItemReportRow,
  type DfdReportRow,
} from "@/lib/admin-reports";

type Consolidado = {
  codigo_tce: string;
  descricao: string;
  quantidade_total: number;
  valor_total_estimado: number;
  total_dfds: number;
  total_solicitantes: number;
  destaque_pareto: boolean;
  gnd?: string | null;
};

type ReportLookupRow = Record<string, any> & {
  id?: string;
  nome?: string | null;
  sigla?: string | null;
  full_name?: string | null;
  email?: string | null;
};

function toMap(rows: ReportLookupRow[] | null | undefined) {
  return new Map((rows || []).filter((row) => row.id).map((row) => [String(row.id), row]));
}

function pickUnitName(unit: ReportLookupRow | undefined) {
  return String(unit?.nome || unit?.name || "");
}

async function fetchCatalogRowsForItems(items: DfdItemReportRow[]) {
  const codes = Array.from(
    new Set(
      items
        .flatMap((item) => [item.codigo_item_efisco, item.codigo_tce])
        .map((code) => String(code || "").trim())
        .filter(Boolean),
    ),
  );
  const rows: ReportLookupRow[] = [];
  const chunkSize = 400;

  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    const { data, error } = await supabase.from("catalogo").select("*").in("codigo_efisco", chunk);
    if (error) throw error;
    rows.push(...((data || []) as ReportLookupRow[]));
  }

  return rows;
}

function buildConsolidadoFromItems(items: DfdItemReportRow[]) {
  const map = new Map<string, Consolidado>();
  for (const item of items) {
    const key = String(item.codigo_item_efisco || item.codigo_tce || item.descricao || "sem-codigo");
    const current =
      map.get(key) ||
      ({
        codigo_tce: String(item.codigo_tce || item.codigo_item_efisco || ""),
        descricao: String(item.descricao || "Item sem descrição"),
        quantidade_total: 0,
        valor_total_estimado: 0,
        total_dfds: 0,
        total_solicitantes: 0,
        destaque_pareto: false,
        gnd: item.gnd || null,
      } satisfies Consolidado);
    current.quantidade_total += Number(item.quantidade || 0);
    current.valor_total_estimado +=
      Number(item.quantidade || 0) * Number(item.valor_unitario_estimado || 0);
    current.total_dfds += 1;
    map.set(key, current);
  }
  return Array.from(map.values()).sort(
    (a, b) => Number(b.valor_total_estimado || 0) - Number(a.valor_total_estimado || 0),
  );
}

export default function ExportacaoPage() {
  const [loading, setLoading] = useState(true);
  const [consolidado, setConsolidado] = useState<Consolidado[]>([]);
  const [dfds, setDfds] = useState<DfdReportRow[]>([]);
  const [dfdItems, setDfdItems] = useState<DfdItemReportRow[]>([]);
  const [lookupSheets, setLookupSheets] = useState<Record<string, ReportLookupRow[]>>({});
  const [kpis, setKpis] = useState<any>(null);
  const [pendingEmailAlerts, setPendingEmailAlerts] = useState(0);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setReportNotice(null);
    try {
      const [
        kpiRes,
        consolidadoRes,
        queueCountRes,
        dfdsRes,
        itemsRes,
        campiRes,
        departamentosRes,
        laboratoriosRes,
        profilesRes,
        userUnitsRes,
        collectiveRes,
        emailQueueRes,
      ] = await Promise.all([
        supabase.from("vw_admin_kpis").select("*").single(),
        supabase
          .from("vw_consolidacao_pca")
          .select("*")
          .order("valor_total_estimado", { ascending: false }),
        supabase
          .from("email_alert_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase.from("dfds").select("*").order("created_at", { ascending: false }),
        supabase.from("dfd_items").select("*"),
        supabase.from("campi").select("*"),
        supabase.from("departamentos").select("*"),
        supabase.from("laboratorios").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("user_units").select("*"),
        supabase.from("dfd_collective_contributions").select("*"),
        supabase.from("email_alert_queue").select("*"),
      ]);

      const notices: string[] = [];
      if (kpiRes.error) notices.push("KPIs administrativos indisponíveis.");
      if (queueCountRes.error) notices.push("Fila de e-mail indisponível.");
      if (campiRes.error) notices.push("Cadastro de campi indisponível para enriquecer a exportação.");
      if (departamentosRes.error) notices.push("Departamentos indisponíveis para enriquecer a exportação.");
      if (laboratoriosRes.error) notices.push("Laboratórios indisponíveis para enriquecer a exportação.");
      if (profilesRes.error) notices.push("Perfis indisponíveis para enriquecer solicitantes.");
      if (userUnitsRes.error) notices.push("Vínculos de usuários indisponíveis para a exportação.");
      if (collectiveRes.error) notices.push("Contribuições coletivas indisponíveis para a exportação.");
      if (emailQueueRes.error) notices.push("Detalhes da fila de e-mail indisponíveis para a exportação.");
      if (dfdsRes.error) throw dfdsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const itemRows = (itemsRes.data || []) as DfdItemReportRow[];
      const campiRows = (campiRes.error ? [] : campiRes.data || []) as ReportLookupRow[];
      const departamentoRows = (departamentosRes.error ? [] : departamentosRes.data || []) as ReportLookupRow[];
      const laboratorioRows = (laboratoriosRes.error ? [] : laboratoriosRes.data || []) as ReportLookupRow[];
      const profileRows = (profilesRes.error ? [] : profilesRes.data || []) as ReportLookupRow[];
      const userUnitRows = (userUnitsRes.error ? [] : userUnitsRes.data || []) as ReportLookupRow[];
      const collectiveRows = (collectiveRes.error ? [] : collectiveRes.data || []) as ReportLookupRow[];
      const emailQueueRows = (emailQueueRes.error ? [] : emailQueueRes.data || []) as ReportLookupRow[];
      let catalogRows: ReportLookupRow[] = [];
      try {
        catalogRows = await fetchCatalogRowsForItems(itemRows);
      } catch {
        notices.push("Catálogo e-Fisco indisponível para enriquecer os itens.");
      }
      const campiById = toMap(campiRows);
      const departamentosById = toMap(departamentoRows);
      const laboratoriosById = toMap(laboratorioRows);
      const profilesById = toMap(profileRows);
      const dfdRows = ((dfdsRes.data || []) as DfdReportRow[]).map((dfd) => {
        const campus = campiById.get(String(dfd.campus_id || ""));
        const isLaboratorio = String(dfd.tipo_unidade || "").toLowerCase().includes("laboratorio");
        const unidade = isLaboratorio
          ? laboratoriosById.get(String(dfd.unidade_id || ""))
          : departamentosById.get(String(dfd.unidade_id || ""));
        const analysisIsLaboratorio = String(dfd.analysis_tipo_unidade || "")
          .toLowerCase()
          .includes("laboratorio");
        const analysisUnidade = analysisIsLaboratorio
          ? laboratoriosById.get(String(dfd.analysis_unidade_id || ""))
          : departamentosById.get(String(dfd.analysis_unidade_id || ""));
        const solicitante = profilesById.get(String(dfd.solicitante_id || ""));

        return {
          ...dfd,
          campus_nome_relatorio: campus?.nome || dfd.campus || "",
          campus_sigla_relatorio: campus?.sigla || "",
          unidade_nome_relatorio: pickUnitName(unidade),
          analysis_unidade_nome_relatorio: pickUnitName(analysisUnidade),
          solicitante_nome_relatorio: solicitante?.full_name || "",
          solicitante_email_relatorio: solicitante?.email || "",
        };
      });

      setKpis(kpiRes.error ? null : kpiRes.data || null);
      setDfds(dfdRows);
      setDfdItems(itemRows);
      setLookupSheets({
        Campi: campiRows,
        Departamentos: departamentoRows,
        Laboratorios: laboratorioRows,
        Perfis: profileRows,
        Usuarios_Unidades: userUnitRows,
        Contribuicoes_Coletivas: collectiveRows,
        Fila_Email: emailQueueRows,
        Catalogo_Itens: catalogRows,
      });
      setConsolidado(
        consolidadoRes.error
          ? buildConsolidadoFromItems(itemRows)
          : ((consolidadoRes.data || []) as Consolidado[]),
      );
      if (consolidadoRes.error) {
        notices.push("View consolidada indisponível; relatório montado a partir dos itens das DFDs.");
      }
      setPendingEmailAlerts(queueCountRes.error ? 0 : queueCountRes.count || 0);
      setReportNotice(notices.length > 0 ? notices.join(" ") : null);
    } catch (error: any) {
      toast.error("Erro ao carregar dados de exportação: " + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalFinanceiro = useMemo(
    () =>
      consolidado.reduce(
        (acc, item) => acc + Number(item.valor_total_estimado || 0),
        0,
      ),
    [consolidado],
  );

  const downloadCsv = () => {
    if (dfds.length === 0 && dfdItems.length === 0) {
      toast.info("Não há DFDs ou itens para exportar.");
      return;
    }

    const fullRows = buildDfdItemDetailRows(dfdItems, dfds);
    const headers = collectExportHeaders(fullRows, FULL_EXPORT_PREFERRED_HEADERS);
    const csv = buildCsv(fullRows, headers);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pca_dados_completos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV completo exportado com DFDs e itens.");
  };

  const downloadXlsx = async () => {
    if (dfds.length === 0 && dfdItems.length === 0 && consolidado.length === 0) {
      toast.info("Não há dados para exportar.");
      return;
    }

    const consolidatedRows = consolidado.map((item) => ({
      codigo_tce: item.codigo_tce,
      descricao: protectSpreadsheetCell(item.descricao),
      gnd: item.gnd || "",
      quantidade_total: Number(item.quantidade_total || 0),
      valor_total_estimado: Number(item.valor_total_estimado || 0),
      total_dfds: Number(item.total_dfds || 0),
      total_solicitantes: Number(item.total_solicitantes || 0),
      destaque_pareto: item.destaque_pareto ? "SIM" : "NAO",
    }));
    const dfdRows = buildDfdSheetRows(dfds) as Array<Record<string, any>>;
    const itemRows = buildItemSheetRows(dfdItems, dfds) as Array<Record<string, any>>;
    const fullRows = buildDfdItemDetailRows(dfdItems, dfds) as Array<Record<string, any>>;
    const resumoGnd = summarizeByKey(
      itemRows,
      (row) => String(row.gnd || "Não informado"),
      (row) => Number(row.valor_total_estimado_relatorio || 0),
    );
    const resumoStatus = summarizeByKey(
      dfdRows,
      (row) => String(row.status || "Não informado"),
      (row) => Number(row.valor_total_estimado_relatorio || row.valor_total_estimado || 0),
    );
    const resumoUnidade = summarizeByKey(
      dfdRows,
      (row) => String(row.unidade_relatorio || row.campus_relatorio || "Não informado"),
      (row) => Number(row.valor_total_estimado_relatorio || row.valor_total_estimado || 0),
    );
    const metadados = [
      { chave: "gerado_em", valor: new Date().toISOString() },
      { chave: "total_dfds", valor: dfds.length },
      { chave: "total_itens_dfd", valor: dfdItems.length },
      { chave: "total_itens_consolidados", valor: consolidado.length },
      { chave: "observacao_csv", valor: "O CSV usa a aba DFD_Item_Linha: uma linha por item, com dados da DFD e do item; DFDs sem item aparecem como dfd_sem_item." },
      { chave: "observacao_xlsx", valor: "DFDs_Completas, Itens_Completos, DFD_Item_Linha e cadastros auxiliares incluem todas as colunas retornadas pelo banco, acrescidas de campos de relatório." },
    ];

    try {
      await downloadWorkbookFromSheets(
        [
          { name: "Consolidado", rows: consolidatedRows },
          { name: "DFDs_Completas", rows: dfdRows },
          { name: "Itens_Completos", rows: itemRows },
          { name: "DFD_Item_Linha", rows: fullRows },
          { name: "Resumo_GND", rows: resumoGnd },
          { name: "Resumo_Status", rows: resumoStatus },
          { name: "Resumo_Unidades", rows: resumoUnidade },
          { name: "Metadados", rows: metadados },
          ...Object.entries(lookupSheets)
            .filter(([, rows]) => rows.length > 0)
            .map(([name, rows]) => ({ name, rows })),
        ],
        `pca_consolidacao_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      toast.success("XLSX exportado com sucesso.");
    } catch (error: any) {
      toast.error(error?.message || "Falha ao exportar XLSX.");
    }
  };

  return (
    <div className="p-8 space-y-8 pb-20 min-h-screen bg-[#F3F2F1]">
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
        <div className="rounded-[36px] bg-white p-8 text-[#1E2430] shadow-sm border border-[#D2D0CE]">
          <div className="h-1 w-28 rounded-full bg-[#164073] mb-4" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 bg-[#E8EDF2] px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] text-[#164073]">
                <Selection size={14} weight="bold" />
                Exportação PCA
              </span>
              <h1 className="font-display text-4xl font-semibold tracking-tight leading-none uppercase">
                Relatórios e-Fisco
              </h1>
              <p className="text-[#5B6675] text-sm font-medium">
                XLSX completo com DFDs, itens, resumos e dados auxiliares para conferência.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={downloadCsv}
                className="h-12 rounded-2xl bg-[#164073] text-white hover:bg-upe-blue-deep font-semibold uppercase tracking-widest text-xs"
              >
                <DownloadSimple size={18} className="mr-2" weight="bold" />
                CSV completo
              </Button>
              <Button
                onClick={downloadXlsx}
                className="h-12 rounded-2xl bg-upe-red-upe text-white hover:bg-upe-red-dark font-semibold uppercase tracking-widest text-xs"
              >
                <FileCsv size={18} className="mr-2" weight="bold" />
                XLSX completo
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-[36px] bg-white border border-[#D2D0CE] p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40">
              Saúde Operacional
            </p>
            <button
              onClick={fetchData}
              className="w-9 h-9 rounded-xl bg-[#E8EDF2] text-[#2D5D94] hover:bg-[#DCEAF0] flex items-center justify-center"
            >
              <ArrowsClockwise size={18} weight="bold" />
            </button>
          </div>

          {loading ? (
            <Skeleton className="h-24 rounded-2xl" />
          ) : (
            <div className="space-y-3">
              <Metric label="DFDs em triagem" value={kpis?.dfds_triagem || 0} />
              <Metric
                label="DFDs aprovadas"
                value={kpis?.dfds_aprovadas || 0}
              />
              <Metric
                label="Alertas e-mail pendentes"
                value={pendingEmailAlerts}
              />
            </div>
          )}
        </div>
      </div>

      {reportNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {reportNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white border border-[#D2D0CE] rounded-[28px] p-6">
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
            Valor homologado
          </p>
          <p className="mt-2 text-3xl font-display font-semibold text-[#164073]">
            {loading
              ? "..."
              : Number(kpis?.valor_homologado || totalFinanceiro).toLocaleString(
                  "pt-BR",
                  { style: "currency", currency: "BRL" },
                )}
          </p>
        </div>
        <div className="bg-white border border-[#D2D0CE] rounded-[28px] p-6">
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
            Itens consolidados
          </p>
          <p className="mt-2 text-3xl font-display font-semibold text-[#164073]">
            {loading ? "..." : consolidado.length}
          </p>
        </div>
        <div className="bg-white border border-[#D2D0CE] rounded-[28px] p-6">
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
            Itens prioritários
          </p>
          <p className="mt-2 text-3xl font-display font-semibold text-[#164073]">
            {loading ? "..." : consolidado.filter((x) => x.destaque_pareto).length}
          </p>
        </div>
        <div className="bg-white border border-[#D2D0CE] rounded-[28px] p-6">
          <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
            DFDs no relatório
          </p>
          <p className="mt-2 text-3xl font-display font-semibold text-[#164073]">
            {loading ? "..." : dfds.length}
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#D2D0CE] rounded-[32px] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[#164073] uppercase tracking-tight">
            Prévia do Layout de Exportação
          </h2>
          <span className="text-[10px] uppercase tracking-widest text-black/35 font-semibold">
            {consolidado.length} linhas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F4F7FA]">
                <th className="px-6 py-3 text-left text-[10px] uppercase tracking-widest text-black/40">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-[10px] uppercase tracking-widest text-black/40">
                  Descrição
                </th>
                <th className="px-6 py-3 text-right text-[10px] uppercase tracking-widest text-black/40">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-right text-[10px] uppercase tracking-widest text-black/40">
                  Valor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="p-4">
                      <Skeleton className="h-10 rounded-xl" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                consolidado.slice(0, 20).map((item) => (
                  <tr key={item.codigo_tce} className="hover:bg-[#F3F2F1]">
                    <td className="px-6 py-3 font-mono text-xs text-[#2D5D94]">
                      {item.codigo_tce}
                    </td>
                    <td className="px-6 py-3 font-semibold text-[#1C1B1F]">
                      {item.descricao}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-black/60">
                      {item.quantidade_total}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-[#164073]">
                      {Number(item.valor_total_estimado || 0).toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL" },
                      )}
                    </td>
                  </tr>
                ))}
              {!loading && consolidado.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-black/40">
                      <Lightning size={28} weight="duotone" />
                      <p className="text-sm font-semibold uppercase tracking-widest">
                        Sem dados consolidados para exportação
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-900/90 font-medium">
        O XLSX possui abas separadas para Consolidado, DFDs, Itens, Resumo_GND,
        Resumo_Status, Resumo_Unidades, Metadados, DFD_Item_Linha e cadastros auxiliares disponíveis.
        O CSV usa uma linha por item com todos os dados da DFD e do item; DFDs sem item também entram.
        Células iniciadas por caracteres de fórmula são protegidas automaticamente.
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#F4F7FA] border border-black/5 rounded-xl px-3 py-2 flex justify-between items-center">
      <span className="text-[10px] uppercase tracking-wider text-black/45 font-semibold">
        {label}
      </span>
      <span className="font-display font-semibold text-[#164073]">{value}</span>
    </div>
  );
}
