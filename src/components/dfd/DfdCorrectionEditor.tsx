"use client";
import { useEffect, useRef, useState } from "react";
import { Plus } from "@/components/icons/lucide/exports/Plus";
import { Search } from "@/components/icons/lucide/exports/Search";
import { Save } from "@/components/icons/lucide/exports/Save";
import { Trash2 } from "@/components/icons/lucide/exports/Trash2";
import { Undo2 } from "@/components/icons/lucide/exports/Undo2";
import { ShieldCheck } from "@/components/icons/lucide/exports/ShieldCheck";
import { FilePenLine } from "@/components/icons/lucide/exports/FilePenLine";
import styles from "./DfdCorrectionEditor.module.css";
import { getCorrectionIssue } from "@/lib/dfd-correction-validation";
import { correctionHistoryDetails } from "@/lib/dfd-correction-history";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Item = {
  id?: string; clientId?: string; catalogId?: string; naturezaCode?: string; naturezas?: Natureza[]; gnd?: string; nome_grupo?: string; nome_classe?: string; codigo_grupo?: string; codigo_classe?: string; codigo_natureza_despesa?: string; author_name?: string; user_id?: string; codigo_tce: string; descricao: string; unidade_medida?: string;
  quantidade: number; valor_unitario_estimado: number; justificativa_quantidade: string;
  justificativa_item?: string; link_referencia?: string; local_uso?: string; remove?: boolean; removalReason?: string;
};
type CatalogItem = { id: string | number; codigo_efisco: string; descricao: string; unidade_medida?: string; nome_grupo?: string; nome_classe?: string; codigo_grupo?: string; codigo_classe?: string };
type Natureza = { codigo_natureza_despesa?: string; gnd?: string; efisco_item_natureza_id?: number };
const inputClass = "w-full rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-3 text-sm text-[var(--p-color-fg)] aria-invalid:border-[var(--semantic-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)] disabled:cursor-not-allowed disabled:opacity-50";

