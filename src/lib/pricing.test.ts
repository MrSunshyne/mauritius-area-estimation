import { describe, expect, it } from 'vitest';
import { DEFAULT_JOB, DEFAULT_SETTINGS, quote } from './pricing';
import { ARPENT_M2 } from './units';

describe('quote', () => {
  it('prices one arpent of 60% bush, 40% grass on a gentle slope at about Rs 15,500', () => {
    const q = quote(ARPENT_M2, { ...DEFAULT_JOB, distanceKm: 8 }, DEFAULT_SETTINGS);
    // (0.6 × 10 + 0.4 × 3) h × 1.15 slope = 8.28 h; Rs 12,420 + Rs 1,500 travel, +10%.
    expect(q.mid.hours).toBeCloseTo(8.28, 2);
    expect(q.mid.days).toBe(1.5);
    expect(q.mid.price).toBe(15_500);
    expect(q.low.price).toBeLessThan(q.mid.price);
    expect(q.high.price).toBeGreaterThan(q.mid.price);
  });

  it('charges the minimum on a tiny plot', () => {
    const q = quote(200, DEFAULT_JOB, DEFAULT_SETTINGS);
    expect(q.minChargeApplies).toBe(true);
    expect(q.mid.price).toBe(Math.round(((5000 + 1500) * 1.1) / 500) * 500);
  });

  it('adds VAT on top when asked', () => {
    const a = quote(ARPENT_M2, DEFAULT_JOB, DEFAULT_SETTINGS);
    const b = quote(ARPENT_M2, { ...DEFAULT_JOB, vat: true }, DEFAULT_SETTINGS);
    expect(b.mid.price).toBe(Math.round(a.mid.price * 1.15));
  });
});
