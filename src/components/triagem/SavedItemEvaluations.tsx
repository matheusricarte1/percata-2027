"use client";

import { useState } from "react";
import { impactLabel, priorityLabel, type AnalysisEvaluation, type AnalysisEvaluator } from "@/lib/dfd-analysis";

export function EvaluationAuthor({ evaluator }: { evaluator: AnalysisEvaluator }) {
  const [broken, setBroken] = useState(false);
  return <span className="aw-evaluation-author" title={evaluator.name}>
    {evaluator.avatarUrl && !broken ? <img key={evaluator.avatarUrl} src={evaluator.avatarUrl} width={20} height={20} alt={`Foto de ${evaluator.name}`} onError={() => setBroken(true)} /> : <span className="aw-evaluation-initials" aria-hidden="true">{evaluator.name.trim().split(/\s+/).slice(0, 2).map((name) => name[0]).join("")}</span>}
    <span>{evaluator.name}</span>
  </span>;
}

export function SavedItemEvaluations({ evaluations = [], itemId, revision }: { evaluations?: AnalysisEvaluation[]; itemId: string; revision: string }) {
  const entries = evaluations.flatMap((evaluation) => {
    const item = evaluation.items.find((entry) => entry.id === itemId);
    return item ? [{ evaluation, item }] : [];
  });
  if (!entries.length) return null;
  return <section className="aw-saved-evaluations" aria-label="Avaliações salvas pela chefia">
    <strong>Avaliação salva pela chefia · consulta</strong>
    {entries.map(({ evaluation, item }) => <div className="aw-saved-evaluation" key={evaluation.actorId}>
      <EvaluationAuthor evaluator={evaluation} />
      <span>Impacto: <b>{impactLabel(item.criticidade)}</b> · Quando atender: <b>{priorityLabel(item.moscow_categoria)}</b> · Quantidade: {item.quantidade}</span>
      {item.is_highlight_item && <span>Item em destaque</span>}
      {item.remove && <span>Retirada proposta: {item.removalReason || "Motivo não informado"}</span>}
      {item.correctionNote && <span>Orientação: {item.correctionNote}</span>}
      <small>Salva em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" }).format(new Date(evaluation.updatedAt))} · Aguardando envio{evaluation.baseRevision !== revision ? " · A DFD mudou após esta avaliação; confira a revisão" : ""}</small>
    </div>)}
  </section>;
}
