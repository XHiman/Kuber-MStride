import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NON_DSU_GROUP, groupBills, normaliseVendor } from './vendors';

describe('normaliseVendor', () => {
  it('merges the approved pairs regardless of spacing and punctuation', () => {
    expect(normaliseVendor('Nagpur - E & Y').name).toBe('DSU Nagpur – E&Y');
    expect(normaliseVendor('DSU Nagpur- E & Y').name).toBe('DSU Nagpur – E&Y');
    expect(normaliseVendor('Nashik KPMG').name).toBe('DSU Nashik – KPMG');
    expect(normaliseVendor('DSU Nashik-KPMG').name).toBe('DSU Nashik – KPMG');
    expect(normaliseVendor('CSN - Choice')).toEqual({ name: 'DSU Chh. Sambhajinagar – Choice', dsu: 'Chh. Sambhajinagar' });
  });
  it('leaves ambiguous and unknown vendors alone', () => {
    expect(normaliseVendor('E & Y LLP Agriculture In MITRA')).toEqual({ name: 'E & Y LLP Agriculture In MITRA', dsu: null });
    expect(normaliseVendor('TATA Telephone').name).toBe('TATA Telephone');
    expect(normaliseVendor('PMC - KPMG Advisory Ser').name).toBe('PMC - KPMG Advisory Ser');
    expect(normaliseVendor('  RailTel  ').name).toBe('RailTel');
  });
});

describe('groupBills', () => {
  const bills = [
    { vendor: 'DSU Nagpur- E & Y', cat: 'cleared', amount: 100 },
    { vendor: 'Nagpur - E & Y', cat: 'in_progress', amount: 50 },
    { vendor: 'ICARE', cat: 'on_hold', amount: 70 },
  ];
  it('merges by vendor, keeps raw names, preserves the total', () => {
    const g = groupBills(bills, 'vendor');
    expect(g.map(x => [x.name, x.count, x.total])).toEqual([['DSU Nagpur – E&Y', 2, 150], ['ICARE', 1, 70]]);
    expect(g[0].rawNames).toEqual(['DSU Nagpur- E & Y', 'Nagpur - E & Y']);
    expect(g[0]).toMatchObject({ cleared: 100, in_progress: 50, on_hold: 0 });
  });
  it('groups non-DSU payees together by DSU', () => {
    expect(groupBills(bills, 'dsu').map(x => x.name)).toEqual(['DSU Nagpur', NON_DSU_GROUP]);
  });
});

const snapshot = resolve(__dirname, '../../../backend/test/fixtures/bills.prod-2026-10-19.local.json');
describe.skipIf(!existsSync(snapshot))('production snapshot', () => {
  const raw: { vendor: string; cat: string; effectiveAmount: number }[] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : [];
  const bills = raw.map(b => ({ vendor: b.vendor, cat: b.cat, amount: b.effectiveAmount }));
  const total = bills.reduce((s, b) => s + b.amount, 0);
  it('never changes the overall total or count', () => {
    for (const by of ['vendor', 'dsu'] as const) {
      const g = groupBills(bills, by);
      expect(g.reduce((s, x) => s + x.total, 0)).toBeCloseTo(total, 2);
      expect(g.reduce((s, x) => s + x.count, 0)).toBe(76);
    }
  });
  it('merges the three approved pairs (23 raw names → 21 vendors)', () => {
    const g = groupBills(bills, 'vendor');
    expect(new Set(bills.map(b => b.vendor)).size).toBe(23);
    expect(g).toHaveLength(21);
    const find = (name: string) => g.find(x => x.name === name)!;
    expect(find('DSU Nagpur – E&Y').count).toBe(16);
    expect(find('DSU Nashik – KPMG').count).toBe(10);
    expect(find('DSU Chh. Sambhajinagar – Choice').count).toBe(7);
  });
  it('has five DSUs plus the non-DSU group', () => {
    expect(groupBills(bills, 'dsu').map(x => x.name).sort()).toEqual(
      ['DSU Amravati', 'DSU Chh. Sambhajinagar', 'DSU Nagpur', 'DSU Nashik', 'DSU Pune', NON_DSU_GROUP].sort(),
    );
  });
});
