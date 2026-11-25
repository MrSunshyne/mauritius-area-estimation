import { ARPENT_M2, PERCHE_M2 } from './units';

// Clearing classes. Rates are machine hours per arpent for an ~8 t backhoe loader (Volvo BL61B
// class), scaled from RSMeans, extension guides and MCIA's 15 h/arpent cap for D6–D8 dozers.
// They are starting guesses: the owner should replace them with figures from real jobs.
export const CLASSES = [
  { id: 'grass', label: 'Grass, weeds', hint: 'zerbes, light growth' },
  { id: 'bush', label: 'Dense bush', hint: 'broussailles, cassie, lantana, old cane' },
  { id: 'trees', label: 'Small trees, stumps', hint: '10–30 cm trunks' },
  { id: 'rocks', label: 'Rocks', hint: 'épierrage, loose boulders < 1 m³' },
] as const;

export type ClassId = (typeof CLASSES)[number]['id'];

export interface RateRange {
  low: number;
  mid: number;
  high: number;
}

export interface Settings {
  /** Rs per machine hour, operator and fuel included. */
  ratePerHour: number;
  minCharge: number;
  productiveHoursPerDay: number;
  travelFixed: number;
  travelPerKm: number;
  travelFreeKm: number;
  contingencyPct: number;
  vatPct: number;
  /** h per arpent */
  rates: Record<ClassId, RateRange>;
  levelling: RateRange;
}

export const DEFAULT_SETTINGS: Settings = {
  ratePerHour: 1500,
  minCharge: 5000,
  productiveHoursPerDay: 7,
  travelFixed: 1500,
  travelPerKm: 75,
  travelFreeKm: 10,
  contingencyPct: 10,
  vatPct: 15,
  rates: {
    grass: { low: 2, mid: 3, high: 4 },
    bush: { low: 6, mid: 10, high: 14 },
    trees: { low: 12, mid: 20, high: 28 },
    rocks: { low: 20, mid: 35, high: 50 },
  },
  levelling: { low: 10, mid: 15, high: 28 },
};

export const SLOPES = [
  { id: 'flat', label: 'Flat (< 5%)', factor: 1 },
  { id: 'gentle', label: 'Gentle (5–15%)', factor: 1.15 },
  { id: 'steep', label: 'Steep (15–25%)', factor: 1.35 },
  { id: 'very', label: 'Very steep (> 25%)', factor: 1.6 },
] as const;

export const ACCESS = [
  { id: 'open', label: 'Open', factor: 1 },
  { id: 'tight', label: 'Tight (gate, walls, lines)', factor: 1.2 },
  { id: 'very', label: 'Very tight', factor: 1.4 },
] as const;

export interface Job {
  /** Share of the plot in each class; normalised, so any positive numbers work. */
  mix: Record<ClassId, number>;
  levelling: boolean;
  slope: (typeof SLOPES)[number]['id'];
  access: (typeof ACCESS)[number]['id'];
  wet: boolean;
  /** Load debris onto lorries instead of leaving it in windrows on site. */
  loadOut: boolean;
  distanceKm: number;
  vat: boolean;
}

export const DEFAULT_JOB: Job = {
  mix: { grass: 40, bush: 60, trees: 0, rocks: 0 },
  levelling: false,
  slope: 'gentle',
  access: 'open',
  wet: false,
  loadOut: false,
  distanceKm: 8,
  vat: false,
};

const SMALL_PLOT_M2 = 10 * PERCHE_M2;

export interface QuoteCase {
  hours: number;
  days: number;
  price: number;
}

export interface Quote {
  low: QuoteCase;
  mid: QuoteCase;
  high: QuoteCase;
  factor: number;
  travel: number;
  minChargeApplies: boolean;
  warnings: string[];
}

const roundTo500 = (rs: number) => Math.round(rs / 500) * 500;

export function quote(areaM2: number, job: Job, s: Settings): Quote {
  const arpents = areaM2 / ARPENT_M2;
  const mixTotal = Object.values(job.mix).reduce((a, b) => a + Math.max(0, b), 0) || 1;

  const factor =
    SLOPES.find((x) => x.id === job.slope)!.factor *
    ACCESS.find((x) => x.id === job.access)!.factor *
    (job.wet ? 1.2 : 1) *
    (job.loadOut ? 1.3 : 1) *
    (areaM2 > 0 && areaM2 < SMALL_PLOT_M2 ? 1.2 : 1);

  const travel = s.travelFixed + s.travelPerKm * Math.max(0, job.distanceKm - s.travelFreeKm);
  let minChargeApplies = false;

  const one = (key: keyof RateRange): QuoteCase => {
    let perArpent = 0;
    for (const c of CLASSES) perArpent += (Math.max(0, job.mix[c.id]) / mixTotal) * s.rates[c.id][key];
    if (job.levelling) perArpent += s.levelling[key];
    const hours = arpents * perArpent * factor;
    const machine = hours * s.ratePerHour;
    if (key === 'mid' && machine < s.minCharge) minChargeApplies = true;
    let price = roundTo500((Math.max(machine, s.minCharge) + travel) * (1 + s.contingencyPct / 100));
    if (job.vat) price = Math.round(price * (1 + s.vatPct / 100));
    const days = Math.max(0.5, Math.ceil((hours / s.productiveHoursPerDay) * 2) / 2);
    return { hours, days, price };
  };

  const warnings: string[] = [];
  if (job.slope === 'very') warnings.push('Very steep: check the machine can work it safely. Steep slopes are environmentally sensitive areas and clearing them needs a licence.');
  if (job.mix.rocks > 0) warnings.push('Boulders over about 1 m³ need a rock breaker: quote them separately.');
  if (job.loadOut) warnings.push('Lorry trips to cart debris away are not included.');

  return { low: one('low'), mid: one('mid'), high: one('high'), factor, travel, minChargeApplies, warnings };
}
