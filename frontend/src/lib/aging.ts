// Aging of open bills. Days open = today − invoice date (the backend's `_days`).
// Open = not cleared; on-hold bills are included (they are still unpaid). Bills without an invoice
// date cannot be aged and get their own bucket rather than being silently dropped.
import type { Bill } from '../types';

export type AgingBucketId = '0-30' | '31-90' | '91-180' | '180+' | 'no-date';

export const AGING_BUCKETS: { id: AgingBucketId; label: string }[] = [
  { id: '0-30', label: '0–30 days' },
  { id: '31-90', label: '31–90 days' },
  { id: '91-180', label: '91–180 days' },
  { id: '180+', label: '180+ days' },
  { id: 'no-date', label: 'No invoice date' },
];

export const DEFAULT_OVERDUE_DAYS = 90;

export function agingBucket(days: number | null | undefined): AgingBucketId {
  if (days === null || days === undefined || Number.isNaN(days)) return 'no-date';
  if (days <= 30) return '0-30';
  if (days <= 90) return '31-90';
  if (days <= 180) return '91-180';
  return '180+';
}

type AgingInput = Pick<Bill, 'cat' | '_days'> & { effectiveAmount?: number; amount: number };

export function isOpen(bill: Pick<Bill, 'cat'>): boolean {
  return bill.cat !== 'cleared';
}

/** Open and older than the threshold (strictly greater). Undated bills are never "overdue". */
export function isOverdue(bill: Pick<Bill, 'cat' | '_days'>, thresholdDays: number): boolean {
  return isOpen(bill) && bill._days !== null && bill._days !== undefined && bill._days > thresholdDays;
}

export function summariseAging(bills: AgingInput[]): Record<AgingBucketId, { count: number; amount: number }> {
  const result = Object.fromEntries(AGING_BUCKETS.map(b => [b.id, { count: 0, amount: 0 }])) as Record<AgingBucketId, { count: number; amount: number }>;
  for (const bill of bills) {
    if (!isOpen(bill)) continue;
    const bucket = result[agingBucket(bill._days)];
    bucket.count += 1;
    bucket.amount += bill.effectiveAmount ?? bill.amount;
  }
  return result;
}

/** Clamp a user-entered threshold to a sensible whole number of days. */
export function parseThreshold(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 3650 ? n : DEFAULT_OVERDUE_DAYS;
}
