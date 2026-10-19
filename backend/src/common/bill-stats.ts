// Pure bill aggregation used by the bills dashboard. Kept free of Prisma so it can be unit-tested
// against a data snapshot; BillsService.getDashboardStats() delegates here.
import type { BillCategory } from './bill-utils';

export interface AggregatableBill {
  vendor: string;
  bucket: string;
  cat: string;
  effectiveAmount: number;
  _days: number | null;
}

export interface BillTotals {
  total: number;
  cleared: { amount: number; count: number };
  inProgress: { amount: number; count: number };
  onHold: { amount: number; count: number };
  stages: Record<string, { amount: number; count: number; onHold: number }>;
  vendors: Record<string, Record<BillCategory, number> & { total: number; count: number }>;
  oldestPending: { vendor: string; days: number | null; amount: number } | null;
}

export function aggregateBills(bills: AggregatableBill[]): BillTotals {
  const total = bills.reduce((s, b) => s + b.effectiveAmount, 0);
  const cleared = bills.filter(b => b.cat === 'cleared');
  const onHold = bills.filter(b => b.cat === 'on_hold');
  const inProgress = bills.filter(b => b.cat === 'in_progress');

  // Stage aggregation
  const stages: BillTotals['stages'] = {};
  for (const b of bills) {
    if (!stages[b.bucket]) stages[b.bucket] = { amount: 0, count: 0, onHold: 0 };
    stages[b.bucket].amount += b.effectiveAmount;
    stages[b.bucket].count += 1;
    if (b.cat === 'on_hold') stages[b.bucket].onHold += 1;
  }

  // Vendor aggregation
  const vendors: BillTotals['vendors'] = {};
  for (const b of bills) {
    if (!vendors[b.vendor]) vendors[b.vendor] = { cleared: 0, in_progress: 0, on_hold: 0, total: 0, count: 0 };
    const v = vendors[b.vendor];
    v.total += b.effectiveAmount;
    v.count += 1;
    v[b.cat as BillCategory] += b.effectiveAmount;
  }

  // Oldest pending
  const pending = bills
    .filter(b => b.cat !== 'cleared' && b.cat !== 'on_hold' && b._days !== null && b._days >= 0)
    .sort((a, c) => (c._days || 0) - (a._days || 0));
  const oldest = pending[0];

  const sum = (rows: AggregatableBill[]) => rows.reduce((s, b) => s + b.effectiveAmount, 0);
  return {
    total,
    cleared: { amount: sum(cleared), count: cleared.length },
    inProgress: { amount: sum(inProgress), count: inProgress.length },
    onHold: { amount: sum(onHold), count: onHold.length },
    stages,
    vendors,
    oldestPending: oldest ? { vendor: oldest.vendor, days: oldest._days, amount: oldest.effectiveAmount } : null,
  };
}
