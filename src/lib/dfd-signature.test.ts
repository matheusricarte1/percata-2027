import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDfdSignaturePayload,
  buildDfdVerificationUrl,
  canAcceptLegacyDfdSignature,
  computeLegacyDfdSignature,
  computeDfdSignature,
  isValidDfdSignature,
} from "./dfd-signature.ts";

describe("dfd-signature", () => {
  it("builds HMAC-SHA-256 signatures in the expected public format", () => {
    const signature = computeDfdSignature("DFD|PERCATA|001", "test-secret");

    assert.equal(signature.length, 64);
    assert.equal(isValidDfdSignature(signature), true);
    assert.equal(isValidDfdSignature("assinatura indisponível"), false);
  });

  it("changes the signature when the server secret changes", () => {
    const payload = "DFD|PERCATA|001";

    assert.notEqual(
      computeDfdSignature(payload, "secret-a"),
      computeDfdSignature(payload, "secret-b"),
    );
  });

  it("keeps legacy checksum support only for DFDs created before public hardening", () => {
    const payload = "DFD|PERCATA|legacy";

    assert.equal(isValidDfdSignature(computeLegacyDfdSignature(payload)), true);
    assert.equal(canAcceptLegacyDfdSignature("2026-05-13T17:13:35.000Z"), true);
    assert.equal(canAcceptLegacyDfdSignature("2026-05-13T17:13:36.000Z"), false);
  });

  it("builds the public verification URL used by QR Codes", () => {
    const signature = computeDfdSignature("DFD|PERCATA|002", "test-secret");

    const url = buildDfdVerificationUrl({
      origin: "https://percata.upe.br/",
      id: "dfd-123",
      signature,
    });

    assert.equal(
      url,
      `https://percata.upe.br/verificar-dfd?id=dfd-123&sig=${signature}`,
    );
  });

  it("does not depend on a dfds.updated_at column", () => {
    const payload = buildDfdSignaturePayload(
      {
        id: "dfd-123",
        numero_protocolo: "DFD-2026-001",
        solicitante_id: "user-1",
        status: "rascunho",
        valor_total_estimado: 100,
        previsao_recebimento: "2026-06-01",
      },
      [],
    );

    assert.equal(payload.includes("updated_at"), false);
    assert.equal(isValidDfdSignature(computeDfdSignature(payload, "test-secret")), true);
  });
});
