import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMechanicalCharacterSequence,
  getMechanicalCharacterWidth,
  isMechanicalSpace,
} from "./mechanical-value.ts";

describe("buildMechanicalCharacterSequence", () => {
  it("termina sempre no caractere solicitado", () => {
    const sequence = buildMechanicalCharacterSequence("8", 0);
    assert.equal(sequence.at(-1), "8");
    assert.ok(sequence.length >= 5);
  });

  it("preserva espaços sem criar animação", () => {
    assert.deepEqual(buildMechanicalCharacterSequence(" ", 2), [" "]);
  });

  it("preserva espaços não quebráveis de valores monetários sem criar bloco largo", () => {
    assert.equal(isMechanicalSpace("\u00A0"), true);
    assert.deepEqual(buildMechanicalCharacterSequence("\u00A0", 2), [" "]);
  });

  it("usa larguras proporcionais para pontuação e espaços do letreiro horizontal", () => {
    assert.equal(getMechanicalCharacterWidth(","), "0.24em");
    assert.equal(getMechanicalCharacterWidth(" "), "0.34em");
    assert.equal(getMechanicalCharacterWidth("8"), "0.58em");
  });

  it("reserva largura suficiente para sufixos monetários como mi", () => {
    assert.equal(getMechanicalCharacterWidth("m"), "0.84em");
    assert.equal(getMechanicalCharacterWidth("i"), "0.34em");
  });

  it("reserva largura suficiente para prefixo monetário com R$ e espaços", () => {
    assert.equal(getMechanicalCharacterWidth("R"), "0.72em");
    assert.equal(getMechanicalCharacterWidth("$"), "0.68em");
    assert.equal(getMechanicalCharacterWidth(" "), "0.34em");
  });

  it("gera a mesma sequência para a mesma posição", () => {
    assert.deepEqual(
      buildMechanicalCharacterSequence("R", 3),
      buildMechanicalCharacterSequence("R", 3),
    );
  });
});