const money = (value: number) => Number.isFinite(value) ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 3 }) : "Confira o valor";
function CurrencyInput({ value, onChange, fieldId }: { value: number; fieldId?: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  return <input id={fieldId} type="text" inputMode="decimal" value={focused ? draft : value > 0 ? money(value) : ""} placeholder="R$ 0,00" aria-invalid={value <= 0 || !Number.isFinite(value)} onFocus={() => { setDraft(value > 0 ? String(value).replace(".", ",") : ""); setFocused(true); }} onChange={event => { const raw = event.target.value; setDraft(raw); const cleaned = raw.replace(/R\$|\s/g, ""); onChange(Number(cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned)); }} onBlur={() => setFocused(false)} className={inputClass} />;
}

export function DfdCorrectionEditor({ dfdId, open, onOpenChange, onSaved, administrative = false, collective = false }: {
  dfdId: string; open: boolean; administrative?: boolean; collective?: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void;
}) {
  const scrollArea = useRef<HTMLDivElement>(null);
  const [reviewing, setReviewing] = useState(false);
  const [issueField, setIssueField] = useState("");
  const [baseline, setBaseline] = useState<{ object: string; justification: string; items: Item[] } | null>(null);
  const reasonArea = useRef<HTMLElement>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const catalogArea = useRef<HTMLElement>(null);
  const [focusItem, setFocusItem] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [object, setObject] = useState("");
  const [justification, setJustification] = useState("");
  const endpoint = administrative ? "/api/admin/dfd/correction" : "/api/dfd/requester-correction";
  const [reason, setReason] = useState("");
  const [revision, setRevision] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setReviewing(false); setIssueField(""); setBaseline(null); setReplaceIndex(null); setLoading(true); setError(""); setReason(""); setRevision(""); setDirty(false); setResults([]); setQuery(""); setSearchMessage("");
    void (async () => {
      try {
        const response = await fetch(`${endpoint}?dfdId=${encodeURIComponent(dfdId)}${collective ? "&collective=1" : ""}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível abrir a edição.");
        if (controller.signal.aborted) return;
        setBaseline({ items: data.items, object: data.dfd.objeto_contratacao || "", justification: data.dfd.justificativa_contratacao || "" });
        setItems(data.items); setObject(data.dfd.objeto_contratacao || ""); setJustification(data.dfd.justificativa_contratacao || ""); setRevision(data.revision);
      } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não foi possível abrir a edição."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [open, dfdId, endpoint, collective]);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty]);
  useEffect(() => {
    if (!focusItem) return;
    const node = scrollArea.current?.querySelector<HTMLElement>(`[data-item-key="${focusItem}"]`);
    if (node) { node.scrollIntoView({ block: "nearest", behavior: "smooth" }); node.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }); }
    setFocusItem(null);
  }, [focusItem, items]);
  function close(next: boolean) {
    if (busy || searching) return;
    if (!next && dirty && !window.confirm("Descartar as alterações que ainda não foram salvas?")) return;
    onOpenChange(next);
  }
  async function chooseCatalog(result: CatalogItem) {
    if (!administrative) return;
    setSearching(true); setSearchMessage("");
    try {
      const response = await fetch(`/api/catalog-item-naturezas?efisco_item_id=${encodeURIComponent(result.id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar a classificação.");
      const naturezas: Natureza[] = data.items || [];
      const first = naturezas.length === 1 ? naturezas[0] : null;
      const metadata = { catalogId: String(result.id), codigo_tce: result.codigo_efisco, descricao: result.descricao, unidade_medida: result.unidade_medida, nome_grupo: result.nome_grupo, nome_classe: result.nome_classe, codigo_grupo: result.codigo_grupo, codigo_classe: result.codigo_classe, codigo_natureza_despesa: first?.codigo_natureza_despesa, naturezas,
        naturezaCode: first ? first.codigo_natureza_despesa || first.gnd || "SEM_NATUREZA" : naturezas.length === 0 ? "SEM_NATUREZA" : "", gnd: first?.gnd || "SEM_NATUREZA" };
      if (replaceIndex !== null) update(replaceIndex, metadata);
      else { const clientId = crypto.randomUUID(); setItems(current => [...current, { ...metadata, clientId, quantidade: 1, valor_unitario_estimado: 0, justificativa_quantidade: "" }]); setDirty(true); setFocusItem(clientId); }
      setReplaceIndex(null); setResults([]); setSearchMessage("Código selecionado. Confira a natureza da despesa e os valores antes de salvar.");
    } catch (err) { setSearchMessage(err instanceof Error ? err.message : "Falha ao carregar classificação."); }
    finally { setSearching(false); }
  }
  function update(index: number, patch: Partial<Item>) { setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); setDirty(true); }
  async function search() {
    setSearching(true); setSearchMessage("");
    try {
      const response = await fetch(`/api/catalog-search?q=${encodeURIComponent(query)}&limit=8`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível buscar itens.");
      setResults(data.items || []); if (!data.items?.length) setSearchMessage("Nenhum item encontrado. Tente outra descrição ou código.");
    } catch (err) { setSearchMessage(err instanceof Error ? err.message : "Falha na busca."); }
    finally { setSearching(false); }
  }
  function focusField(field: string, markInvalid = true) {
    setReviewing(false); if (markInvalid) setIssueField(field);
    requestAnimationFrame(() => {
      const node = scrollArea.current?.querySelector<HTMLElement>(`[id="${field}"]`);
      if (node) { const details = node.closest("details"); if (details) details.open = true; node.scrollIntoView({ block: "center", behavior: "smooth" }); node.focus({ preventScroll: true }); }
    });
  }
  function reviewChanges() {
    setError("");
    const issue = getCorrectionIssue({ object, justification, reason, administrative, collective, items });
    if (issue) { setError(issue.message); focusField(issue.field); return; }
    if (!dirty || changes.length === 0) { setError("Faça uma alteração nos dados da DFD antes de revisar."); return; }
    setIssueField(""); setReviewing(true);
    requestAnimationFrame(() => { scrollArea.current?.scrollTo({ top: 0 }); scrollArea.current?.querySelector<HTMLElement>("#correction-review")?.focus(); });
  }
  async function save() {
    const issue = getCorrectionIssue({ object, justification, reason, administrative, collective, items });
    if (issue) { setError(issue.message); focusField(issue.field); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dfdId, collective, revision, object, justification, reason, items }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar a correção.");
      setDirty(false); toast.success(administrative ? "Correção salva e registrada no histórico da DFD." : "Alterações salvas. Confira a DFD e conclua o reenvio para a chefia."); onOpenChange(false); onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  const retained = items.filter(item => !item.remove);

  const beforeTotal = baseline?.items.reduce((sum, item) => sum + item.quantidade * item.valor_unitario_estimado, 0) || 0;
  const reviewItems = retained.map(item => ({ ...item, id: item.id || item.clientId }));
  const reviewText = baseline ? correctionHistoryDetails(JSON.stringify({ reason, before: { dfd: { objeto_contratacao: baseline.object, justificativa_contratacao: baseline.justification }, items: baseline.items }, after: { dfd: { objeto_contratacao: object, justificativa_contratacao: justification }, items: reviewItems }, removals: items.filter(item => item.remove) })) : "";
  const changes = reviewText.split("\n").slice(1).filter(Boolean);
  const pending = reviewing ? "Confira a comparação. A próxima ação salva e registra a correção." : changes.length ? `${changes.length} alteração(ões) para revisar. ${administrative && reason.trim().length < 3 ? "Falta explicar o motivo da correção." : "Continue para conferir antes de salvar."}` : "Altere os dados que precisam de correção e depois revise.";
  const total = retained.reduce((sum, item) => sum + item.quantidade * item.valor_unitario_estimado, 0);
  return <Dialog open={open} onOpenChange={close}><DialogContent className={`${styles.editor} flex max-h-[92dvh] flex-col gap-0 overflow-hidden bg-[var(--p-color-bg)] text-[var(--p-color-fg)] sm:max-w-5xl`}>
    <DialogHeader className={`${styles.header} shrink-0`}><p className={styles.eyebrow}><ShieldCheck size={14} /> PERCATA · Gestão de demandas</p><DialogTitle>{administrative ? "Corrigir DFD como administrador" : "Editar DFD"}</DialogTitle><DialogDescription>{administrative ? "Corrija itens, quantidades e valores. Selecione códigos e naturezas pelo catálogo para atualizar grupos, classes e GNDs. O histórico registra o responsável, o motivo e os dados antes e depois." : "Atualize os dados e os itens desta solicitação. Salvar as alterações mantém a DFD em correção; o reenvio é uma ação separada."}</DialogDescription><nav aria-label="Etapas da correção" className="mt-3 flex flex-wrap gap-2 text-xs font-semibold"><span aria-current={!reviewing ? "step" : undefined} className="rounded-full border border-[var(--p-color-border-muted)] px-3 py-1.5">1. Corrigir dados</span>{administrative && <button type="button" disabled={loading || busy || reviewing} onClick={() => { reasonArea.current?.scrollIntoView({ block: "center", behavior: "smooth" }); focusField("correction-reason", false); }} className="rounded-full border border-[var(--p-color-info-border)] px-3 py-1.5">2. Explicar o motivo</button>}<span aria-current={reviewing ? "step" : undefined} className={`rounded-full border px-3 py-1.5 ${reviewing ? "border-[var(--semantic-action)] text-[var(--semantic-action)]" : "border-[var(--p-color-border-muted)]"}`}>3. Conferir e salvar</span></nav></DialogHeader>
    {loading ? <p role="status" className="py-6 text-sm">Carregando dados para edição…</p> : <>
      <div ref={scrollArea} className={`${styles.body} min-h-0 flex-1 overflow-y-auto overscroll-contain`}>
      {error && <div id="correction-error" role="alert" className="mb-4 rounded-xl border border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-soft)] p-3 text-sm text-[var(--semantic-danger)]"><p>{error}</p>{issueField && <button type="button" className="mt-2 font-semibold underline" onClick={() => focusField(issueField)}>Ir ao campo que precisa de atenção</button>}</div>}
      {reviewing ? <section id="correction-review" tabIndex={-1} className="space-y-4 py-2 outline-none">
        <h3 className="text-lg font-semibold">3. Confira antes de salvar</h3>
        <p className="text-sm text-[var(--p-color-fg-muted)]">Confira somente o que mudou. A situação da DFD e a autoria dos pedidos serão preservadas.</p>
        <div className={`${styles.reviewTotals} grid grid-cols-2 gap-3 rounded-xl`}><div><p className="text-xs text-[var(--p-color-fg-muted)]">Total anterior</p><p className="text-lg font-semibold">{money(beforeTotal)}</p></div><div><p className="text-xs text-[var(--p-color-fg-muted)]">Total após a correção</p><p className="text-lg font-semibold">{money(total)}</p></div></div>
        <ul className="space-y-3">{changes.map((change, index) => <li key={index} className="whitespace-pre-wrap break-words rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-3 text-sm">{change}</li>)}</ul>
        {collective && <div className="rounded-xl border border-[var(--p-color-info-border)] p-4 text-sm"><p className="font-semibold">Efeito na montagem coletiva</p><p className="mt-1">Os pedidos serão agrupados pela classificação corrigida. As quantidades e os valores serão usados na prévia e na geração das DFDs oficiais.</p><ul className="mt-2 space-y-1">{items.filter(item => { const before = baseline?.items.find(old => old.id === item.id); return !before || item.remove || JSON.stringify(item) !== JSON.stringify(before); }).map(item => <li key={item.id || item.clientId}>{item.codigo_tce} · pedido de {item.author_name || "Administrador"}</li>)}</ul></div>}
        {administrative && <div className="rounded-xl border border-[var(--p-color-info-border)] p-4"><p className="text-sm font-semibold">Motivo que ficará no histórico</p><p className="mt-2 whitespace-pre-wrap text-sm">{reason}</p><p className="mt-2 text-xs text-[var(--p-color-fg-muted)]">Seu nome, a data e os dados anteriores e novos serão registrados ao confirmar.</p></div>}
      </section> : <>

      {revision && <fieldset disabled={busy} className="mt-2 space-y-4">

        <section className={styles.intro}><div><h3 className="font-semibold">Itens da demanda</h3><p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">Ajuste quantidades e preços. Os detalhes de cada pedido ficam logo abaixo.</p></div><span className="shrink-0 rounded-full bg-[var(--semantic-action-soft)] px-3 py-1 text-xs font-semibold text-[var(--semantic-action)]">{retained.length} itens</span></section>
        <div className="space-y-4">{items.map((item, index) => <section data-item-key={item.id || item.clientId} key={item.id || item.clientId} className={`${styles.item} rounded-2xl border ${item.remove ? "border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-soft)]" : "border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)]"}`}>
          <div className={styles.itemHeading}><span className={styles.itemNumber}>{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><p className="text-xs font-medium text-[var(--p-color-fg-muted)]">{item.codigo_tce} · {item.unidade_medida || "Unidade"}{!item.id ? " · Novo item" : ""}</p><h3 className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--p-color-fg)]">{item.descricao}</h3><details className="mt-1 text-xs text-[var(--p-color-fg-muted)]"><summary className="cursor-pointer">Ver descrição completa</summary><p className="mt-2">{item.descricao}</p></details>{collective && <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">Pedido de {item.author_name || item.user_id || "Administrador"}</p>}</div>
            {<button type="button" aria-label={`${item.remove ? "Restaurar" : "Retirar"} ${item.descricao}`} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--semantic-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]" onClick={() => { if (!item.id) { setItems(current => current.filter((_, i) => i !== index)); setDirty(true); } else update(index, { remove: !item.remove }); }}>{item.remove ? <Undo2 size={18} /> : <Trash2 size={18} />}</button>}
          </div>
          {item.remove ? <label className="mt-4 block space-y-2 text-sm font-medium"><span>Motivo da retirada</span><textarea id={`correction-removal-${index}`} aria-invalid={issueField === `correction-removal-${index}` && Boolean(error)} aria-describedby={issueField === `correction-removal-${index}` ? "correction-error" : undefined} rows={2} maxLength={2000} value={item.removalReason || ""} onChange={event => update(index, { removalReason: event.target.value })} className={inputClass} /></label> : <div><div className={styles.financial}>
            <label className="space-y-2 text-sm font-medium"><span>Quantidade</span><input id={`correction-quantity-${index}`} aria-invalid={issueField === `correction-quantity-${index}` && Boolean(error)} aria-describedby={issueField === `correction-quantity-${index}` ? "correction-error" : undefined} type="number" min="1" step="1" value={item.quantidade || ""} onChange={event => update(index, { quantidade: Number(event.target.value) })} className={inputClass} /></label>
            <label className="space-y-2 text-sm font-medium"><span>Valor unitário estimado · R$</span><CurrencyInput fieldId={`correction-price-${index}`} value={item.valor_unitario_estimado} onChange={value => update(index, { valor_unitario_estimado: value })} /></label>
            <p className={styles.subtotal}>Subtotal do item<strong>{money(item.quantidade * item.valor_unitario_estimado)}</strong></p></div><details className={styles.details} open={!administrative || undefined}><summary>Justificativas, referência e local de uso</summary><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium sm:col-span-2"><span>Justificativa da quantidade</span><textarea id={`correction-basis-${index}`} aria-invalid={issueField === `correction-basis-${index}` && Boolean(error)} aria-describedby={issueField === `correction-basis-${index}` ? "correction-error" : undefined} aria-label="Justificativa da quantidade" rows={2} maxLength={4000} value={item.justificativa_quantidade || ""} onChange={event => update(index, { justificativa_quantidade: event.target.value })} className={inputClass} /></label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2"><span>Justificativa e especificação do item</span><textarea rows={2} maxLength={4000} value={item.justificativa_item || ""} onChange={event => update(index, { justificativa_item: event.target.value })} className={inputClass} /></label>
            <label className="space-y-2 text-sm font-medium"><span>Link de referência</span><input id={`correction-link-${index}`} aria-invalid={issueField === `correction-link-${index}` && Boolean(error)} aria-describedby={issueField === `correction-link-${index}` ? "correction-error" : undefined} type="url" maxLength={2000} value={item.link_referencia || ""} onChange={event => update(index, { link_referencia: event.target.value })} className={inputClass} /></label>
            {!collective && <label className="space-y-2 text-sm font-medium"><span>Local de uso</span><input maxLength={1000} value={item.local_uso || ""} onChange={event => update(index, { local_uso: event.target.value })} className={inputClass} /></label>}
          </div></details></div>}
          {!item.remove && <div className="mt-3 space-y-1 text-sm">{(!Number.isInteger(item.quantidade) || item.quantidade < 1) && <p className="text-[var(--semantic-danger)]">Quantidade: informe um número inteiro maior que zero.</p>}{(!Number.isFinite(item.valor_unitario_estimado) || item.valor_unitario_estimado <= 0) && <p className="text-[var(--semantic-danger)]">Valor unitário: informe um valor maior que zero.</p>}{!administrative && (item.justificativa_quantidade?.trim().length || 0) < 3 && <p className="text-[var(--semantic-danger)]">Preencha a justificativa da quantidade.</p>}</div>}
          {administrative && !item.remove && <div className={`${styles.fiscal} space-y-2 border border-[var(--p-color-border-muted)] text-sm`}>
            <p>Grupo: {item.nome_grupo || "Não informado"} · Classe: {item.nome_classe || "Não informada"} · GND: {item.gnd || "Sem natureza"}</p>
            <button type="button" className={`${buttonClass} border border-[var(--p-color-border-muted)]`} onClick={() => { setReplaceIndex(index); setQuery(item.codigo_tce); setResults([]); setSearchMessage("Busque e selecione o código correto para este item."); catalogArea.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}>Corrigir código ou natureza</button>
            {item.naturezas && item.naturezas.length > 0 && <label className="block space-y-2"><span>Natureza da despesa · GND</span><select id={`correction-nature-${index}`} aria-invalid={issueField === `correction-nature-${index}` && Boolean(error)} aria-describedby={issueField === `correction-nature-${index}` ? "correction-error" : undefined} className={inputClass} value={item.naturezaCode || ""} onChange={event => { const nature = item.naturezas?.find(option => (option.codigo_natureza_despesa || option.gnd || "SEM_NATUREZA") === event.target.value); update(index, { naturezaCode: event.target.value, gnd: nature?.gnd || "SEM_NATUREZA", codigo_natureza_despesa: nature?.codigo_natureza_despesa }); }}><option value="">Escolha a natureza correta</option>{item.naturezas.map((option, i) => <option key={i} value={option.codigo_natureza_despesa || option.gnd || "SEM_NATUREZA"}>{option.codigo_natureza_despesa || "Sem código de natureza"} · {option.gnd || "Sem GND"}</option>)}</select></label>}
          </div>}
          {item.remove && (item.removalReason?.trim().length || 0) < 3 && <p className="m-4 text-sm text-[var(--semantic-danger)]">Informe o motivo da retirada, com pelo menos 3 caracteres.</p>}
        </section>)}</div>
        <details className="rounded-xl border border-[var(--p-color-border-muted)] p-4"><summary className="cursor-pointer text-sm font-semibold">Objeto e justificativa da contratação</summary><div className="mt-4 space-y-4">        <label className="block space-y-2 text-sm font-medium"><span>Objeto da contratação</span><textarea id="correction-object" aria-invalid={issueField === "correction-object" && Boolean(error)} aria-describedby={issueField === "correction-object" ? "correction-error" : undefined} rows={2} maxLength={2000} value={object} onChange={event => { setObject(event.target.value); setDirty(true); }} className={inputClass} /></label>
        <label className="block space-y-2 text-sm font-medium"><span>Justificativa da contratação</span><textarea id="correction-justification" aria-invalid={issueField === "correction-justification" && Boolean(error)} aria-describedby={issueField === "correction-justification" ? "correction-error" : undefined} rows={4} maxLength={10000} value={justification} onChange={event => { setJustification(event.target.value); setDirty(true); }} className={inputClass} /></label>
</div></details>
        {<section id="correction-catalog" tabIndex={-1} ref={catalogArea} className="rounded-2xl border border-[var(--p-color-info-border)] p-4"><h3 className="text-base font-semibold">{replaceIndex !== null ? "Selecionar código para corrigir o item" : "Adicionar item do catálogo"}</h3>{replaceIndex !== null && <button type="button" className={buttonClass} onClick={() => { setReplaceIndex(null); setResults([]); setSearchMessage(""); }}>Cancelar troca de código</button>}<p className="mt-1 text-sm text-[var(--p-color-fg-muted)]">Busque por descrição ou código e-Fisco. {collective ? "A classificação será usada na montagem e separação das DFDs oficiais." : "Mantenha custeio e capital em DFDs separadas."}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row"><input aria-label="Descrição ou código do item" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && query.trim().length >= 2 && !searching) { event.preventDefault(); void search(); } }} className={inputClass} /><button type="button" disabled={searching || query.trim().length < 2} onClick={() => void search()} className={`${buttonClass} border border-[var(--p-color-border-muted)]`}><Search size={18} />{searching ? "Buscando…" : "Buscar"}</button></div>
          {searchMessage && <p role="status" className="mt-3 text-sm text-[var(--p-color-fg-muted)]">{searchMessage}</p>}
          <ul className="mt-3 space-y-2">{results.map(result => <li key={result.id}><button type="button" disabled={searching || busy} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-[var(--p-color-border-muted)] p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--semantic-action)]" onClick={() => { if (administrative) { void chooseCatalog(result); return; } const clientId = crypto.randomUUID(); setItems(current => [...current, { clientId, catalogId: String(result.id), codigo_tce: result.codigo_efisco, descricao: result.descricao, unidade_medida: result.unidade_medida, quantidade: 1, valor_unitario_estimado: 0, justificativa_quantidade: "" }]); setDirty(true); setFocusItem(clientId); setResults([]); setSearchMessage("Item adicionado. Preencha o valor estimado e a justificativa da quantidade."); }}><Plus size={18} className="shrink-0 text-[var(--semantic-action)]" /><span className="text-sm"><span className="block text-xs text-[var(--p-color-fg-muted)]">{result.codigo_efisco}</span>{result.descricao}</span></button></li>)}</ul>
        </section>}
        {administrative && <section ref={reasonArea} className={`${styles.reason} rounded-2xl border ${issueField === "correction-reason" && reason.trim().length < 3 ? "border-[var(--semantic-danger-border)] bg-[var(--semantic-danger-soft)]" : "border-[var(--p-color-info-border)] bg-[var(--p-color-bg-elevated)]"}`}>
          <h3 className="text-base font-semibold"><FilePenLine size={20} /> Motivo da correção</h3>
          <label className="mt-3 block space-y-2 text-sm font-medium"><span>Por que você está corrigindo esta DFD? · obrigatório</span><textarea id="correction-reason" aria-label="Motivo da correção" aria-describedby="correction-reason-help" aria-invalid={issueField === "correction-reason" && reason.trim().length < 3} rows={3} maxLength={2000} value={reason} onChange={event => { setReason(event.target.value); if (event.target.value.trim().length >= 3 && issueField === "correction-reason") { setError(""); setIssueField(""); } }} placeholder="Ex.: Correção dos valores unitários conforme revisão das referências de preço." className={inputClass} /></label>
          <p id="correction-reason-help" className="mt-2 text-sm text-[var(--p-color-fg-muted)]">Esse motivo será registrado no histórico junto ao seu nome e às alterações. Escreva uma explicação com pelo menos 3 caracteres.</p>
          {issueField === "correction-reason" && reason.trim().length < 3 && <p className="mt-2 text-sm font-medium text-[var(--semantic-danger)]">Explique o motivo para continuar à revisão.</p>}
        </section>}
      </fieldset>}</>}


      </div>
      <div className={`${styles.footer} shrink-0 border-t border-[var(--p-color-border-muted)]`}><p role="status" className="mb-2 text-xs text-[var(--p-color-fg-muted)]">{pending}</p><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className={styles.footerTotal}>Total estimado · {retained.length} itens<strong>{Number.isFinite(total) ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Confira os valores"}</strong></p><div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3"><button type="button" disabled={busy || searching} onClick={() => reviewing ? setReviewing(false) : close(false)} className={`${buttonClass} border border-[var(--p-color-border-muted)]`}>{reviewing ? "Voltar à edição" : "Cancelar"}</button><button type="button" onClick={() => reviewing ? void save() : reviewChanges()} disabled={busy || searching || !revision} className={`${buttonClass} bg-[var(--semantic-action)] text-[var(--p-color-action-fg)]`}><Save size={18} />{busy ? "Salvando…" : reviewing ? "Confirmar e salvar" : "Revisar e salvar"}</button></div></div></div>
    </>}
  </DialogContent></Dialog>;
}
