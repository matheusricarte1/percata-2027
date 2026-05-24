import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeComparableText,
  parseLocalDateTimeToIso,
  sanitizeEmail,
  sanitizePlainText,
  sanitizeUiLabel,
  sanitizeUiMessage,
  sanitizeUuid,
  validateDateRange,
} from "./settings-sanitize.ts";

describe("settings-sanitize", () => {
  it("removes control characters and limits plain text", () => {
    assert.equal(sanitizePlainText("  Direção\u0000\n Geral  ", 12), "Direção Gera");
  });

  it("normalizes text for duplicate detection", () => {
    assert.equal(normalizeComparableText(" Coordenação  Administrativa "), "coordenacao administrativa");
  });

  it("validates emails and uuids", () => {
    assert.equal(sanitizeEmail(" USER@UPE.BR "), "user@upe.br");
    assert.equal(sanitizeEmail("not-email"), "");
    assert.equal(sanitizeUuid("0b8daa36-0a77-4432-9482-b9bc44852fb0"), "0b8daa36-0a77-4432-9482-b9bc44852fb0");
    assert.equal(sanitizeUuid("drop table"), "");
  });

  it("validates date ranges", () => {
    const start = parseLocalDateTimeToIso("2026-05-06T10:00");
    const end = parseLocalDateTimeToIso("2026-05-06T09:00");

    assert.equal(validateDateRange(start, end).ok, false);
    assert.equal(validateDateRange(start, null).ok, true);
  });

  it("sanitizes ui labels and messages", () => {
    assert.equal(sanitizeUiLabel("  Configurações\nAdmin  ", 14), "Configurações");
    assert.equal(sanitizeUiMessage("Erro\u0000 interno\n\n", 20), "Erro interno");
  });
});
