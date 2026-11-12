import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canCreateWithSubmissionState, canRequesterEditDfd, formatSubmissionDeadline, isSubmissionWindowOpen, parseBahiaDateTime, type SubmissionState } from "./submission-policy.ts";

describe("encerramento das submissões", () => {
  it("aceita a autorização permanente do servidor e mantém os prazos dos demais perfis", () => {
    const now = Date.parse("2026-10-06T12:00:00Z");
    const state: SubmissionState = { cycle: { id: "cycle", name: "2027", startsAt: "2026-07-01T03:00:00Z", closesAt: "2026-10-03T03:00:00Z", chefiaClosesAt: null }, open: false, canCreate: true, superadminAccess: true, exception: null, correction: null, canEditDfd: false, serverNow: new Date(now).toISOString() };
    assert.equal(canCreateWithSubmissionState(state, now), true);
    assert.equal(canCreateWithSubmissionState({ ...state, canCreate: false }, now), false);
    assert.equal(canCreateWithSubmissionState({ ...state, superadminAccess: false }, now), false);
    assert.equal(canCreateWithSubmissionState({ ...state, superadminAccess: false, exception: { id: "permission", reason: "Autorizado", expires_at: "2026-10-07T03:00:00Z" } }, now), true);
    assert.equal(canCreateWithSubmissionState(null, now), false);
  });
  const start = "2026-07-13T03:00:00Z", end = "2026-10-03T03:00:00Z";
  it("inclui o último instante de 02/10 na Bahia e bloqueia à meia-noite", () => {
    assert.equal(isSubmissionWindowOpen(start, end, Date.parse(end) - 1), true);
    assert.equal(isSubmissionWindowOpen(start, end, Date.parse(end)), false);
    assert.equal(isSubmissionWindowOpen(start, end, Date.parse(start) - 1), false);
    assert.equal(isSubmissionWindowOpen(start, "invalid", Date.now()), false);
    assert.equal(formatSubmissionDeadline(end), "02/10/2026, 23:59");
  });
  it("preserva devoluções e limita autorização de diálogo ao proprietário", () => {
    const input = { owner: true, status: "rascunho", canCreate: false, correction: false };
    assert.equal(canRequesterEditDfd(input), false);
    assert.equal(canRequesterEditDfd({ ...input, status: "devolvida" }), true);
    assert.equal(canRequesterEditDfd({ ...input, status: "triagem" }), false);
    assert.equal(canRequesterEditDfd({ ...input, status: "triagem", correction: true }), true);
    assert.equal(canRequesterEditDfd({ ...input, owner: false, status: "devolvida" }), false);
    for (const status of ["aprovada", "concluida", "pactuando"]) {
      assert.equal(canRequesterEditDfd({ ...input, status, canCreate: true, correction: true }), false);
    }
  });
  it("interpreta validade no horário da Bahia independentemente do navegador", () => {
    assert.equal(parseBahiaDateTime("2026-10-05T18:00"), "2026-10-05T21:00:00.000Z");
    assert.equal(parseBahiaDateTime("2026-02-30T18:00"), null);
    assert.equal(parseBahiaDateTime("2026-10-05"), null);
  });
});
