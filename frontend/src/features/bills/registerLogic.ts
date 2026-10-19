// Pure register logic: saved views, filtering, sorting, paging and CSV export.
import { isOverdue } from '../../lib/aging';
import { formatCSV } from '../../lib/export';
import { formatDate, formatDateTime } from '../../lib/format';
import { REASONS, STAGE_GLOSSARY, deriveReasons, stageLabel } from '../../lib/status';
import { STAGES, type Bill, type BillCategory, type UserProfile } from '../../types';
import { billAmount } from './shared';

export type SavedViewId = '' | 'mine' | 'overdue' | 'on_hold' | 'cleared_fy';
export const SAVED_VIEWS: { id: SavedViewId; label: string }[] = [
  { id: '', label: 'All bills' },
  { id: 'mine', label: 'My assigned bills' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'cleared_fy', label: 'Cleared this FY' },
];

export type SortKey = 'vendor' | 'date' | 'days' | 'amount' | 'stage';
export type SortDir = 'asc' | 'desc';

export interface RegisterFilters {
  view: SavedViewId;
  search: string;
  vendor: string;
  stage: string;
  cat: BillCategory | '';
}
export const EMPTY_FILTERS: RegisterFilters = { view: '', search: '', vendor: '', stage: '', cat: '' };

export interface FilterContext {
  users: UserProfile[];
  currentUserId: string | null;
  overdueDays: number;
  globalQuery: string;
  today?: Date;
}

/** Indian fiscal year label for a date, e.g. "FY 2026-27" (April–March). */
export function fiscalYearOf(date: Date): string {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `FY ${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function matchesView(bill: Bill, view: SavedViewId, ctx: FilterContext): boolean {
  switch (view) {
    case 'mine': return !!ctx.currentUserId && bill.assignedUserId === ctx.currentUserId;
    case 'overdue': return isOverdue(bill, ctx.overdueDays);
    case 'on_hold': return bill.cat === 'on_hold';
    case 'cleared_fy': return bill.cat === 'cleared' && (bill.clearedFY || bill._clearedFY) === fiscalYearOf(ctx.today ?? new Date());
    default: return true;
  }
}

export function filterBills(bills: Bill[], f: RegisterFilters, ctx: FilterContext): Bill[] {
  const terms = `${f.search} ${ctx.globalQuery}`.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return bills.filter(b => {
    if (!matchesView(b, f.view, ctx)) return false;
    if (f.vendor && b.vendor !== f.vendor) return false;
    if (f.stage && b.bucket !== f.stage) return false;
    if (f.cat && b.cat !== f.cat) return false;
    if (!terms.length) return true;
    const assigned = ctx.users.find(user => user.id === b.assignedUserId)?.name || '';
    const haystack = `${b.vendor} ${b.invoice} ${b.efileNumber || ''} ${b.status} ${b.cat} ${b.bucket} ${stageLabel(b.bucket)} ${b.attribute || ''} ${b.note || ''} ${b.holdReason || ''} ${b.budgetCode || ''} ${b.objectHead || ''} ${b.program || ''} ${b.district || ''} ${assigned} ${billAmount(b)} ${b.date || ''}`.toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

/** Stable sort; missing values (no date / no days) always go last, whichever the direction. */
export function sortBills(bills: Bill[], key: SortKey, dir: SortDir): Bill[] {
  const value = (b: Bill): string | number | null => {
    switch (key) {
      case 'vendor': return b.vendor.toLowerCase();
      case 'date': return b.date || null;
      case 'days': return b._days ?? null;
      case 'amount': return billAmount(b);
      case 'stage': return STAGES.indexOf(b.bucket);
    }
  };
  const sign = dir === 'asc' ? 1 : -1;
  return bills
    .map((bill, index) => ({ bill, index, v: value(bill) }))
    .sort((a, c) => {
      if (a.v === null || c.v === null) return a.v === c.v ? a.index - c.index : a.v === null ? 1 : -1;
      if (a.v < c.v) return -sign;
      if (a.v > c.v) return sign;
      return a.index - c.index;
    })
    .map(entry => entry.bill);
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { rows: rows.slice(start, start + size), page: current, pages, from: rows.length ? start + 1 : 0, to: Math.min(start + size, rows.length), total: rows.length };
}

/** Human description of the active filters, used in the CSV header and empty state. */
export function describeFilters(f: RegisterFilters, globalQuery: string): string[] {
  const parts: string[] = [];
  if (f.view) parts.push(`View = ${SAVED_VIEWS.find(v => v.id === f.view)?.label}`);
  if (f.stage) parts.push(`Stage = ${STAGE_GLOSSARY.find(s => s.stage === f.stage)?.label ?? f.stage}`);
  if (f.cat) parts.push(`Status = ${{ cleared: 'Cleared', in_progress: 'In progress', on_hold: 'On hold' }[f.cat]}`);
  if (f.vendor) parts.push(`Vendor = ${f.vendor}`);
  if (f.search.trim()) parts.push(`Search = "${f.search.trim()}"`);
  if (globalQuery.trim()) parts.push(`Global search = "${globalQuery.trim()}"`);
  return parts;
}

export function exportRows(bills: Bill[], users: UserProfile[]): Record<string, unknown>[] {
  return bills.map(b => ({
    Vendor: b.vendor,
    Invoice: b.invoice,
    'E-file number': b.efileNumber || '',
    'Invoice date': b.date || '',
    'Days open': b.cat === 'cleared' ? '' : b._days ?? '',
    Amount: billAmount(b),
    'Amount raised': b.amount,
    'Amount sanctioned': b.amountSanctioned ?? '',
    Stage: stageLabel(b.bucket),
    Status: b.cat,
    'Action needed': deriveReasons(b).map(code => REASONS[code].label).join('; '),
    'Cleared FY': b.clearedFY || '',
    'Payment attribute': b.attribute || '',
    Program: b.program || '',
    District: b.district || '',
    'Assigned to': users.find(user => user.id === b.assignedUserId)?.name || '',
    'Hold remark': b.holdReason || '',
    'Stage history': (b.stageHistory || []).map(entry => `${stageLabel(entry.stage)}: ${formatDateTime(entry.enteredAt)}`).join(' | '),
  }));
}

/** CSV for the current filtered view, preceded by "#" lines naming the export time and filters. */
export function buildRegisterCsv(bills: Bill[], users: UserProfile[], filters: string[], now = new Date()): string {
  const header = [
    '# MahaSTRIDE bill register export',
    `# Exported: ${formatDateTime(now)}`,
    `# Filters: ${filters.length ? filters.join('; ') : 'none (all bills)'}`,
    `# Rows: ${bills.length}`,
  ];
  return [...header, formatCSV(exportRows(bills, users))].join('\r\n');
}

export function exportFilename(now = new Date()): string {
  const d = formatDate(now).replace(/ /g, '-');
  return `bill-register-${d}`;
}
