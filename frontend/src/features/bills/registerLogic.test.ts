import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Bill } from '../../types';
import { EMPTY_FILTERS, buildRegisterCsv, describeFilters, filterBills, fiscalYearOf, paginate, sortBills } from './registerLogic';

const mk = (id: string, over: Partial<Bill> = {}): Bill => ({
  id, sr: null, vendor: `V${id}`, invoice: `I${id}`, efileNumber: null, date: '2026-01-01', amount: 100,
  amountSanctioned: null, budgetCode: null, objectHead: null, transferId: null, program: null, district: null,
  assignedUserId: null, bucket: 'Invoice Raised', cat: 'in_progress', onHold: false, holdReason: null, status: 's',
  attribute: null, note: null, days: null, clearedFY: null, source: 't', stageHistory: [], _days: 10, effectiveAmount: 100,
  ...over,
} as Bill);
const ctx = { users: [], currentUserId: 'u1', overdueDays: 90, globalQuery: '', today: new Date(2026, 9, 19) };

describe('saved views', () => {
  const bills = [
    mk('a', { assignedUserId: 'u1' }),
    mk('b', { _days: 120 }),
    mk('c', { cat: 'on_hold', _days: 200 }),
    mk('d', { cat: 'cleared', clearedFY: 'FY 2026-27', bucket: 'Cleared by Treasury' }),
    mk('e', { cat: 'cleared', clearedFY: 'FY 2025-26', bucket: 'Cleared by Treasury' }),
  ];
  const ids = (view: typeof EMPTY_FILTERS.view) => filterBills(bills, { ...EMPTY_FILTERS, view }, ctx).map(b => b.id);
  it('filters by view', () => {
    expect(ids('mine')).toEqual(['a']);
    expect(ids('overdue')).toEqual(['b', 'c']);
    expect(ids('on_hold')).toEqual(['c']);
    expect(ids('cleared_fy')).toEqual(['d']);
    expect(ids('')).toHaveLength(5);
  });
  it('"My assigned bills" is empty when signed out', () => {
    expect(filterBills(bills, { ...EMPTY_FILTERS, view: 'mine' }, { ...ctx, currentUserId: null })).toEqual([]);
  });
  it('knows the Indian fiscal year', () => {
    expect(fiscalYearOf(new Date(2026, 2, 31))).toBe('FY 2025-26');
    expect(fiscalYearOf(new Date(2026, 3, 1))).toBe('FY 2026-27');
  });
});

describe('sorting', () => {
  const bills = [mk('a', { date: '2026-03-01', _days: 5 }), mk('b', { date: null, _days: null }), mk('c', { date: '2025-10-07', _days: 377 })];
  it('puts undated bills last in both directions', () => {
    expect(sortBills(bills, 'date', 'asc').map(b => b.id)).toEqual(['c', 'a', 'b']);
    expect(sortBills(bills, 'date', 'desc').map(b => b.id)).toEqual(['a', 'c', 'b']);
    expect(sortBills(bills, 'days', 'desc').map(b => b.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('paging', () => {
  it('reports "Showing 1–25 of 76"', () => {
    const p = paginate(Array.from({ length: 76 }, (_, i) => i), 1, 25);
    expect([p.from, p.to, p.total, p.pages]).toEqual([1, 25, 76, 4]);
    const last = paginate(Array.from({ length: 76 }, (_, i) => i), 9, 25);
    expect([last.page, last.from, last.to]).toEqual([4, 76, 76]);
    expect(paginate([], 1, 25).from).toBe(0);
  });
});

describe('CSV export', () => {
  it('lists filters and row count in the header', () => {
    const f = { ...EMPTY_FILTERS, stage: 'TFC Committee Approval', view: 'overdue' as const, search: 'nagpur' };
    const csv = buildRegisterCsv([mk('a')], [], describeFilters(f, ''), new Date(2026, 9, 19, 17, 5));
    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('# Exported: 19 Oct 2026, 17:05');
    expect(lines[2]).toBe('# Filters: View = Overdue; Stage = TFC approval; Search = "nagpur"');
    expect(lines[3]).toBe('# Rows: 1');
    expect(lines[4].startsWith('Vendor,Invoice')).toBe(true);
    expect(lines).toHaveLength(6);
  });
  it('says when no filters apply', () => {
    expect(buildRegisterCsv([], [], [])).toContain('# Filters: none (all bills)');
  });
});

const snapshot = resolve(__dirname, '../../../../backend/test/fixtures/bills.prod-2026-10-19.local.json');
describe.skipIf(!existsSync(snapshot))('production snapshot', () => {
  const bills: Bill[] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : [];
  it('exports every bill in the unfiltered view', () => {
    const rows = filterBills(bills, EMPTY_FILTERS, ctx);
    expect(rows).toHaveLength(76);
    expect(paginate(rows, 1, 25)).toMatchObject({ from: 1, to: 25, total: 76 });
  });
});
