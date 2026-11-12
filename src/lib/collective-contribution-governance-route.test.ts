import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const routeSource = readFileSync(
  path.join(
    process.cwd(),
    "src/app/api/collective-rooms/[id]/contributions/[contributionId]/route.ts",
  ),
  "utf8",
);

test("rota de contribuicao suporta confirmar e devolver com notificacao ao usuario afetado", () => {
  assert.match(routeSource, /action === "confirm"/);
  assert.match(routeSource, /action === "return_for_correction"/);
  assert.match(routeSource, /action === "confirm"[\s\S]*patch\.status = "consolidada"/);
  assert.match(routeSource, /return_comment/);
  assert.match(routeSource, /sanitizeReturnFields\(body\.return_fields\)/);
  assert.match(routeSource, /returnFields\.length === 0[\s\S]*Informe ao menos um campo para correcao/);
  assert.match(routeSource, /return_fields: returnFields/);
  assert.match(routeSource, /from\("notifications"\)[\s\S]*contribution\.user_id[\s\S]*Corrigir item da DFD coletiva/);
  assert.match(routeSource, /\.select\("id"\)[\s\S]*sendQueuedNotificationEmail\(/);
  assert.match(routeSource, /template_key: "dfd_returned"/);
});

test("correcao de item devolvido sai do loop mesmo quando o autor tambem e chefia", () => {
  assert.match(
    routeSource,
    /const isReturnedContributionCorrection =[\s\S]*action === "edit"[\s\S]*contribution\.status === "devolvida"[\s\S]*contribution\.user_id === actor\.id/,
  );
  assert.match(
    routeSource,
    /if \(isReturnedContributionCorrection\) \{[\s\S]*patch\.status = "aberta"/,
  );
  assert.match(
    routeSource,
    /const isChefiaGovernanceEdit = isChefia && !isReturnedContributionCorrection/,
  );
  assert.match(
    routeSource,
    /isReturnedContributionCorrection[\s\S]*\? "contribution_corrected"/,
  );
});

test("devolucao e correcao registram snapshots para comparacao visual", () => {
  assert.match(
    routeSource,
    /function buildContributionSnapshot[\s\S]*quantidade[\s\S]*valor_unitario_estimado[\s\S]*justificativa_item[\s\S]*link_referencia/,
  );
  assert.match(
    routeSource,
    /return_snapshot: action === "return_for_correction"[\s\S]*buildContributionSnapshot\(contribution\)/,
  );
  assert.match(
    routeSource,
    /correction_snapshot: isReturnedContributionCorrection[\s\S]*buildContributionSnapshot\(updated\)/,
  );
});

test("edicao de governanca permite ajustar codigo e natureza fiscal antes da conversao", () => {
  assert.match(routeSource, /codigo_item_efisco/);
  assert.match(routeSource, /codigo_natureza_despesa/);
  assert.match(routeSource, /gnd_derivado/);
  assert.match(routeSource, /actorCanEditFiscal = isAdminActor\(actor\)/);
  assert.match(routeSource, /collective_key[\s\S]*buildCollectiveContributionKey/);
});
