"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { describeChanges, type AnalysisItem } from "@/lib/dfd-analysis";
type HistoryRow = {
  request_id: string;
  actor_name: string;
  actor_email: string;
  protocol: string;
  dfd_id: string;
  action: string;
  status: string;
  error_detail: string | null;
  created_at: string;
  request_data: { items?: AnalysisItem[]; itemId?: string; reason?: string };
  before_data: {
    items?: AnalysisItem[];
    dfd?: { status: string };
    reason?: string;
  } | null;
  after_data: {
    items?: AnalysisItem[];
    payload?: { items?: AnalysisItem[] };
  } | null;
};
const labels: Record<string, string> = {
  save_draft: "Rascunho salvo",
  apply: "Ajustes registrados",
  approve: "Homologação",
  return: "Devolução",
  remove: "Retirada de item",
  delete: "Exclusão da DFD",
};
export function AnalysisHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [name, setName] = useState("");
  const [day, setDay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const load = useCallback(
    async (
      append = false,
      filterName = "",
      filterDay = "",
      cursor: string | null = null,
    ) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (filterName) params.set("name", filterName);
        if (filterDay) params.set("day", filterDay);
        if (append && cursor) params.set("before", cursor);
        const response = await fetch(
          `/api/superadmin/dfd-operations?${params}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRows((previous) =>
          append ? [...previous, ...data.operations] : data.operations,
        );
        setNext(data.nextBefore);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const download = (row: HistoryRow) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(row, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `operacao-${row.request_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-card p-5"
      aria-label="Histórico de operações"
    >
      <h2 className="text-2xl font-semibold">Histórico de operações</h2>
      <p>
        Registros das novas operações da chefia e exclusões do Superadmin.
        Horários de Brasília. Tentativas que falharam também aparecem aqui.
      </p>
      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void load(false, name, day);
        }}
      >
        <label className="space-y-2">
          Pessoa
          <input
            className="block min-h-11 rounded-lg border border-border bg-background p-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da pessoa"
          />
        </label>
        <label className="space-y-2">
          Dia
          <input
            className="block min-h-11 rounded-lg border border-border bg-background p-3"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <Button disabled={loading} type="submit">
          Consultar
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Consultando histórico…</p>}
      {!loading && !error && !rows.length && (
        <p>
          Nenhuma operação registrada neste período. Registros antigos que não
          foram capturados não podem ser reconstruídos por este histórico.
        </p>
      )}
      <ol className="space-y-3">
        {rows.map((row) => {
          const requested =
            row.request_data.items ||
            (row.action === "remove"
              ? row.before_data?.items?.map((i) =>
                  i.id === row.request_data.itemId
                    ? {
                        ...i,
                        remove: true,
                        removalReason: row.request_data.reason,
                      }
                    : i,
                )
              : row.after_data?.items);
          const changes =
            row.before_data?.items && requested
              ? describeChanges(row.before_data.items, requested)
              : [];
          return (
            <li
              key={row.request_id}
              className="rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>
                  {row.actor_name || row.actor_email} ·{" "}
                  {labels[row.action] || row.action}
                </strong>
                <span>
                  {new Date(row.created_at).toLocaleString("pt-BR", {
                    timeZone: "America/Bahia",
                  })}
                </span>
              </div>
              <p>
                {row.protocol || row.dfd_id} ·{" "}
                {row.status === "succeeded"
                  ? "Confirmada"
                  : row.status === "failed"
                    ? "Não aplicada — falhou"
                    : "Em processamento"}
              </p>
              {row.error_detail && (
                <p className="mt-2">Motivo registrado: {row.error_detail}</p>
              )}
              {row.before_data?.reason && (
                <p>Motivo: {row.before_data.reason}</p>
              )}
              {changes.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer">
                  Detalhes para conferência
                </summary>
                <p className="mt-2 break-all text-xs">
                  Código: {row.request_id}
                </p>
                {row.action === "delete" && (
                  <p>
                    Estado anterior: {row.before_data?.dfd?.status} ·{" "}
                    {row.before_data?.items?.length || 0} item(ns) preservado(s)
                    no histórico.
                  </p>
                )}
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => download(row)}
                >
                  Baixar registro completo
                </Button>
              </details>
            </li>
          );
        })}
      </ol>
      {next && (
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void load(true, name, day, next)}
        >
          Carregar mais operações
        </Button>
      )}
    </section>
  );
}
