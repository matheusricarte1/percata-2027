"use client";

import { useState, useSyncExternalStore } from "react";
import { Building2 } from "@/components/icons/lucide/exports/Building2";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { ChevronRight } from "@/components/icons/lucide/exports/ChevronRight";
import { ExternalLink } from "@/components/icons/lucide/exports/ExternalLink";
import { RefreshCw } from "@/components/icons/lucide/exports/RefreshCw";
import { Save } from "@/components/icons/lucide/exports/Save";
import { Trash2 } from "@/components/icons/lucide/exports/Trash2";
import { Undo2 } from "@/components/icons/lucide/exports/Undo2";
import { X } from "@/components/icons/lucide/exports/X";
import { AnalysisSession } from "@/lib/analysis-session";
import {
  analysisTotal,
  describeChanges,
  getReviewBlocker,
  impactLabel,
  priorityLabel,
  IMPACTS,
  PRIORITIES,
} from "@/lib/dfd-analysis";
import { AnalysisScale } from "./AnalysisScale";
import { SavedItemEvaluations } from "./SavedItemEvaluations";
import { analysisDisplayItem } from "@/lib/analysis-reference";
import type { AnalysisItem } from "@/lib/dfd-analysis";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const priorityHint = (value: string | null) =>
  value === "nao_tera_agora"
    ? "Postergado permanece na DFD; não equivale a retirar."
    : "Ordem de atendimento.";

