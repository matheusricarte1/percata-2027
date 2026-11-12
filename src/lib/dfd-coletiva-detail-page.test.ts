import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const pageSource = readFileSync(
  path.join(process.cwd(), "src/app/(dashboard)/dfds-coletivas/[id]/page.tsx"),
  "utf8",
);

test("sala coletiva aberta mostra itens ja solicitados antes de o usuario contribuir", () => {
  assert.equal(pageSource.includes("RequestedRoomItemsPanel"), true);
  assert.match(
    pageSource,
    /activeStage === "adicionar"[\s\S]*<RequestedRoomItemsPanel[\s\S]*detail=\{detail\}[\s\S]*viewerUserId=\{viewerUserId\}/,
  );
  assert.match(
    pageSource,
    /function RequestedRoomItemsPanel[\s\S]*Itens já solicitados na sala[\s\S]*<ConsolidatedItemsTable[\s\S]*items=\{detail\.items\}/,
  );
});

test("clicar em Consolidar exige aviso de retorno bloqueado antes de encerrar coautoria", () => {
  assert.match(
    pageSource,
    /function requestConsolidationAdvance\(\)[\s\S]*setShowConsolidationWarning\(true\)/,
  );
  assert.match(
    pageSource,
    /<SelectionFloatingBar[\s\S]*onContinue=\{\(\) => \{\s*requestConsolidationAdvance\(\);[\s\S]*<SelectedItemDrawer/,
  );
  assert.match(
    pageSource,
    /<ConsolidationWarningModal[\s\S]*Depois de consolidar, a sala não volta automaticamente para a etapa anterior/,
  );
});

test("etapa de consolidacao mostra uma acao explicita para chefia concluir o recorte", () => {
  assert.match(
    pageSource,
    /<ConsolidationPanel[\s\S]*canManageConsolidation=\{canEdit\}/,
  );
  assert.match(
    pageSource,
    /function ConsolidationPanel[\s\S]*canManageConsolidation[\s\S]*Ação da chefia[\s\S]*Concluir consolidação e abrir prévia/,
  );
});

test("etapa de consolidacao mostra acoes por item para confirmar editar e devolver", () => {
  assert.match(
    pageSource,
    /<ConsolidatedItemsTable[\s\S]*canManageConsolidation=\{canManageConsolidation\}[\s\S]*onOpenGovernanceAction=\{onOpenGovernanceAction\}/,
  );
  assert.match(
    pageSource,
    /function ItemGovernanceActions[\s\S]*Confirmar[\s\S]*Editar[\s\S]*Devolver/,
  );
  assert.match(
    pageSource,
    /function CollectiveItemGovernanceModal[\s\S]*Confirmada pela chefia[\s\S]*name="quantidade"[\s\S]*name="valor_unitario_estimado"[\s\S]*name="return_comment"/,
  );
});

test("devolver item aciona endpoint de contribuicao com comentario para correcao", () => {
  assert.match(
    pageSource,
    /function submitGovernanceAction[\s\S]*action: governanceModal\.mode[\s\S]*return_comment: form\.get\("return_comment"\)[\s\S]*return_fields: form\.getAll\("return_fields"\)/,
  );
  assert.match(
    pageSource,
    /fetch\(`\/api\/collective-rooms\/\$\{roomId\}\/contributions\/\$\{contributionId\}`[\s\S]*method: "PATCH"/,
  );
  assert.match(
    pageSource,
    /RETURN_FIELD_OPTIONS[\s\S]*id: "quantidade"[\s\S]*id: "valor_unitario_estimado"[\s\S]*id: "justificativa_item"[\s\S]*id: "link_referencia"[\s\S]*name="return_fields"/,
  );
});

test("usuario afetado por devolucao recebe painel para corrigir a propria contribuicao", () => {
  assert.match(
    pageSource,
    /function ReturnedContributionCorrectionPanel[\s\S]*Correções solicitadas[\s\S]*Enviar correção/,
  );
  assert.match(
    pageSource,
    /function saveReturnedContributionCorrection[\s\S]*action: "edit"/,
  );
  assert.match(
    pageSource,
    /function saveReturnedContributionCorrection[\s\S]*fetch\(`\/api\/collective-rooms\/\$\{roomId\}\/contributions\/\$\{contributionId\}`/,
  );
  assert.match(
    pageSource,
    /contribution\.user_id === viewerUserId[\s\S]*String\(contribution\.status \|\| ""\) === "devolvida"/,
  );
  assert.match(
    pageSource,
    /function readReturnInstruction[\s\S]*event\.metadata[\s\S]*return_comment[\s\S]*return_fields/,
  );
  assert.match(
    pageSource,
    /returnInstructionsByContributionId[\s\S]*readReturnInstruction\(event\)/,
  );
  assert.match(
    pageSource,
    /function ReturnedContributionCorrectionPanel[\s\S]*Comentário da chefia[\s\S]*Campos solicitados/,
  );
});

test("consolidacao nao avanca enquanto existir item devolvido para correcao", () => {
  assert.match(
    pageSource,
    /hasReturnedContributions[\s\S]*String\(contribution\.status \|\| ""\) === "devolvida"/,
  );
  assert.match(
    pageSource,
    /disabled=\{updatingStatus \|\| detail\.items\.length === 0 \|\| hasReturnedContributions\}/,
  );
});

test("chefia visualiza correcoes recebidas apos usuario reenviar item devolvido", () => {
  assert.match(
    pageSource,
    /correctedContributions[\s\S]*event\.event_type === "contribution_corrected"[\s\S]*contribution\.status \|\| ""\) === "aberta"/,
  );
  assert.match(
    pageSource,
    /function CorrectedContributionReviewPanel[\s\S]*Correções recebidas[\s\S]*Revisar correção/,
  );
  assert.match(
    pageSource,
    /<CorrectedContributionReviewPanel[\s\S]*canManageConsolidation=\{canManageConsolidation\}/,
  );
});

test("itens devolvidos mostram aviso visual e bloqueio contextual para a chefia", () => {
  assert.match(
    pageSource,
    /const returnedContributionKeys = useMemo[\s\S]*String\(contribution\.status \|\| ""\) === "devolvida"[\s\S]*buildCollectiveContributionKey\(contribution\)/,
  );
  assert.match(
    pageSource,
    /<ConsolidatedItemsTable[\s\S]*returnedContributionKeys=\{returnedContributionKeys\}/,
  );
  assert.match(
    pageSource,
    /function PendingCorrectionNotice[\s\S]*Aguardando correção[\s\S]*Este item foi devolvido pela chefia/,
  );
  assert.match(
    pageSource,
    /function CollectiveItemGovernanceModal[\s\S]*pendingReturnedContributions[\s\S]*Este item foi devolvido e ainda aguarda correção/,
  );
});

test("correcao recebida exibe comparacao visual do antes e depois", () => {
  assert.match(
    pageSource,
    /function readCorrectionComparison[\s\S]*return_snapshot[\s\S]*correction_snapshot/,
  );
  assert.match(
    pageSource,
    /const correctionComparisonsByContributionId = useMemo[\s\S]*readCorrectionComparison\(event\)/,
  );
  assert.match(
    pageSource,
    /function CorrectionComparisonPanel[\s\S]*O que mudou na correção[\s\S]*Antes[\s\S]*Agora/,
  );
  assert.match(
    pageSource,
    /<CorrectedContributionReviewPanel[\s\S]*correctionComparisonsByContributionId=\{correctionComparisonsByContributionId\}/,
  );
});

test("catalogo da sala coletiva resolve item misto em variantes corrente e capital antes de salvar", () => {
  assert.match(
    pageSource,
    /function addMixedExpenseClassVariantsToCart[\s\S]*\["custeio", "investimento"\]/,
  );
  assert.match(
    pageSource,
    /function addCatalogItemToCart[\s\S]*const fiscalIssue = getCatalogFiscalIssue\(/,
  );
  assert.match(
    pageSource,
    /if \(fiscalIssue === "mixed_expense_classes"\)[\s\S]*addMixedExpenseClassVariantsToCart\(item, options\)/,
  );
  assert.match(
    pageSource,
    /toast\.success\("Item misto adicionado em corrente e capital\. A DFD coletiva será separada em duas DFDs na conversão\."/,
  );
});

test("superadmin ve alternativas fiscais e pode ajustar GND e codigo na etapa final", () => {
  assert.match(
    pageSource,
    /<ApprovalSummary[\s\S]*actorRole=\{detail\.room\.actor_role\}/,
  );
  assert.match(
    pageSource,
    /function FiscalAlternativesPanel[\s\S]*Possibilidades de troca fiscal[\s\S]*codigo_efisco[\s\S]*codigo_natureza_despesa[\s\S]*gnd/,
  );
  assert.match(
    pageSource,
    /const canEditFiscal =[\s\S]*detail\?\.room\.actor_role === "admin" \|\| detail\?\.room\.actor_role === "superadmin"[\s\S]*canEditFiscal=\{canEditFiscal\}/,
  );
  assert.match(
    pageSource,
    /name="codigo_item_efisco"[\s\S]*name="codigo_natureza_despesa"[\s\S]*name="gnd"/,
  );
});

test("consolidacao mostra botao explicito para confirmar classe e codigo fiscal", () => {
  assert.match(
    pageSource,
    /<ConsolidatedItemsTable[\s\S]*canEditFiscal=\{canEditFiscal\}/,
  );
  assert.match(
    pageSource,
    /function ItemGovernanceActions[\s\S]*Confirmar fiscal[\s\S]*onAction\?\.\("edit", item\)/,
  );
  assert.match(
    pageSource,
    /Ajuste fiscal do superusuário[\s\S]*Confirmar corrente, capital e código e-Fisco/,
  );
});
