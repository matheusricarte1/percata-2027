import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateCollectiveContributions,
  buildCollectiveContributionKey,
  canContributeCollectiveRoom,
  canConvertCollectiveRoom,
  canEditCollectiveContribution,
  canEditCollectiveRoom,
  canPublishCollectiveRoom,
  canReopenCollectiveRoom,
  parseCollectiveDistributionText,
  splitCollectiveItemsByExpenseClass,
  stripCollectiveContributionProfileFields,
  summarizeCollectiveRoom,
  validateCollectiveUnitScope,
} from "./collective-dfd.ts";

describe("collective-dfd", () => {
  it("aggregates equal items from the same unit and preserves quantities per user", () => {
    const result = aggregateCollectiveContributions([
      {
        unit_id: "dept-1",
        unit_type: "departamento",
        user_id: "user-1",
        user_name: "Maria",
        codigo_item_efisco: "123",
        codigo_tce: "123",
        descricao: "TELEVISOR 85",
        quantidade: 2,
        valor_unitario_estimado: 1000,
        gnd: "4.4.90.52",
      },
      {
        unit_id: "dept-1",
        unit_type: "departamento",
        user_id: "user-2",
        user_name: "Joao",
        codigo_item_efisco: "123",
        codigo_tce: "123",
        descricao: "TELEVISOR 85",
        quantidade: 1,
        valor_unitario_estimado: 1200,
        gnd: "4.4.90.52",
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].quantidade, 3);
    assert.equal(result[0].valor_unitario_estimado, 1200);
    assert.equal(result[0].contributors.length, 2);
    assert.deepEqual(
      result[0].contributors.map((entry) => ({
        user_id: entry.user_id,
        quantidade: entry.quantidade,
      })),
      [
        { user_id: "user-1", quantidade: 2 },
        { user_id: "user-2", quantidade: 1 },
      ],
    );
  });

  it("keeps custeio and capital contributions in different aggregate keys", () => {
    const capital = buildCollectiveContributionKey({
      codigo_item_efisco: "123",
      codigo_tce: "123",
      descricao: "TELEVISOR",
      quantidade: 1,
      gnd: "4.4.90.52",
    });
    const custeio = buildCollectiveContributionKey({
      codigo_item_efisco: "123",
      codigo_tce: "123",
      descricao: "TELEVISOR",
      quantidade: 1,
      gnd: "3.3.90.30",
    });

    assert.notEqual(capital, custeio);
  });

  it("strips profile-only fields before database writes", () => {
    const row = stripCollectiveContributionProfileFields({
      user_id: "user-1",
      user_name: "Ana",
      user_email: "ana@example.edu",
      user_avatar_url: "https://example.edu/ana.png",
      codigo_item_efisco: "426654-4",
      descricao: "Camisa em malha",
    });

    assert.equal("user_name" in row, false);
    assert.equal("user_email" in row, false);
    assert.equal(row.user_avatar_url, "https://example.edu/ana.png");
  });

  it("rejects collective generation across different units", () => {
    assert.throws(
      () =>
        validateCollectiveUnitScope([
          { unit_id: "dept-1", unit_type: "departamento" },
          { unit_id: "lab-1", unit_type: "laboratorio" },
        ]),
      /mesmo setor\/laboratorio/i,
    );
  });

  it("parses the saved per-user distribution for chefia summary", () => {
    const result = parseCollectiveDistributionText(
      "Uso comum do laboratorio.\n\nDistribuição por usuário: Maria Silva: 2; Joao: 1,5; Ana: 3 un.",
    );

    assert.deepEqual(result, [
      { name: "Maria Silva", quantidade: 2 },
      { name: "Joao", quantidade: 1.5 },
      { name: "Ana", quantidade: 3 },
    ]);
  });

  it("lets proposal owners edit only their own proposal metadata", () => {
    assert.equal(canEditCollectiveRoom("proposta", "membro", { isProposalOwner: true }), true);
    assert.equal(canEditCollectiveRoom("proposta", "membro", { isProposalOwner: false }), false);
    assert.equal(canEditCollectiveRoom("proposta", "chefia"), true);
  });

  it("allows only chefia-like roles to control room lifecycle after publication", () => {
    assert.equal(canEditCollectiveRoom("aberta", "membro"), false);
    assert.equal(canEditCollectiveRoom("aberta", "chefia"), true);
    assert.equal(canEditCollectiveRoom("convertida", "chefia"), false);
    assert.equal(canEditCollectiveRoom("arquivada", "admin"), true);
  });

  it("enforces publish, reopen and convert authority on the lifecycle", () => {
    assert.equal(canPublishCollectiveRoom("proposta", "chefia"), true);
    assert.equal(canPublishCollectiveRoom("proposta", "membro"), false);
    assert.equal(canReopenCollectiveRoom("em_consolidacao_chefia", "chefia"), true);
    assert.equal(canReopenCollectiveRoom("pronta_para_conversao", "chefia"), true);
    assert.equal(canReopenCollectiveRoom("aberta", "chefia"), false);
    assert.equal(canConvertCollectiveRoom("pronta_para_conversao", "chefia"), true);
    assert.equal(canConvertCollectiveRoom("em_consolidacao_chefia", "chefia"), false);
  });

  it("allows contributions only while the room is open", () => {
    assert.equal(canContributeCollectiveRoom("aberta", "membro"), true);
    assert.equal(canContributeCollectiveRoom("proposta", "membro"), false);
    assert.equal(canContributeCollectiveRoom("em_consolidacao_chefia", "membro"), false);
  });

  it("allows members to edit only their own open contributions", () => {
    assert.equal(
      canEditCollectiveContribution({
        roomStatus: "aberta",
        actorRole: "membro",
        actorId: "user-1",
        ownerId: "user-1",
      }),
      true,
    );
    assert.equal(
      canEditCollectiveContribution({
        roomStatus: "aberta",
        actorRole: "membro",
        actorId: "user-1",
        ownerId: "user-2",
      }),
      false,
    );
    assert.equal(
      canEditCollectiveContribution({
        roomStatus: "em_consolidacao_chefia",
        actorRole: "chefia",
        actorId: "chefia-1",
        ownerId: "user-2",
      }),
      true,
    );
    assert.equal(
      canEditCollectiveContribution({
        roomStatus: "pronta_para_conversao",
        actorRole: "chefia",
        actorId: "chefia-1",
        ownerId: "user-2",
      }),
      true,
    );
    assert.equal(
      canEditCollectiveContribution({
        roomStatus: "convertida",
        actorRole: "chefia",
        actorId: "chefia-1",
        ownerId: "user-2",
      }),
      false,
    );
  });

  it("summarizes participants with avatar and user contribution marker", () => {
    const summary = summarizeCollectiveRoom([
      {
        user_id: "user-1",
        user_name: "Maria",
        user_email: "maria@example.edu",
        user_avatar_url: "https://example.edu/maria.jpg",
        codigo_item_efisco: "123",
        descricao: "Projetor",
        quantidade: 2,
        valor_unitario_estimado: 1000,
        gnd: "4.4.90.52",
      },
      {
        user_id: "user-2",
        user_name: "Joao",
        codigo_item_efisco: "123",
        descricao: "Projetor",
        quantidade: 1,
        valor_unitario_estimado: 1200,
        gnd: "4.4.90.52",
      },
    ], "user-1");

    assert.equal(summary.participantCount, 2);
    assert.equal(summary.itemCount, 1);
    assert.equal(summary.totalQuantity, 3);
    assert.equal(summary.totalValue, 3600);
    assert.equal(summary.userHasContributed, true);
    assert.deepEqual(summary.participants[0], {
      user_id: "user-1",
      user_name: "Maria",
      user_email: "maria@example.edu",
      user_avatar_url: "https://example.edu/maria.jpg",
      quantidade: 2,
      total: 2000,
    });
  });

  it("splits aggregated items by expense class for official DFD conversion", () => {
    const aggregated = aggregateCollectiveContributions([
      {
        unit_id: "dept-1",
        unit_type: "departamento",
        user_id: "user-1",
        codigo_item_efisco: "111",
        descricao: "Papel A4",
        quantidade: 5,
        valor_unitario_estimado: 30,
        gnd: "3.3.90.30",
      },
      {
        unit_id: "dept-1",
        unit_type: "departamento",
        user_id: "user-1",
        codigo_item_efisco: "222",
        descricao: "Notebook",
        quantidade: 1,
        valor_unitario_estimado: 4500,
        gnd: "4.4.90.52",
      },
    ]);

    const groups = splitCollectiveItemsByExpenseClass(aggregated);

    assert.deepEqual(
      groups.map((group) => [group.expenseClass, group.label, group.items.length]),
      [
        ["custeio", "Custeio", 1],
        ["investimento", "Investimento", 1],
      ],
    );
  });
});
