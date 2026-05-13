export const DIRECTIONAL_MIN = -10;
export const DIRECTIONAL_MAX = 10;
export const LEGACY_MIN = 0;
export const LEGACY_MAX = 100;
export const LEGACY_CENTER = 50;
export const LEGACY_STEP = 5;

export const DIRECTIONAL_SCALE_VALUES = [
  -10, -9, -8, -7, -6, -5, -4, -3, -2, -1,
  0,
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const;

export type DirectionalVibeValue = (typeof DIRECTIONAL_SCALE_VALUES)[number];

export function clampDirectionalNumber(value: number): number {
  return Math.max(DIRECTIONAL_MIN, Math.min(DIRECTIONAL_MAX, value));
}

export function clampDirectionalValue(value: number): DirectionalVibeValue {
  const rounded = Math.round(clampDirectionalNumber(value));
  if (rounded <= DIRECTIONAL_MIN) return DIRECTIONAL_MIN;
  if (rounded >= DIRECTIONAL_MAX) return DIRECTIONAL_MAX;
  return rounded as DirectionalVibeValue;
}

export function clampLegacyScore(value: number): number {
  return Math.max(LEGACY_MIN, Math.min(LEGACY_MAX, Math.round(value)));
}

export function snapLegacyScoreToScale(value: number): number {
  const clamped = clampLegacyScore(value);
  return Math.round(clamped / LEGACY_STEP) * LEGACY_STEP;
}

export function legacyScoreToDirectional(value: number): DirectionalVibeValue {
  const snapped = snapLegacyScoreToScale(value);
  return clampDirectionalValue((snapped - LEGACY_CENTER) / LEGACY_STEP);
}

export function legacyScoreToDirectionalNumber(value: number): number {
  const clamped = clampLegacyScore(value);
  return clampDirectionalNumber((clamped - LEGACY_CENTER) / LEGACY_STEP);
}

export function directionalToLegacyScore(value: number): number {
  const directional = clampDirectionalValue(value);
  return snapLegacyScoreToScale(LEGACY_CENTER + directional * LEGACY_STEP);
}

export function directionalToPercent(value: number): number {
  const directional = clampDirectionalNumber(value);
  return ((directional - DIRECTIONAL_MIN) / (DIRECTIONAL_MAX - DIRECTIONAL_MIN)) * 100;
}

export function directionalToIntensity(value: number): number {
  return Math.abs(clampDirectionalNumber(value));
}
