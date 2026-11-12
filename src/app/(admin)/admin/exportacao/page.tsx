"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileCsv } from "@/components/icons/phosphor/exports/FileCsv";
import { Selection } from "@/components/icons/phosphor/exports/Selection";
import { Lightning } from "@/components/icons/phosphor/exports/Lightning";
import { ArrowsClockwise } from "@/components/icons/phosphor/exports/ArrowsClockwise";
import { DownloadSimple } from "@/components/icons/phosphor/exports/DownloadSimple";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OperationalAccordion,
  OperationalChip,
  OperationalEmptyState,
  OperationalKpiCard,
  OperationalTimeline,
  SkeuoDocumentCard,
  SkeuoPaperStack,
} from "@/components/ui/operational";
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
import { MechanicalValue } from "@/components/ui/MechanicalValue";

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
    const { data, error } = await supabase
      .from("catalogo_efisco_v2")
      .select("*")
      .in("codigo_efisco", chunk);
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
        collectiveAuthorRes,
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
        supabase.from("dfd_collective_dfd_authors").select("*"),
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
      if (collectiveAuthorRes.error) notices.push("Autoria coletiva das DFDs indisponível para a exportação.");
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
      const collectiveAuthorRows = (collectiveAuthorRes.error
        ? []
        : collectiveAuthorRes.data || []) as ReportLookupRow[];
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
      const collectiveAuthorsByDfd = collectiveAuthorRows.reduce<Map<string, ReportLookupRow[]>>((map, row) => {
        const key = String(row.dfd_id || "").trim();
        if (!key) return map;
        const current = map.get(key) || [];
        current.push(row);
        map.set(key, current);
        return map;
      }, new Map());
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
        const collectiveAuthors = (collectiveAuthorsByDfd.get(String(dfd.id || "")) || [])
          .map((row) => {
            const profile = profilesById.get(String(row.contribution_user_id || ""));
            const authorName = String(
              row.author_name_snapshot ||
                profile?.full_name ||
                row.author_email_snapshot ||
                profile?.email ||
                row.contribution_user_id ||
                "",
            ).trim();
            if (!authorName) return null;
            return `${authorName} (qtd ${Number(row.quantidade_total || 0)}, R$ ${Number(
              row.valor_total_estimado || 0,
            ).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
          })
          .filter(Boolean)
          .join(" ; ");

        return {
          ...dfd,
          campus_nome_relatorio: campus?.nome || dfd.campus || "",
          campus_sigla_relatorio: campus?.sigla || "",
          unidade_nome_relatorio: pickUnitName(unidade),
          analysis_unidade_nome_relatorio: pickUnitName(analysisUnidade),
          solicitante_nome_relatorio: solicitante?.full_name || "",
          solicitante_email_relatorio: solicitante?.email || "",
          coautoria_coletiva_relatorio: collectiveAuthors,
        };
      });
      const dfdById = new Map(dfdRows.map((row) => [String(row.id), row]));
      const enrichedCollectiveRows = collectiveRows.map((row) => {
        const contributor = profilesById.get(String(row.user_id || ""));
        const linkedDfd = dfdById.get(String(row.consolidated_dfd_id || ""));
        return {
          ...row,
          contributor_nome_relatorio:
            contributor?.full_name || String(row.user_name || row.user_email || row.user_id || "").trim(),
          contributor_email_relatorio:
            contributor?.email || String(row.user_email || "").trim(),
          consolidated_dfd_numero_protocolo_relatorio: linkedDfd?.numero_protocolo || "",
          consolidated_dfd_objeto_relatorio: linkedDfd?.objeto_contratacao || "",
        };
      });
      const enrichedCollectiveAuthorRows = collectiveAuthorRows.map((row) => {
        const contributor = profilesById.get(String(row.contribution_user_id || ""));
        const linkedDfd = dfdById.get(String(row.dfd_id || ""));
        return {
          ...row,
          contributor_nome_relatorio:
            contributor?.full_name ||
            String(row.author_name_snapshot || row.author_email_snapshot || row.contribution_user_id || "").trim(),
          contributor_email_relatorio:
            contributor?.email || String(row.author_email_snapshot || "").trim(),
          consolidated_dfd_numero_protocolo_relatorio: linkedDfd?.numero_protocolo || "",
          consolidated_dfd_objeto_relatorio: linkedDfd?.objeto_contratacao || "",
          collective_origin_room_title_relatorio: linkedDfd?.collective_origin_room_title || "",
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
        Contribuicoes_Coletivas: enrichedCollectiveRows,
        Autoria_Coletiva_DFD: enrichedCollectiveAuthorRows,
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
    <div className="p-8 space-y-8 pb-20 min-h-screen bg-[var(--p-color-bg-muted)]">
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
        <div className="rounded-[36px] bg-white p-8 text-[var(--p-color-fg-strong)] shadow-sm border border-[var(--p-color-border)]">
          <div className="h-1 w-28 rounded-full bg-[var(--p-color-brand-500)] mb-4" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-3">
              <OperationalChip tone="action" icon={<Selection size={14} weight="bold" />} className="type-kicker uppercase tracking-[0.2em]">
                Exportação PCA
              </OperationalChip>
              <h1 className="font-display text-4xl font-semibold tracking-tight leading-none uppercase">
                Relatórios e-Fisco
              </h1>
              <p className="text-[var(--p-color-fg-muted)] text-sm font-medium">
                XLSX completo com DFDs, itens, resumos e dados auxiliares para conferência.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={downloadCsv}
                className="h-12 rounded-2xl bg-[var(--p-color-brand-500)] text-white hover:bg-upe-blue-deep font-semibold uppercase tracking-widest text-xs"
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
          <div className="mt-6">
            <SkeuoPaperStack
              title="Dossiê de exportação"
              subtitle={`${dfds.length} DFDs, ${dfdItems.length} itens e ${consolidado.length} linhas consolidadas.`}
              stamp={loading ? "Carregando" : "Pronto"}
              tone={loading ? "warning" : "success"}
            />
          </div>
        </div>

        <div className="rounded-[36px] bg-white border border-[var(--p-color-border)] p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="type-kicker font-semibold uppercase tracking-[0.2em] text-black/40">
              Saúde Operacional
            </p>
            <button
              onClick={fetchData}
              className="w-9 h-9 rounded-xl bg-[var(--p-color-surface-subtle)] text-[var(--p-color-brand-400)] hover:bg-[var(--p-color-info-border)] flex items-center justify-center"
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

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <OperationalAccordion
          items={[
            {
              title: "Pacote XLSX",
              badge: <OperationalChip tone="success">Multiabas</OperationalChip>,
              defaultOpen: true,
              content: "Inclui Consolidado, DFDs, Itens, resumos, metadados e cadastros auxiliares disponíveis no carregamento.",
            },
            {
              title: "Pacote CSV",
              badge: <OperationalChip tone="collab">Arquivo único</OperationalChip>,
              content: "Usa uma linha por item com os dados da DFD e do item; DFDs sem item também entram no relatório.",
            },
          ]}
        />
        <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-[var(--p-color-brand-500)]">Como o arquivo é preparado</p>
          <OperationalTimeline
            items={[
              { title: "Coleta", description: "DFDs, itens e cadastros auxiliares são consultados.", tone: "action" },
              { title: "Enriquecimento", description: "Campi, unidades, perfis e autoria coletiva entram nas planilhas.", tone: "collab" },
              { title: "Download", description: "O arquivo escolhido é gerado com os dados disponíveis.", tone: "success" },
            ]}
          />
        </div>
      </div>

      <SkeuoDocumentCard
        title="Avisos operacionais"
        meta={reportNotice || "Sem avisos críticos no carregamento atual."}
        stamp={reportNotice ? "Atenção" : "OK"}
        tone={reportNotice ? "warning" : "collab"}
      >
        <div className="flex flex-wrap gap-2">
          <OperationalChip tone="warning">{pendingEmailAlerts} e-mails pendentes</OperationalChip>
          <OperationalChip tone="insight">{Object.keys(lookupSheets).length} bases auxiliares</OperationalChip>
        </div>
      </SkeuoDocumentCard>

      {reportNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
          {reportNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <OperationalKpiCard
          label="Valor homologado"
          value={
            loading
              ? "..."
              : Number(kpis?.valor_homologado || totalFinanceiro).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })
          }
          icon={<DownloadSimple size={17} weight="duotone" />}
          tone="action"
        />
        <OperationalKpiCard
          label="Itens consolidados"
          value={loading ? "..." : consolidado.length}
          icon={<Selection size={17} weight="duotone" />}
          tone="collab"
          helper="Prévia da tabela"
        />
        <OperationalKpiCard
          label="Itens prioritários"
          value={loading ? "..." : consolidado.filter((x) => x.destaque_pareto).length}
          icon={<Lightning size={17} weight="duotone" />}
          tone="warning"
          helper="Pareto"
        />
        <OperationalKpiCard
          label="DFDs no relatório"
          value={loading ? "..." : dfds.length}
          icon={<FileCsv size={17} weight="duotone" />}
          tone="success"
          helper="Inclui sem item"
        />
      </div>

      <div className="bg-white border border-[var(--p-color-border)] rounded-[32px] overflow-hidden">
        <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-[var(--p-color-brand-500)] uppercase tracking-tight">
            Prévia do Layout de Exportação
          </h2>
          <span className="type-kicker uppercase tracking-widest text-black/35 font-semibold">
            {consolidado.length} linhas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--p-color-surface-muted)]">
                <th className="px-6 py-3 text-left type-kicker uppercase tracking-widest text-black/40">
                  Código
                </th>
                <th className="px-6 py-3 text-left type-kicker uppercase tracking-widest text-black/40">
                  Descrição
                </th>
                <th className="px-6 py-3 text-right type-kicker uppercase tracking-widest text-black/40">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-right type-kicker uppercase tracking-widest text-black/40">
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
                  <tr key={item.codigo_tce} className="hover:bg-[var(--p-color-bg-muted)]">
                    <td className="px-6 py-3 font-mono text-xs text-[var(--p-color-brand-400)]">
                      {item.codigo_tce}
                    </td>
                    <td className="px-6 py-3 font-semibold text-[var(--p-color-fg-strong)]">
                      {item.descricao}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-black/60">
                      {item.quantidade_total}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-[var(--p-color-brand-500)]">
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
                    <OperationalEmptyState
                      icon={<Lightning size={28} weight="duotone" />}
                      title="Sem dados consolidados para exportação"
                      description="Quando houver DFDs ou itens elegíveis, a prévia e os downloads serão habilitados."
                      className="border-0 p-4 shadow-none"
                    />
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
    <div className="bg-[var(--p-color-surface-muted)] border border-black/5 rounded-xl px-3 py-2 flex justify-between items-center">
      <span className="type-kicker uppercase tracking-wider text-black/45 font-semibold">
        {label}
      </span>
      <span className="min-w-0 overflow-visible font-display font-semibold text-[var(--p-color-brand-500)]">
        <MechanicalValue value={value} />
      </span>
    </div>
  );
}