export function QuickItemDrawer({
  session,
  itemId,
  calendarOpen,
  superadmin,
  selected,
  onSelect,
  onRefresh,
  onDelete,
  onItemChange,
  onClose,
  onRemoveItem,
}: {
  session: AnalysisSession;
  itemId?: string;
  calendarOpen: boolean;
  superadmin: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onRefresh: () => Promise<void>;
  onDelete: () => void;
  onItemChange: (itemId: string) => void;
  onClose: () => void;
  onRemoveItem?: (item: AnalysisItem, reason: string) => void;
}) {
  const [removalOpen, setRemovalOpen] = useState(false);
  const [removalReason, setRemovalReason] = useState("");
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  const dfd = session.getDfd();
  const ownItem =
    state.working.items.find((entry) => entry.id === itemId) ||
    state.working.items[0];
  if (!ownItem) return null;
  const item = analysisDisplayItem(dfd, ownItem);
  const editable = dfd.status === "triagem";
  const disabled =
    state.busy ||
    state.pendingFormal ||
    state.conflict ||
    !state.ready ||
    !editable || Boolean(dfd.referenceEvaluation);
  const displayedItems = state.working.items.map((entry) => analysisDisplayItem(dfd, entry));
  const retained = displayedItems.filter((entry) => !entry.remove);
  const notes = displayedItems.filter((entry) =>
    entry.correctionNote?.trim(),
  );
  const changes = describeChanges(dfd.items, state.working.items);
  const blocker = getReviewBlocker(state.working.items, "approve");
  const next = state.working.items
    .slice(state.working.items.findIndex((entry) => entry.id === item.id) + 1)
    .concat(
      state.working.items.slice(
        0,
        state.working.items.findIndex((entry) => entry.id === item.id),
      ),
    )
    .find(
      (entry) =>
        !entry.remove &&
        (!entry.criticidade || !entry.moscow_categoria || entry.quantidade < 1),
    );
  const perform = (action: "apply" | "approve" | "return") =>
    void session
      .perform(action, calendarOpen)
      .catch((error: Error) => session.setError(error.message));
  return (
    <aside className="aw-drawer" aria-label="Avaliando item">
      <header className="aw-drawerHead">
        <div>
          <span className="aw-muted">AVALIANDO ITEM</span>
          <h2>{item.descricao}</h2>
        </div>
        <button
          className="aw-iconButton aw-button"
          onClick={onClose}
          aria-label="Fechar avaliação"
        >
          <X size={18} />
        </button>
      </header>
      <div className="aw-drawerBody">
        {superadmin && <SavedItemEvaluations evaluations={dfd.evaluations} itemId={item.id} revision={dfd.revision} />}
        {state.error && (
          <div className="aw-alert" role="alert">
            <strong>{state.error}</strong>
            <button
              className="aw-button"
              disabled={state.busy}
              onClick={() => void session.retry().catch(() => {})}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {state.pendingFormal && (
          <div className="aw-note">
            Uma decisão foi enviada e precisa ser conferida antes de editar.
            <button
              className="aw-button"
              disabled={state.busy}
              onClick={() => void session.retry().catch(() => {})}
            >
              Conferir decisão enviada
            </button>
          </div>
        )}
        {state.conflict && (
          <section className="aw-alert" aria-label="Conflito de versão">
            <strong>A DFD mudou em outra sessão.</strong>
            <p>Confira as versões antes de reaplicar seu rascunho.</p>
            <button className="aw-button" onClick={() => void onRefresh()}>
              <RefreshCw size={16} /> Buscar versão atual
            </button>
            <label className="aw-row">
              <input
                type="checkbox"
                checked={state.compared}
                onChange={(event) => session.setCompared(event.target.checked)}
              />
              Comparei as versões
            </label>
            <button
              className="aw-button"
              disabled={!state.compared || state.busy}
              onClick={session.reapply}
            >
              <Undo2 size={16} /> Reaplicar meu rascunho
            </button>
          </section>
        )}
        <span className="aw-tag">{dfd.numero_protocolo}</span>
        <p className="aw-muted">
          <Building2 size={16} /> {dfd.requester} · {dfd.sector}
        </p>
        <section className="aw-drawerSection">
          <strong>Descrição completa</strong>
          <p>{item.descricao}</p>
        </section>
        <div className="aw-drawerNumbers">
          <div>
            <span>Valor unitário</span>
            <strong>{money(item.valor_unitario_estimado)}</strong>
          </div>
          <div>
            <span>Valor total</span>
            <strong>
              {money(item.quantidade * item.valor_unitario_estimado)}
            </strong>
          </div>
        </div>
        <section className="aw-drawerSection">
          <label htmlFor={`quantity-${item.id}`}>
            <strong>Quantidade</strong>
          </label>
          <input
            id={`quantity-${item.id}`}
            className="aw-field"
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(item.quantidade) ? item.quantidade : ""}
            disabled={disabled}
            onChange={(event) =>
              session.updateItem(item.id, {
                quantidade:
                  event.target.value === "" ? NaN : Number(event.target.value),
              })
            }
          />
        </section>
        <section className="aw-drawerSection">
          <strong>Definir avaliação</strong>
          <div className="aw-drawerScales">
            <AnalysisScale
              id={`impact-${item.id}`}
              label={`Criticidade: ${impactLabel(item.criticidade)}`}
              description="Impacto se não atender."
              value={item.criticidade}
              options={IMPACTS}
              tone="impact"
              disabled={disabled}
              onChange={(value) =>
                session.updateItem(item.id, { criticidade: value })
              }
            />
            <AnalysisScale
              id={`priority-${item.id}`}
              label={`Prioridade: ${priorityLabel(item.moscow_categoria)}`}
              description={priorityHint(item.moscow_categoria)}
              value={item.moscow_categoria}
              options={PRIORITIES}
              tone="priority"
              disabled={disabled}
              onChange={(value) =>
                session.updateItem(item.id, { moscow_categoria: value })
              }
            />
          </div>
        </section>
        <label className="aw-drawerSection">
          <strong>Observações (opcional)</strong>
          <textarea
            className="aw-field"
            rows={4}
            value={item.correctionNote || ""}
            disabled={disabled}
            onChange={(event) =>
              session.updateItem(item.id, {
                correctionNote: event.target.value,
              })
            }
            placeholder="Adicione uma observação sobre sua avaliação…"
          />
        </label>
        {superadmin && onRemoveItem && editable && <section className="aw-drawerSection">
          <button type="button" className="aw-button aw-danger" disabled={state.busy || state.pendingFormal || !state.ready} onClick={() => setRemovalOpen(true)}><Trash2 size={16} /> Retirar item da DFD</button>
          {removalOpen && <div role="dialog" aria-label="Confirmar retirada do item">
            <p>A retirada será registrada no histórico. As avaliações dos demais itens serão preservadas.</p>
            <label>Motivo da retirada<textarea className="aw-field" value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} maxLength={2000} /></label>
            <button type="button" className="aw-button aw-danger" disabled={removalReason.trim().length < 3 || state.busy || state.pendingFormal} onClick={() => { onRemoveItem(item, removalReason.trim()); setRemovalOpen(false); }}>Confirmar retirada</button>
            <button type="button" className="aw-button" onClick={() => setRemovalOpen(false)}>Cancelar</button>
          </div>}
        </section>}
        {editable && !item.remove && !superadmin && (
          <button
            className="aw-button aw-danger"
            disabled={disabled}
            onClick={() => session.updateItem(item.id, { remove: true })}
          >
            <Trash2 size={16} /> Retirar item
          </button>
        )}
        {item.remove && (
          <section className="aw-note">
            <strong>Item retirado do rascunho</strong>
            <label>
              Motivo da retirada
              <textarea
                className="aw-field"
                value={item.removalReason || ""}
                disabled={disabled}
                onChange={(event) =>
                  session.updateItem(item.id, {
                    removalReason: event.target.value,
                  })
                }
              />
            </label>
            {!retained.length && (
              <p>
                Este é o último item da DFD. Informe a orientação abaixo para
                devolver a DFD inteira ao solicitante.
              </p>
            )}
            <button
              className="aw-button"
              disabled={disabled}
              onClick={() => session.updateItem(item.id, { remove: false })}
            >
              <Undo2 size={16} /> Desfazer retirada
            </button>
          </section>
        )}
        <details className="aw-drawerSection" open={item.remove}>
          <summary>
            {item.remove ? "Devolver DFD para correção" : "Revisar e decidir a DFD"}
          </summary>
          <p>
            Original: {money(analysisTotal(dfd.items))} · Proposto:{" "}
            {money(analysisTotal(state.working.items))}
          </p>
          {changes.length ? (
            <ul>
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma alteração nos itens.</p>
          )}
          {!calendarOpen && (
            <p>
              As decisões formais estarão disponíveis no período de conclusão.
            </p>
          )}
          {blocker && <p className="aw-note">{blocker}</p>}
          <div className="aw-drawerActions">
            <button
              className="aw-button"
              disabled={
                disabled ||
                !calendarOpen ||
                Boolean(getReviewBlocker(state.working.items, "apply"))
              }
              onClick={() => perform("apply")}
            >
              Confirmar ajustes
            </button>
            <button
              className="aw-button aw-primary"
              disabled={disabled || !calendarOpen || Boolean(blocker)}
              onClick={() => perform("approve")}
            >
              <CheckCircle2 size={16} /> Homologar DFD
            </button>
          </div>
          <label>
            Orientação para o solicitante
            <textarea
              className="aw-field"
              value={state.working.reason}
              disabled={disabled}
              onChange={(event) =>
                session.edit({ ...state.working, reason: event.target.value })
              }
            />
          </label>
          {notes.length > 0 && (
            <p className="aw-muted">
              {notes.length} orientação(ões) por item serão incluídas na
              devolução.
            </p>
          )}
          <button
            className="aw-button aw-primary"
            disabled={
              disabled ||
              !calendarOpen ||
              (!notes.length && state.working.reason.trim().length < 3)
            }
            onClick={() => perform("return")}
          >
            Devolver DFD inteira para correção
          </button>
          <label className="aw-row">
            <input
              type="checkbox"
              checked={selected}
              disabled={state.busy || !editable}
              onChange={(event) => onSelect(event.target.checked)}
            />
            Incluir na homologação em lote
          </label>
        </details>
        <div className="aw-drawerActions">
          <a
            className="aw-button"
            href={`/dfd/${dfd.id}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} /> Ver DFD
          </a>
          {next && (
            <button
              className="aw-button"
              disabled={disabled}
              onClick={() => onItemChange(next.id)}
            >
              Próxima pendência <ChevronRight size={16} />
            </button>
          )}
        </div>
        {superadmin && (
          <details className="aw-drawerSection">
            <summary>Administração da DFD</summary>
            <button
              className="aw-button aw-danger"
              disabled={state.busy || state.dirty}
              onClick={onDelete}
            >
              Excluir DFD <Trash2 size={16} />
            </button>
            {state.dirty && <p>Salve o rascunho antes de excluir.</p>}
          </details>
        )}
      </div>
      <footer className="aw-drawerFoot">
        <button
          className="aw-button aw-primary"
          disabled={disabled || !state.dirty}
          onClick={() => void session.save()}
        >
          <Save size={16} /> Salvar avaliação
        </button>
        <button className="aw-button" onClick={onClose}>
          Cancelar
        </button>
      </footer>
    </aside>
  );
}
