// Lock-in tests: these pin the current dashboard totals so UI work cannot silently change them.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { aggregateBills, type AggregatableBill } from '../src/common/bill-stats';
import { pct } from '../src/common/bill-utils';

const fixture = (name: string) => resolve(__dirname, 'fixtures', name);
const load = <T>(name: string): T => JSON.parse(readFileSync(fixture(name), 'utf8'));

const stageSum = (stats: ReturnType<typeof aggregateBills>) =>
  Object.values(stats.stages).reduce((sum, stage) => sum + stage.amount, 0);
const vendorSum = (stats: ReturnType<typeof aggregateBills>) =>
  Object.values(stats.vendors).reduce((sum, vendor) => sum + vendor.total, 0);

describe('aggregateBills (synthetic fixture)', () => {
  const stats = aggregateBills(load<AggregatableBill[]>('bills.sample.json'));

  it('stage values and vendor totals both sum to the overall total', () => {
    expect(stats.total).toBeCloseTo(6704026.5, 2);
    expect(stageSum(stats)).toBeCloseTo(stats.total, 2);
    expect(vendorSum(stats)).toBeCloseTo(stats.total, 2);
  });

  it('splits by category', () => {
    expect(stats.cleared).toEqual({ amount: 5025146, count: 2 });
    expect(stats.inProgress).toEqual({ amount: 1603880.5, count: 3 });
    expect(stats.onHold).toEqual({ amount: 75000, count: 1 });
    expect(stats.stages['File Approval Pending']).toEqual({ amount: 75000, count: 1, onHold: 1 });
  });

  it('oldest pending excludes held and undated bills', () => {
    expect(stats.oldestPending).toEqual({ vendor: 'DSU Alpha', days: 200, amount: 1250000.5 });
  });
});

// Real-data snapshot (gitignored). Skipped when the snapshot is not present, e.g. in CI.
const PROD_BILLS = 'bills.prod-2026-10-19.local.json';
const PROD_DASH = 'dashboard.prod-2026-10-19.local.json';
const hasProd = existsSync(fixture(PROD_BILLS)) && existsSync(fixture(PROD_DASH));

describe.skipIf(!hasProd)('production snapshot 19 Oct 2026', () => {
  const bills = hasProd ? load<AggregatableBill[]>(PROD_BILLS) : [];
  const stats = aggregateBills(bills);

  it('has 76 bills worth ₹24.07 Cr', () => {
    expect(bills).toHaveLength(76);
    expect(stats.total).toBeCloseTo(240700553.73, 2);
  });

  it('stage values sum to the overall total', () => {
    expect(stageSum(stats)).toBeCloseTo(stats.total, 2);
    expect(vendorSum(stats)).toBeCloseTo(stats.total, 2);
  });

  it('cleared share is ≈ 41 %', () => {
    expect(stats.cleared.count).toBe(31);
    expect(stats.cleared.amount / stats.total * 100).toBeCloseTo(41.08, 2);
    expect(pct(stats.cleared.amount, stats.total)).toBe(41);
  });

  it('locks per-stage counts and values', () => {
    const rounded = Object.fromEntries(Object.entries(stats.stages).map(([k, v]) => [k, [v.count, Math.round(v.amount)]]));
    expect(rounded).toEqual({
      'Invoice Raised': [28, 94058429],
      'TFC Committee Approval': [11, 36928956],
      'File Approval Pending': [3, 8622581],
      'Sent to Treasury': [3, 2201346],
      'Cleared by Treasury': [31, 98889242],
    });
  });

  it('matches the live /bills/dashboard response exactly', () => {
    expect(stats).toEqual(load(PROD_DASH));
  });
});
