import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedUnit, validateCollectiveContribution } from "./collective-contribution-validation";

test("permite contribuição sem base de cálculo para complementação posterior da chefia", () => {
    assert.deepEqual(
      validateCollectiveContribution({
        quantidade: 48,
        valor_unitario_estimado: 8,
        unidade_medida: "CX",
        justificativa_item: "Higienização das superfícies.",
        justificativa_quantidade: "",
      }),
      [],
    );
});

test("aceita unidades de embalagem e preserva a unidade informada", () => {
    assert.equal(isSupportedUnit("CX"), true);
    assert.equal(isSupportedUnit("PCT"), true);
    assert.deepEqual(
      validateCollectiveContribution({
        quantidade: 6,
        valor_unitario_estimado: 25,
        unidade_medida: "PCT",
        justificativa_item: "Higienização das mãos.",
        justificativa_quantidade: "Um pacote por mês durante seis meses.",
      }),
      [],
    );
});
