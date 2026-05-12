import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDfdSignaturePayload,
  buildDfdVerificationUrl,
  computeDfdSignature,
  isValidDfdSignature,
} from "./dfd-signature.ts";

describe("dfd-signature", () => {
  it("builds SHA-256 signatures in the expected public format", () => {
    const signature = computeDfdSignature("DFD|PERCATA|001");

    assert.equal(signature.length, 64);
    assert.equal(isValidDfdSignature(signature), true);
    assert.equal(isValidDfdSignature("assinatura indisponível"), false);
  });

  it("builds the public verification URL used by QR Codes", () => {
    const signature = computeDfdSignature("DFD|PERCATA|002");

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
    assert.equal(isValidDfdSignature(computeDfdSignature(payload)), true);
  });
});
