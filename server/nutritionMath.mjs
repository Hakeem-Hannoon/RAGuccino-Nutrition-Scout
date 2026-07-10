export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function round1(value) {
  return Math.round(value * 10) / 10;
}

export function atwaterKcal({ proteinG = 0, carbsG = 0, fatG = 0 }) {
  return round1(proteinG * 4 + carbsG * 4 + fatG * 9);
}

export function kcalDeltaRatio(labelKcal, macros) {
  if (typeof labelKcal !== "number" || !Number.isFinite(labelKcal) || labelKcal <= 0) {
    return null;
  }
  return round1((Math.abs(labelKcal - atwaterKcal(macros)) / labelKcal) * 100);
}

export function scaleNutrition(nutrients, consumedGrams, basisGrams = 100) {
  const scale = consumedGrams / basisGrams;
  return {
    proteinG: round1((nutrients.proteinG || 0) * scale),
    carbsG: round1((nutrients.carbsG || 0) * scale),
    fatG: round1((nutrients.fatG || 0) * scale),
    calories:
      typeof nutrients.calories === "number" ? Math.round(nutrients.calories * scale) : null,
  };
}

export function confidenceScore({
  sourceAuthority = 0.5,
  servingClarity = 0.5,
  agreement = 0.5,
  exactMatch = false,
}) {
  const base = exactMatch ? 0.45 : 0.25;
  return clamp(base + sourceAuthority * 0.25 + servingClarity * 0.2 + agreement * 0.2);
}

