"use client";
import { CheckCircle2 } from "@/components/icons/lucide/exports/CheckCircle2";
import { Send } from "@/components/icons/lucide/exports/Send";
import type { AnalysisGroupProgress } from "@/lib/dfd-analysis-queue";
import { EvaluationAuthor } from "./SavedItemEvaluations";

export function AnalysisGroupStatus({ group, busy, calendarOpen, onSend, onSendMedian }: { group: AnalysisGroupProgress; busy: boolean; calendarOpen: boolean; onSend: (group: AnalysisGroupProgress) => void; onSendMedian?: (group: AnalysisGroupProgress) => void }) {
  const complete = group.total > 0 && group.sent === group.total;
  const evaluated = group.pending === 0 && group.total > 0;
  const evaluators = [...new Map(group.dfds.flatMap((dfd) => dfd.evaluator ? [[dfd.evaluator.actorId, dfd.evaluator] as const] : [])).values()];
  const pendingItems = group.pendingItems;
  return <div className="aw-sector-completion-bar" role="status" aria-live="polite">
    <div>
      <strong>{complete ? <><CheckCircle2 size={17} aria-hidden="true" /> Tudo concluído neste grupo</> : evaluated ? "Avaliação completa — pronta para encaminhamento" : `${group.sent} de ${group.total} DFD(s) encaminhada(s)`}</strong>
      <p>{complete ? "100% avaliado · Encaminhado à consolidação. A etapa da chefia foi concluída." : `${group.ready} pronta(s) para enviar · ${group.pending} com pendências. As avaliações completas são encaminhadas automaticamente ao salvar.`}</p>
      {pendingItems !== undefined && <p>{group.items} itens · {group.evaluatedItems ?? group.items - pendingItems} avaliados · {pendingItems} {pendingItems === 1 ? "item pendente de avaliação" : "itens pendentes de avaliação"}</p>}
      {evaluators.length > 0 && <div className="aw-sector-evaluators">Avaliado por {evaluators.map((evaluator) => <EvaluationAuthor key={evaluator.actorId} evaluator={evaluator} />)}</div>}
      {!complete && !calendarOpen && !onSendMedian && <p>O período de envio está fechado. As avaliações permanecem salvas.</p>}
    </div>
    <div>
    <button type="button" className="aw-sector-send" disabled={busy || complete || (!calendarOpen && !onSendMedian) || group.ready === 0} onClick={() => onSend(group)}>
      {complete ? <CheckCircle2 size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
      {complete ? "Envio concluído" : busy ? "Encaminhando…" : `Enviar ${group.ready} DFD(s) pronta(s)`}
    </button>
    {onSendMedian && !complete && group.pending > 0 && <>
      <p>Avaliações completas serão preservadas. Somente os itens pendentes receberão nota 10.</p>
      <button type="button" className="aw-sector-send" disabled={busy} onClick={() => onSendMedian(group)}>
        <Send size={16} aria-hidden="true" /> Enviar {group.total - group.sent} DFD(s){pendingItems !== undefined ? ` · nota 10 em ${pendingItems} ${pendingItems === 1 ? "item pendente" : "itens pendentes"}` : " · nota 10 nos itens pendentes"}
      </button>
    </>}
    </div>
  </div>;
}

