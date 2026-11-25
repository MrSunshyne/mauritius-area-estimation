import type { Corner } from './area';
import { DEFAULT_JOB, DEFAULT_SETTINGS, type Job, type Settings } from './pricing';

export interface SavedPlot {
  id: string;
  name: string;
  savedAt: string;
  corners: Corner[];
  job: Job;
  area: number;
}

const SETTINGS_KEY = 'mae.settings.v1';
const PLOTS_KEY = 'mae.plots.v1';
const DRAFT_KEY = 'mae.draft.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadSettings(): Settings {
  const saved = load<Partial<Settings>>(SETTINGS_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    rates: { ...DEFAULT_SETTINGS.rates, ...saved.rates },
    levelling: { ...DEFAULT_SETTINGS.levelling, ...saved.levelling },
  };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function loadPlots(): SavedPlot[] {
  return load<SavedPlot[]>(PLOTS_KEY, []);
}

export function savePlots(plots: SavedPlot[]) {
  localStorage.setItem(PLOTS_KEY, JSON.stringify(plots));
}

/** The plot being drawn survives a reload or the phone killing the tab. */
export function loadDraft(): { corners: Corner[]; job: Job } {
  const d = load<{ corners?: Corner[]; job?: Partial<Job> }>(DRAFT_KEY, {});
  return { corners: d.corners ?? [], job: { ...DEFAULT_JOB, ...d.job, mix: { ...DEFAULT_JOB.mix, ...d.job?.mix } } };
}

export function saveDraft(corners: Corner[], job: Job) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ corners, job }));
}

// Share links carry the outline in the hash: #p=lat,lng;lat,lng;… with 7 decimals (≈ 1 cm).
export function encodeShape(corners: Corner[]): string {
  return 'p=' + corners.map((c) => `${c.lat.toFixed(7)},${c.lng.toFixed(7)}`).join(';');
}

export function decodeShape(hash: string): Corner[] | null {
  const m = /(?:^|[#&])p=([^&]+)/.exec(hash);
  if (!m) return null;
  const corners: Corner[] = [];
  for (const pair of decodeURIComponent(m[1]).split(';')) {
    const [lat, lng] = pair.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    corners.push({ lat, lng, sigma: 0.5, source: 'map' });
  }
  return corners.length >= 3 ? corners : null;
}
