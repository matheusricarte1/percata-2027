"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarChart3 } from "@/components/icons/lucide/exports/BarChart3";
import { Barcode } from "@/components/icons/lucide/exports/Barcode";
import { Box } from "@/components/icons/lucide/exports/Box";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { ChevronDown } from "@/components/icons/lucide/exports/ChevronDown";
import { ExternalLink } from "@/components/icons/lucide/exports/ExternalLink";
import { Info } from "@/components/icons/lucide/exports/Info";
import { MoreVertical } from "@/components/icons/lucide/exports/MoreVertical";
import { Tag } from "@/components/icons/lucide/exports/Tag";
import { Save } from "@/components/icons/lucide/exports/Save";
import { Star } from "@/components/icons/lucide/exports/Star";
import { Target } from "@/components/icons/lucide/exports/Target";
import { Trash2 } from "@/components/icons/lucide/exports/Trash2";
import type { AnalysisItem } from "@/lib/dfd-analysis";
import type { AnalysisSession } from "@/lib/analysis-session";
import type { AnalysisDfdSummary } from "@/lib/dfd-analysis-queue";
import {
  highlightLimit,
  IMPACT_STEPS,
  PRIORITY_STEPS,
  impactLabel,
  priorityLabel,
} from "@/lib/dfd-analysis";
import { DecisionSlider } from "./DecisionSlider";
import { analysisSaveFeedback } from "@/lib/analysis-save-feedback";
import { formatCatalogDisplayText } from "@/lib/catalog-description";
import { SavedItemEvaluations } from "./SavedItemEvaluations";
import { analysisDisplayItem } from "@/lib/analysis-reference";

const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const impactDecisionCopy = [
  { label: "Pendente", hint: "" },
  { label: "Baixo", hint: "Atividade segue" },
  { label: "Médio", hint: "Fica mais difícil" },
  { label: "Alto", hint: "Prejudica bastante" },
  { label: "Crítico", hint: "Pode parar a atividade" },
] as const;

const priorityDecisionCopy = [
  { label: "Pendente", hint: "" },
  { label: "Postergado", hint: "Pode ficar para depois" },
  { label: "Oportuno", hint: "Seria bom incluir" },
  { label: "Relevante", hint: "Precisa entrar" },
  { label: "Essencial", hint: "Tem que entrar" },
] as const;

export type InlineItemRowProps = {
  item: AnalysisItem;
  dfdSummary: AnalysisDfdSummary;
  session?: AnalysisSession;
  busy?: boolean;
  onOpenDfd: (dfdId: string, itemId?: string) => void;
  onRemoveRequest?: (dfdId: string, item: AnalysisItem, reason: string) => void;
  initiallyCollapsed?: boolean;
  compactMode?: boolean;
  adminRemoval?: boolean;
};

