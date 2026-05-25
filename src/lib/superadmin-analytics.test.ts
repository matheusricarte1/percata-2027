import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectPriceOutliers,
  linearRegression,
  toYearMonth,
  type PriceObservation,
} from "./superadmin-analytics.ts";

describe("superadmin-analytics", () => {
  it("normalizes ISO dates to year-month key", () => {
    const key = toYearMonth("2026-05-25T13:10:00.000Z");
    assert.equal(key, "2026-05");
  });

  it("computes upward trend with predicted next value", () => {
    const summary = linearRegression([
      { x: 0, y: 10 },
      { x: 1, y: 12 },
      { x: 2, y: 14 },
      { x: 3, y: 16 },
    ]);

    assert.equal(summary.trend, "up");
    assert.ok(summary.predictedNextValue > summary.currentValue);
    assert.ok(summary.r2 > 0.9);
  });

  it("flags strong unit-price outliers by z-score", () => {
    const observations: PriceObservation[] = [
      { codigoEfisco: "123", descricao: "Item A", unitPrice: 10, quantidade: 1, dfdId: "1", protocolo: "DFD-1", mes: "2026-01" },
      { codigoEfisco: "123", descricao: "Item A", unitPrice: 10.2, quantidade: 1, dfdId: "2", protocolo: "DFD-2", mes: "2026-02" },
      { codigoEfisco: "123", descricao: "Item A", unitPrice: 9.8, quantidade: 1, dfdId: "3", protocolo: "DFD-3", mes: "2026-03" },
      { codigoEfisco: "123", descricao: "Item A", unitPrice: 10.1, quantidade: 1, dfdId: "4", protocolo: "DFD-4", mes: "2026-04" },
      { codigoEfisco: "123", descricao: "Item A", unitPrice: 10.3, quantidade: 1, dfdId: "5", protocolo: "DFD-5", mes: "2026-05" },
      { codigoEfisco: "123", descricao: "Item A", unitPrice: 27.5, quantidade: 1, dfdId: "6", protocolo: "DFD-6", mes: "2026-06" },
    ];

    const outliers = detectPriceOutliers(observations, 6, 2.0);
    assert.ok(outliers.length >= 1);
    assert.equal(outliers[0].codigoEfisco, "123");
    assert.ok(Math.abs(outliers[0].zScore) >= 2.0);
  });
});
