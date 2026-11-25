// Mauritian land units, from the French foot fixed by the SI Act 1984 (Sixth Schedule):
// 1 pied = 0.324841 m, 1 toise = 6 pieds, 1 perche = 20 × 20 pieds, 1 arpent = 100 perches.
export const PIED_M = 0.324841;
export const TOISE2_M2 = (6 * PIED_M) ** 2; // 3.79878 m²
export const PERCHE_M2 = (20 * PIED_M) ** 2; // 42.2087 m²
export const ARPENT_M2 = 100 * PERCHE_M2; // 4,220.87 m²
export const HECTARE_M2 = 10_000;

const nf = (digits: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function fmt(value: number, digits = 0): string {
  return nf(digits).format(value);
}

/** Area in m², rounded to a precision that does not overstate the measurement. */
export function fmtM2(m2: number): string {
  return `${fmt(m2 < 100 ? Math.round(m2 * 10) / 10 : Math.round(m2), m2 < 100 ? 1 : 0)} m²`;
}

export function fmtLength(m: number): string {
  return m < 100 ? `${fmt(m, 1)} m` : `${fmt(m, 0)} m`;
}

export function toUnits(m2: number) {
  return {
    m2,
    perches: m2 / PERCHE_M2,
    arpents: m2 / ARPENT_M2,
    toises: m2 / TOISE2_M2,
    hectares: m2 / HECTARE_M2,
  };
}