export function InlineItemRow({
  item,
  dfdSummary,
  session,
  busy = false,
  onRemoveRequest,
  initiallyCollapsed,
  compactMode = false,
  adminRemoval = false,
}: InlineItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [removalDialogOpen, setRemovalDialogOpen] = useState(false);
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState("");
  const [collapsed, setCollapsed] = useState(Boolean(initiallyCollapsed || compactMode));
  const [starMotion, setStarMotion] = useState<"on" | "off" | "">("");
  const [touched, setTouched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const previousCompactMode = useRef(compactMode);
  useEffect(() => {
    if (previousCompactMode.current !== compactMode) {
      previousCompactMode.current = compactMode;
      setCollapsed(compactMode);
    }
  }, [compactMode]);
  const snapshot = session?.getSnapshot();
  const reference = session?.getDfd().referenceEvaluation;
  const disabled = busy || Boolean(reference) || !snapshot?.ready || snapshot.busy ||
    snapshot.conflict || snapshot.pendingFormal ||
    session?.getDfd().status !== "triagem" || Boolean(item.remove);

  // Read live state from session if available
  const ownItem =
    session?.getSnapshot().working.items.find((i) => i.id === item.id) || item;
  const liveItem = session ? analysisDisplayItem(session.getDfd(), ownItem) : ownItem;
  const removalDisabled = adminRemoval ? busy || !snapshot?.ready || snapshot.busy || snapshot.pendingFormal : disabled;
  const savedEvaluations = <SavedItemEvaluations evaluations={session?.getDfd().evaluations} itemId={item.id} revision={session?.getDfd().revision || ""} />;

  const currentImpact = liveItem.criticidade;
  const currentPriority = liveItem.moscow_categoria;
  const isHighlight = Boolean(liveItem.is_highlight_item);
  const retainedItems = snapshot?.working.items.map((i) => session ? analysisDisplayItem(session.getDfd(), i) : i).filter((i) => !i.remove) || [];
  const starCount = retainedItems.filter((i) => i.is_highlight_item).length;
  const starLimit = highlightLimit(retainedItems.length);
  const starBlocked = !isHighlight && starCount >= starLimit;
  const starHelp = `${starCount} de ${starLimit} estrelas nesta DFD. ${starCount > starLimit ? "Retire as estrelas excedentes para concluir o envio." : starCount >= starLimit ? "Para destacar outro item, retire uma estrela primeiro." : "Escolha os itens de maior relevância estratégica. O uso é opcional."}`;
  const starTitle = `${isHighlight ? "Retirar estrela" : "Destacar item"}. ${starHelp}`;

  // Map the persisted value to the visible slider steps (0 = pending).
  const impactIndex = currentImpact
    ? IMPACT_STEPS.findIndex((value) => value === currentImpact) + 1
    : 0;
  const priorityIndex = currentPriority
    ? PRIORITY_STEPS.findIndex((value) => value === currentPriority) + 1
    : 0;

  const updateClassification = (patch: Partial<AnalysisItem>) => {
    if (disabled) return;
    if (Object.entries(patch).every(([key, value]) => liveItem[key as keyof AnalysisItem] === value)) return;
    setTouched(true);
    session?.updateItem(liveItem.id, patch);
  };

  const handleImpactChange = (idx: number) => {
    const val = IMPACT_STEPS[idx - 1] || null;
    updateClassification({ criticidade: val });
  };

  const handlePriorityChange = (idx: number) => {
    const val = PRIORITY_STEPS[idx - 1] || null;
    updateClassification({ moscow_categoria: val });
  };

  const handleToggleHighlight = () => {
    if (disabled || starBlocked) return;
    setTouched(true);
    setStarMotion(isHighlight ? "off" : "on");
    session?.updateItem(liveItem.id, { is_highlight_item: !isHighlight });
  };

  const confirmRemoval = () => {
    const reason = removalReason.trim();
    if (reason.length < 3) {
      setRemovalError("Informe uma justificativa com pelo menos 3 caracteres.");
      return;
    }
    setRemovalDialogOpen(false);
    setRemovalError("");
    onRemoveRequest?.(dfdSummary.id, liveItem, reason);
  };

  const isPending = !currentImpact || !currentPriority;
  const isFirstItem = snapshot?.working.items[0]?.id === liveItem.id;
  const showSaveState = Boolean(
    snapshot &&
      (isFirstItem || touched) &&
      snapshot.saveState !== "Nenhuma alteração pendente",
  );
  const feedback = snapshot ? analysisSaveFeedback(snapshot) : null;
  const saveBadge = showSaveState && feedback ? (
    <span className={`aw-badge-save aw-save-${feedback.tone}`} role="status" aria-live="polite" title={snapshot?.error || snapshot?.saveState} aria-busy={feedback.saving}>
      {feedback.saving && <span className="aw-save-spinner" aria-hidden="true" />}
      {feedback.label}
    </span>
  ) : null;
  const displayImpactLabel = impactLabel(currentImpact);
  const displayPriorityLabel = priorityLabel(currentPriority);

  // Determine color-coded badge classes
  const impactBadgeClass =
    currentImpact === "baixa"
      ? "aw-pill-crit-baixa"
      : currentImpact === "media"
        ? "aw-pill-crit-media"
        : currentImpact === "alta"
          ? "aw-pill-crit-alta"
          : currentImpact === "critica"
            ? "aw-pill-crit-critica"
            : "aw-pill-neutral";

  const priorityBadgeClass =
    currentPriority === "nao_tera_agora"
      ? "aw-pill-prio-baixa"
      : currentPriority === "poderia_ter"
        ? "aw-pill-prio-media"
        : currentPriority === "deveria_ter"
          ? "aw-pill-prio-alta"
          : currentPriority === "deve_ter"
            ? "aw-pill-prio-essencial"
            : "aw-pill-neutral";

  if (collapsed && !liveItem.remove) {
    return (
      <div
        ref={rootRef}
        className="aw-inline-item aw-inline-item-compact"
        data-item-id={liveItem.id}
        data-pending={!liveItem.remove && isPending}
      >
        <button
          type="button"
          className="aw-item-compact-toggle"
          data-inline-item-toggle
          aria-expanded="false"
          aria-label={`Abrir classificação de ${liveItem.descricao}`}
          onClick={() => setCollapsed(false)}
        >
          <ChevronDown className="aw-item-compact-chevron" size={20} aria-hidden="true" />
          <span className="aw-item-compact-copy">
            <strong>{formatCatalogDisplayText(liveItem.descricao)}</strong>
            <small>{dfdSummary.numero_protocolo} · {liveItem.codigo_tce || "Sem código"} · Quantidade: {liveItem.quantidade} {liveItem.unidade_medida || "un."}</small>
            </span>
          <span className={`aw-item-compact-pill ${impactBadgeClass}`}>{currentImpact ? `Impacto · ${displayImpactLabel}` : "Impacto pendente"}</span>
          <span className={`aw-item-compact-pill ${priorityBadgeClass}`}>{currentPriority ? `Quando · ${displayPriorityLabel}` : "Quando atender pendente"}</span>
          <span className="aw-item-compact-value">{money(Number(liveItem.quantidade || 0) * Number(liveItem.valor_unitario_estimado || 0))}</span>
        </button>
        <div className="aw-item-compact-actions">
          {adminRemoval && onRemoveRequest && <button type="button" className="aw-menu-danger" disabled={removalDisabled} aria-label={`Retirar item ${liveItem.descricao}`} onClick={() => { setCollapsed(false); setRemovalReason(""); setRemovalDialogOpen(true); }}><Trash2 size={17} /> Retirar item</button>}
          <span className="aw-star-count" title={starHelp} role="status" aria-live="polite">{starCount}/{starLimit} estrelas</span>
          <button
            type="button"
            className={`aw-star-btn ${isHighlight ? "aw-star-active" : ""} ${starMotion ? `aw-star-motion-${starMotion}` : ""}`}
            onAnimationEnd={() => setStarMotion("")}
            title={starTitle}
            aria-label={starTitle}
            disabled={disabled || starBlocked}
            onClick={handleToggleHighlight}
            aria-pressed={isHighlight}
          >
            <Star size={18} fill={isHighlight ? "#f59e0b" : "none"} color={isHighlight ? "#f59e0b" : "#9ca3af"} />
          </button>
          <a
            href={`/dfd/${dfdSummary.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="aw-item-compact-open"
            aria-label={`Abrir DFD completa ${dfdSummary.numero_protocolo} em nova aba`}
            title="Abrir DFD completa"
          >
            <ExternalLink size={17} aria-hidden="true" />
          </a>
        </div>
        {savedEvaluations}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`aw-inline-item ${liveItem.remove ? "aw-item-removed" : ""}`}
      data-item-id={liveItem.id}
        data-pending={!liveItem.remove && isPending}
    >
      {/* Left Column: DFD & Item Information */}
      {savedEvaluations}
      <div className="aw-item-info">
        <div className="aw-item-badges">
          {isPending ? (
            <span className="aw-badge-pending">
              <span className="aw-pulse-dot" />
              Classificação pendente
            </span>
          ) : (
            <span className="aw-badge-ready">
              <CheckCircle2 size={12} aria-hidden="true" />
              Classificado
            </span>
          )}


          {liveItem.remove && (
            <span className="aw-badge-removal" title={liveItem.removalReason || "Justificativa registrada no rascunho"}>
              Retirada
            </span>
          )}
        </div>

        <h4 className="aw-item-title" title={liveItem.descricao}>
          {formatCatalogDisplayText(liveItem.descricao)}
        </h4>

        {(liveItem.justificativa_item || liveItem.local_uso) && (
          <p className="aw-item-description">
            {liveItem.justificativa_item || liveItem.local_uso}
          </p>
        )}

        <div className="aw-item-stats" aria-label="Detalhes do item">
          <div className="aw-item-stat">
            <span className="aw-item-stat-icon" aria-hidden="true"><Box size={19} /></span>
            <span className="aw-item-stat-copy">
              <span className="aw-item-stat-label">Quantidade</span>
              <strong className="aw-item-stat-value">{liveItem.quantidade} {liveItem.unidade_medida || "un."}</strong>
            </span>
          </div>
          <div className="aw-item-stat">
            <span className="aw-item-stat-icon" aria-hidden="true"><Tag size={19} /></span>
            <span className="aw-item-stat-copy">
              <span className="aw-item-stat-label">Preço unitário</span>
              <strong className="aw-item-stat-value">{money(Number(liveItem.valor_unitario_estimado || 0))}</strong>
            </span>
          </div>
          <div className="aw-item-stat">
            <span className="aw-item-stat-icon" aria-hidden="true"><Barcode size={19} /></span>
            <span className="aw-item-stat-copy">
              <span className="aw-item-stat-label">Código</span>
              <strong className="aw-item-stat-value">{liveItem.codigo_tce || "—"}</strong>
            </span>
          </div>
        </div>

        <a
          href={`/dfd/${dfdSummary.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="aw-badge-protocol"
          title={`Abrir DFD de origem ${dfdSummary.numero_protocolo}`}
          aria-label={`Abrir DFD completa ${dfdSummary.numero_protocolo} em nova aba`}
        >
          <span>{dfdSummary.numero_protocolo}</span>
          <ExternalLink size={14} className="aw-protocol-ext-icon" />
        </a>

        {(isFirstItem || touched) && snapshot?.ready && snapshot.dirty && (
          <div className="aw-item-save-row">
            <button
              type="button"
              className="aw-inline-save aw-inline-save-dirty"
              disabled={disabled || feedback?.saving}
              onClick={() => void session?.save().catch(() => {})}
              title="Salvar alteração desta DFD agora"
            >
              <Save size={14} aria-hidden="true" />
              {feedback?.saving ? "Salvando…" : snapshot.error ? "Tentar salvar novamente" : "Salvar alteração"}
            </button>
          </div>
        )}
      </div>

      {/* Decision sliders */}
      <div className="aw-item-decision">
        <div className="aw-decision-save-line">{saveBadge || <span>As decisões são salvas após uma breve pausa.</span>}</div>
        <p className="aw-star-guidance" role="status" aria-live="polite"><Star size={16} aria-hidden="true" /><span><strong>Destaques estratégicos · {starCount} de {starLimit} estrelas nesta DFD</strong><br />{starHelp} Limite: até 20% dos itens da DFD, arredondado para cima.</span></p>
        <button type="button" className="aw-item-collapse" onClick={() => setCollapsed(true)} aria-label={`Recolher avaliação de ${liveItem.descricao}`}>Recolher <ChevronDown size={14} aria-hidden="true" /></button>
        <div className="aw-slider-group">
          {/* Criticidade Slider */}
          <div className="aw-slider-row aw-decision-control aw-decision-impact">
            <div className="aw-decision-icon" aria-hidden="true"><BarChart3 size={22} /></div>
            <div className="aw-decision-content">
              <div className="aw-slider-title-row">
                <span className="aw-decision-heading">
                  <span className="aw-slider-name">Impacto se não atendido</span>
                  <small>Se este item não for comprado, o que acontece na unidade?</small>
                  <span className="aw-decision-meaning">Impacto da falta do item</span>
                </span>
                <span
                  className="aw-info-icon"
                  title="Consequência para as atividades da unidade caso o item não seja comprado."
                >
                  <Info size={12} />
                </span>
              </div>
              <span className={`aw-slider-current-val ${impactBadgeClass}`}>
                {displayImpactLabel}
              </span>
              <div className="aw-slider-track-container">
                <DecisionSlider value={impactIndex} disabled={Boolean(disabled)}
                  label={`Impacto se não atendido de ${liveItem.descricao}`} labels={impactDecisionCopy.map((step) => step.label)}
                  onCommit={handleImpactChange} onStart={() => session?.beginInteraction()} onEnd={() => session?.endInteraction()}
                  className={`aw-range-slider aw-slider-impact ${!currentImpact ? "aw-slider-idle" : ""}`} />
                <div className="aw-slider-labels">
                  {impactDecisionCopy.map(({ label, hint }, step) => (
                    <button
                      key={step}
                      type="button"
                      disabled={disabled}
                      className={`aw-slider-step-btn ${impactIndex === step ? "aw-step-active" : ""}`}
                      onClick={() => handleImpactChange(step)}
                      title={`Definir criticidade: ${label}`}
                    >
                      <span>{label}</span>
                      {hint && <small>{hint}</small>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Prioridade Slider */}
          <div className="aw-slider-row aw-decision-control aw-decision-priority">
            <div className="aw-decision-icon" aria-hidden="true"><Target size={22} /></div>
            <div className="aw-decision-content">
              <div className="aw-slider-title-row">
                <span className="aw-decision-heading">
                  <span className="aw-slider-name">Quando atender</span>
                  <small>Para a compra planejada do próximo ano, quanto este item precisa entrar?</small>
                  <span className="aw-decision-meaning">Necessidade de incluir no plano</span>
                </span>
                <span
                  className="aw-info-icon"
                  title="Necessidade de incluir o item na compra planejada: Postergado, Oportuno, Relevante ou Essencial."
                >
                  <Info size={12} />
                </span>
              </div>
              <span className={`aw-slider-current-val ${priorityBadgeClass}`}>
                {displayPriorityLabel}
              </span>
              <div className="aw-slider-track-container">
                <DecisionSlider value={priorityIndex} disabled={Boolean(disabled)}
                  label={`Quando atender ${liveItem.descricao}`} labels={priorityDecisionCopy.map((step) => step.label)}
                  onCommit={handlePriorityChange} onStart={() => session?.beginInteraction()} onEnd={() => session?.endInteraction()}
                  className={`aw-range-slider aw-slider-priority ${!currentPriority ? "aw-slider-idle" : ""}`} />
                <div className="aw-slider-labels">
                  {priorityDecisionCopy.map(({ label, hint }, step) => (
                    <button
                      key={step}
                      type="button"
                      disabled={disabled}
                      className={`aw-slider-step-btn ${priorityIndex === step ? "aw-step-active" : ""}`}
                      onClick={() => handlePriorityChange(step)}
                      title={`Definir prioridade: ${label}`}
                    >
                      <span>{label}</span>
                      {hint && <small>{hint}</small>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

        {/* Quick Actions: Star (Pareto) & More Menu */}
        <div className="aw-item-actions">
          {adminRemoval && onRemoveRequest && <button type="button" className="aw-menu-danger" disabled={removalDisabled} onClick={() => { setRemovalReason(""); setRemovalDialogOpen(true); }}><Trash2 size={17} /> Retirar item</button>}
          <button
            type="button"
            className={`aw-star-btn ${isHighlight ? "aw-star-active" : ""} ${starMotion ? `aw-star-motion-${starMotion}` : ""}`}
            onAnimationEnd={() => setStarMotion("")}
            title={starTitle}
            aria-label={starTitle}
            disabled={disabled || starBlocked}
            onClick={handleToggleHighlight}
            aria-pressed={isHighlight}
          >
            <Star
              size={18}
              fill={isHighlight ? "#f59e0b" : "none"}
              color={isHighlight ? "#f59e0b" : "#9ca3af"}
            />
          </button>
          <span className="aw-star-explanation">
            <strong>Destaque estratégico</strong>
            <small role="status" aria-live="polite">{starCount} de {starLimit} estrelas nesta DFD</small>
          </span>

          <div className="aw-menu-anchor">
            <button
              type="button"
              className="aw-more-btn"
              title="Mais ações do item"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} color="#6b7280" />
            </button>

            {menuOpen && (
              <div className="aw-dropdown-menu" role="menu">
                <a
                  href={`/dfd/${dfdSummary.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink size={14} />
                  Abrir DFD completa em nova aba
                </a>
                {onRemoveRequest && !liveItem.remove && (
                  <button
                    type="button"
                    role="menuitem"
                    className="aw-menu-danger"
                    onClick={() => {
                      setMenuOpen(false);
                      setRemovalReason(liveItem.removalReason || "");
                      setRemovalError("");
                      setRemovalDialogOpen(true);
                    }}
                  >
                    <Trash2 size={14} />
                    Retirar item
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {removalDialogOpen && (adminRemoval || !liveItem.remove) && (
        <div className="aw-inline-removal-dialog" role="dialog" aria-label="Retirar item">
          <div className="aw-inline-removal-copy">
            <strong>Retirar este item</strong>
            <span>{adminRemoval ? "A retirada será efetivada na DFD, com justificativa e histórico. As avaliações dos demais itens serão preservadas." : "A retirada será registrada no rascunho e exige uma justificativa."}</span>
          </div>
          <textarea
            className="aw-inline-removal-field"
            value={removalReason}
            maxLength={500}
            autoFocus
            onChange={(event) => {
              setRemovalReason(event.target.value);
              if (removalError) setRemovalError("");
            }}
            placeholder="Descreva por que este item deve ser retirado…"
            aria-label="Justificativa da retirada"
          />
          {removalError && <span className="aw-inline-removal-error" role="alert">{removalError}</span>}
          <div className="aw-inline-removal-actions">
            <button type="button" className="aw-inline-removal-cancel" onClick={() => setRemovalDialogOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="aw-inline-removal-confirm" disabled={removalDisabled} onClick={confirmRemoval}>
              <Trash2 size={14} /> Retirar item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
