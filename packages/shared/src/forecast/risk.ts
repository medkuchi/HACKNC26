import type { RiskScoreResult } from "./types";

/**
 * R = clamp(100 * (S - Bmin) / max(S, 100), 0, 100)
 * S is the nonnegative safety buffer; Bmin is the minimum projected balance.
 * Both amounts must use the same currency and units as the forecast.
 *
 * Returns an unrounded provisional product score, not a probability:
 * 0: no buffer breach; (0, 50): mild pressure; [50, 100): significant
 * pressure; 100: severe pressure/possible shortfall. Concrete dollar
 * shortfalls should take priority over this score when generating alerts.
 */
export function calculateRiskScore(safetyBuffer: number, minimumProjectedBalance: number): number {
  if (!Number.isFinite(safetyBuffer) || safetyBuffer < 0) {
    throw new RangeError("safetyBuffer must be finite and nonnegative");
  }
  if (!Number.isFinite(minimumProjectedBalance)) {
    throw new RangeError("minimumProjectedBalance must be finite");
  }
  // Resolve the clamp boundaries first to avoid overflow for extreme inputs.
  if (minimumProjectedBalance >= safetyBuffer) return 0;
  const denominator = Math.max(safetyBuffer, 100);
  if (minimumProjectedBalance <= safetyBuffer - denominator) return 100;
  return Math.max(0, Math.min(100,
    100 * ((safetyBuffer - minimumProjectedBalance) / denominator),
  ));
}

/** Compare risk before and after selected purchases using the same safety buffer. */
export function compareRiskScores(
  safetyBuffer: number,
  baselineMinimumBalance: number,
  postPurchaseMinimumBalance: number,
): RiskScoreResult {
  const baseline = calculateRiskScore(safetyBuffer, baselineMinimumBalance);
  const postPurchase = calculateRiskScore(safetyBuffer, postPurchaseMinimumBalance);
  return { baseline, postPurchase, delta: postPurchase - baseline };
}
