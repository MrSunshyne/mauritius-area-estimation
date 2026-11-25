import { describe, expect, it } from 'vitest';
import { Geodesic } from 'geographiclib-geodesic';
import { measure, type Corner } from './area';
import { ARPENT_M2, PERCHE_M2, TOISE2_M2 } from './units';

// A square of the given side, centred near Moka, built with geodesic offsets so its true
// size is known independently of the projection.
function square(side: number): Corner[] {
  const G = Geodesic.WGS84;
  const start = { lat: -20.23, lng: 57.56 };
  const corners: Corner[] = [];
  let p = start;
  for (const azi of [90, 0, 270]) {
    corners.push({ lng: p.lng, lat: p.lat, sigma: 0.5, source: 'map' });
    const d = G.Direct(p.lat, p.lng, azi, side);
    p = { lat: d.lat2!, lng: d.lon2! };
  }
  corners.push({ lng: p.lng, lat: p.lat, sigma: 0.5, source: 'map' });
  return corners;
}

describe('measure', () => {
  it('gives a 100 m square as one hectare, not the +14% of flat web-map maths', () => {
    const r = measure(square(100));
    expect(r.area).toBeGreaterThan(9_990);
    expect(r.area).toBeLessThan(10_010);
    expect(r.perimeter).toBeCloseTo(400, 0);
  });

  it('is the same whichever way round the corners go', () => {
    const c = square(50);
    expect(measure([...c].reverse()).area).toBeCloseTo(measure(c).area, 6);
  });

  it('matches √2·σ·√A for a square with equal corner errors', () => {
    const r = measure(square(100));
    expect(r.placementSigma).toBeCloseTo(Math.SQRT2 * 0.5 * 100, 0);
  });

  it('flags a bow-tie outline', () => {
    const [a, b, c, d] = square(40);
    expect(measure([a, c, b, d]).selfIntersecting).toBe(true);
    expect(measure([a, b, c, d]).selfIntersecting).toBe(false);
  });

  it('reports no area below three corners', () => {
    expect(measure(square(10).slice(0, 2)).area).toBe(0);
  });
});

describe('Mauritian units', () => {
  it('uses the legal French-foot values', () => {
    expect(PERCHE_M2).toBeCloseTo(42.2087, 4);
    expect(ARPENT_M2).toBeCloseTo(4220.87, 2);
    expect(TOISE2_M2).toBeCloseTo(3.79878, 5);
  });
});
