/** Restored pre-institutional scoring for custeio and services. */
export function computeWeightedPriority(impact: number, priority: number, value: number,
  impactWeight = 1, priorityWeight = 1): number {
  return impact * priority * 10 + impact * 8 * impactWeight +
    priority * 8 * priorityWeight + Math.log10(Number(value || 0) + 1);
}
