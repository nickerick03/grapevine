import { SLIDERS, type VibeProfile } from "./vibe";

const STRICTNESS_EXPONENT = 1.35;
const MAX_AXIS_PENALTY_FACTOR = 0.24;

export function calculateStrictSimilarityMatch(a: VibeProfile, b: VibeProfile): number {
  const deltas = SLIDERS.map((slider) => Math.abs(a[slider.key] - b[slider.key]));
  const distance = Math.sqrt(deltas.reduce((acc, delta) => acc + delta * delta, 0));
  const maxDistance = Math.sqrt(SLIDERS.length * 100 * 100);

  const baseSimilarity = Math.max(0, 1 - distance / maxDistance);
  const strictSimilarity = Math.pow(baseSimilarity, STRICTNESS_EXPONENT);

  const largestAxisDelta = Math.max(...deltas, 0);
  const largestAxisPenalty = (largestAxisDelta / 100) * MAX_AXIS_PENALTY_FACTOR;

  const finalSimilarity = strictSimilarity * (1 - largestAxisPenalty);
  return Math.max(0, Math.min(100, Math.round(finalSimilarity * 100)));
}
