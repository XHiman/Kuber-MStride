import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Bill } from '../types';
import { agingBucket, isOverdue, parseThreshold, summariseAging } from './aging';

describe('agingBucket', () => {
  it('uses inclusive upper bounds 30 / 90 / 180', () => {
    expect([0, 30, 31, 90, 91, 180, 181, 377].map(agingBucket))
      .toEqual(['0-30', '0-30', '31-90', '31-90', '91-180', '91-180', '180+', '180+']);
    expect(agingBucket(null)).toBe('no-date');
  });
});

describe('isOverdue', () => {
  it('is strictly greater than the threshold and only for open bills', () => {
    expect(isOverdue({ cat: 'in_progress', _days: 91 }, 90)).toBe(true);
    expect(isOverdue({ cat: 'in_progress', _days: 90 }, 90)).toBe(false);
    expect(isOverdue({ cat: 'on_hold', _days: 400 }, 90)).toBe(true);
    expect(isOverdue({ cat: 'cleared', _days: 400 }, 90)).toBe(false);
    expect(isOverdue({ cat: 'in_progress', _days: null }, 90)).toBe(false);
  });
  it('clamps bad thresholds to the default', () => {
    expect(parseThreshold('45')).toBe(45);
    expect(parseThreshold('0')).toBe(90);
    expect(parseThreshold('abc')).toBe(90);
  });
});

describe('summariseAging', () => {
  it('counts open bills only and keeps undated ones visible', () => {
    const s = summariseAging([
      { cat: 'in_progress', _days: 10, amount: 100 },
      { cat: 'on_hold', _days: 200, amount: 50, effectiveAmount: 60 },
      { cat: 'in_progress', _days: null, amount: 7 },
      { cat: 'cleared', _days: null, amount: 1000 },
    ]);
    expect(s['0-30']).toEqual({ count: 1, amount: 100 });
    expect(s['180+']).toEqual({ count: 1, amount: 60 });
    expect(s['no-date']).toEqual({ count: 1, amount: 7 });
  });
});

const snapshot = resolve(__dirname, '../../../backend/test/fixtures/bills.prod-2026-10-19.local.json');
describe.skipIf(!existsSync(snapshot))('production snapshot', () => {
  const bills: Bill[] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : [];
  it('bucket totals add up to all open bills', () => {
    const s = summariseAging(bills);
    const open = bills.filter(b => b.cat !== 'cleared');
    const count = Object.values(s).reduce((n, b) => n + b.count, 0);
    const amount = Object.values(s).reduce((n, b) => n + b.amount, 0);
    expect(count).toBe(open.length);
    expect(count).toBe(45);
    expect(amount).toBeCloseTo(open.reduce((n, b) => n + (b.effectiveAmount ?? 0), 0), 2);
  });
});
