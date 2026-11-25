import { Geodesic } from 'geographiclib-geodesic';

const G = Geodesic.WGS84;

export interface Corner {
  lng: number;
  lat: number;
  /** 1-sigma placement error per axis, metres. */
  sigma: number;
  source: 'map' | 'gps';
}

export interface Measurement {
  /** Horizontal area on the WGS84 ellipsoid, m². */
  area: number;
  perimeter: number;
  /** Length of edge i, from corner i to corner i+1 (closing edge last). */
  edges: number[];
  /** 1-sigma area error from corner placement, m². */
  placementSigma: number;
  /** Area error if the whole boundary sits BOUNDARY_DOUBT_M too far in or out, m². */
  boundaryBand: number;
  /** Combined ± shown to the user, m². */
  uncertainty: number;
  selfIntersecting: boolean;
}

/** How far a drawn boundary may sit from the real one (fence vs canopy edge, shadows). */
export const BOUNDARY_DOUBT_M = 0.5;

export function edgeLength(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  return G.Inverse(a.lat, a.lng, b.lat, b.lng).s12 ?? 0;
}

/** Local flat metres around the first corner; good to well under 0.1% over a few km. */
function toLocal(corners: { lng: number; lat: number }[]): [number, number][] {
  const lat0 = corners[0].lat;
  const lng0 = corners[0].lng;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110_574;
  return corners.map((c) => [(c.lng - lng0) * kx, (c.lat - lat0) * ky]);
}

function segmentsCross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const orient = (p: [number, number], q: [number, number], r: [number, number]) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
}

export function isSelfIntersecting(corners: { lng: number; lat: number }[]): boolean {
  const n = corners.length;
  if (n < 4) return false;
  const p = toLocal(corners);
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent through the closing edge
      if (segmentsCross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function measure(corners: Corner[]): Measurement {
  const n = corners.length;
  const edges: number[] = [];
  for (let i = 0; i < n - 1; i++) edges.push(edgeLength(corners[i], corners[i + 1]));
  if (n >= 3) edges.push(edgeLength(corners[n - 1], corners[0]));
  const perimeter = edges.reduce((s, e) => s + e, 0);

  if (n < 3) {
    return { area: 0, perimeter, edges, placementSigma: 0, boundaryBand: 0, uncertainty: 0, selfIntersecting: false };
  }

  const poly = G.Polygon(false);
  for (const c of corners) poly.AddPoint(c.lat, c.lng);
  const area = Math.abs(poly.Compute(false, true).area ?? 0);

  // Shoelace derivative: dA/dx_i = (y_{i+1} - y_{i-1}) / 2, dA/dy_i = (x_{i-1} - x_{i+1}) / 2,
  // so with independent errors sigma_i per axis, var(A) = 1/4 · Σ sigma_i² · |p_{i+1} - p_{i-1}|².
  const p = toLocal(corners);
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const next = p[(i + 1) % n];
    const prev = p[(i - 1 + n) % n];
    const d2 = (next[0] - prev[0]) ** 2 + (next[1] - prev[1]) ** 2;
    variance += corners[i].sigma ** 2 * d2;
  }
  const placementSigma = Math.sqrt(variance) / 2;
  const boundaryBand = perimeter * BOUNDARY_DOUBT_M;

  return {
    area,
    perimeter,
    edges,
    placementSigma,
    boundaryBand,
    uncertainty: Math.hypot(placementSigma, boundaryBand),
    selfIntersecting: isSelfIntersecting(corners),
  };
}

/** Ground metres per CSS pixel on a MapLibre map (512 px tiles) at this zoom and latitude. */
export function metresPerPixel(zoom: number, lat: number): number {
  return (78_271.517 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

/** Placement error for a corner set with the crosshair: the imagery is ~0.3–0.5 m per pixel. */
export function crosshairSigma(zoom: number, lat: number): number {
  return Math.max(0.5, 2 * metresPerPixel(zoom, lat));
}
