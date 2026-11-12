"use client";
import { useId, useState } from "react";
import { LoaderCircle } from "@/components/icons/lucide/exports/LoaderCircle";
import { Trash2 } from "@/components/icons/lucide/exports/Trash2";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function CollectiveRoomDeleteButton({ room, onDeleted }: {
  room: { id: string; title: string; status: string };
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputId = useId();
  if (["convertida", "pronta_para_conversao"].includes(room.status)) return <p className="px-4 pb-3 text-xs text-[var(--p-color-fg-muted)]">Exclusão indisponível: sala pronta para conversão ou vinculada a DFD oficial.</p>;
  async function remove() {
    if (busy || confirmation.trim() !== room.title.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/collective-rooms/${room.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const result = await response.json();
      if (!response.ok || !result.deleted) throw new Error(result.error || "Não foi possível confirmar a exclusão.");
      setOpen(false);
      onDeleted(room.id);
      toast.success("Sala coletiva excluída", { description: room.title });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível excluir a sala."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="flex justify-end px-3 pb-3"><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-[var(--p-color-danger)] hover:bg-[var(--p-color-danger-bg)] focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Excluir sala ${room.title}`} onClick={() => { setConfirmation(""); setError(""); setOpen(true); }}><Trash2 size={16} aria-hidden="true" /> Excluir sala</button></div>
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <DialogContent showCloseButton={!busy}>
        <DialogTitle>Excluir sala coletiva?</DialogTitle>
        <DialogDescription>A sala “{room.title}”, suas contribuições e seu histórico serão removidos permanentemente. Esta ação não pode ser desfeita.</DialogDescription>
        <div><label htmlFor={inputId} className="mb-2 block text-sm font-medium">Digite o título da sala para confirmar</label><input id={inputId} autoComplete="off" maxLength={160} disabled={busy} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--p-color-border)] px-3" /></div>
        {error && <p role="alert" className="text-sm text-[var(--p-color-danger)]">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-11 rounded-lg border px-4">Cancelar</button><button type="button" disabled={busy || confirmation.trim() !== room.title.trim()} onClick={() => void remove()} aria-busy={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--p-color-danger)] px-4 text-white disabled:opacity-40">{busy && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}{busy ? "Excluindo…" : "Excluir definitivamente"}</button></div>
      </DialogContent>
    </Dialog>
  </>;
}
