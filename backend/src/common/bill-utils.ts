// Bill stage inference — mirrors the classifyStatus function from the HTML reference.
// Stage 0 = Invoice Raised (no status), 1 = Invoice Raised, 2 = PMC Check,
// 3 = TFC/TEC Committee Approval, 4 = Put Up on File, 5 = Sent to Treasury, 6 = Cleared by Treasury

export type BillCategory = 'cleared' | 'in_progress' | 'on_hold';

export const FISCAL_YEARS = Array.from({ length: 6 }, (_, index) => {
  const startYear = 2024 + index;
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
});

export function fiscalYearOf(date: Date): string {
  return fyOf(date.getFullYear(), date.getMonth() + 1);
}

export interface StageResult {
  stage: number;
  bucket: string;
  cat: BillCategory;
  note: string;
}

export function normalizeStageBucket(bucket: string | null | undefined): string {
  const raw = (bucket ?? '').trim();
  if (!raw) return 'Invoice Raised';

  const key = raw.toLowerCase()
    .replace(/[_/.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const aliases: Record<string, string> = {
    'invoice raised': 'Invoice Raised',
    'invoice raised pending': 'Invoice Raised',
    'pmc check': 'PMC Check',
    'pmc check pending': 'PMC Check',
    'pmc pending': 'PMC Check',
    'check by pmc': 'PMC Check',
    'tfc tec committee approval': 'TFC/TEC Committee Approval',
    'tfc/tec committee approval': 'TFC/TEC Committee Approval',
    'tfc tec approval': 'TFC/TEC Committee Approval',
    'tfc committee approval': 'TFC/TEC Committee Approval',
    'tfc committee approv': 'TFC/TEC Committee Approval',
    'tfc approval': 'TFC/TEC Committee Approval',
    'file approval pending': 'Put Up on File',
    'file approval': 'Put Up on File',
    'put up on file': 'Put Up on File',
    'putting it up on file': 'Put Up on File',
    'sent to treasury': 'Sent to Treasury',
    'submitted to treasury': 'Sent to Treasury',
    'sent to treausary': 'Sent to Treasury',
    'treasury clearance': 'Treasury Clearance',
    'clearance by treasury': 'Treasury Clearance',
    'cleared by treasury': 'Treasury Clearance',
    'bill passed': 'Treasury Clearance',
    'bill passed cleared by treasury': 'Treasury Clearance',
  };

  return aliases[key] ?? raw;
}

export function classifyStatus(statusRaw: string | null | undefined): StageResult {
  const s = (statusRaw || '').toLowerCase();
  const hasObj = /\bobj/.test(s);

  if (s.indexOf('bill') > -1 && s.indexOf('passed') > -1 && s.indexOf('to be') === -1)
    return { stage: 6, bucket: 'Cleared by Treasury', cat: 'cleared', note: 'Bill passed / cleared by treasury' };

  if (s.indexOf('to be') > -1 && s.indexOf('passed') > -1)
    return { stage: 5, bucket: 'Sent to Treasury', cat: 'in_progress', note: 'At treasury — clearance date scheduled' };

  if (s.indexOf('submitted to treausary') > -1 || s.indexOf('submitted to treasury') > -1)
    return { stage: 5, bucket: 'Sent to Treasury', cat: 'in_progress', note: 'Bill submitted to treasury, awaiting clearance' };

  if (s.indexOf('treausary order') > -1 || s.indexOf('treasury order') > -1)
    return { stage: 5, bucket: 'Sent to Treasury', cat: 'in_progress', note: 'Treasury order issued' };

  if (hasObj)
    return { stage: 4, bucket: 'Put Up on File', cat: 'on_hold', note: 'Filed but objected at district/reviewing level — needs resolution' };

  if (s.indexOf('file submitted') > -1 || s.indexOf('file submited') > -1)
    return { stage: 4, bucket: 'Put Up on File', cat: 'in_progress', note: 'File submitted, pending treasury submission' };

  if (s.indexOf('file for submission') > -1)
    return { stage: 4, bucket: 'Put Up on File', cat: 'in_progress', note: 'TFC approved; file being put up for release' };

  if (s.indexOf('approved by committee') > -1 || s.indexOf('committee approved') > -1)
    return { stage: 3, bucket: 'TFC/TEC Committee Approval', cat: 'in_progress', note: 'Approved by committee' };

  if (s.indexOf('iva report is still not received') > -1)
    return { stage: 2, bucket: 'PMC Check', cat: 'on_hold', note: 'IVA report awaited before PMC can clear' };

  if (s.indexOf('div comm') > -1 && s.indexOf('not') > -1)
    return { stage: 2, bucket: 'PMC Check', cat: 'on_hold', note: 'Divisional Commissioner acceptance confirmation awaited' };

  if (s.indexOf('report awaited') > -1)
    return { stage: 2, bucket: 'PMC Check', cat: 'on_hold', note: 'Deliverable/MPR report awaited before PMC check' };

  if (s.indexOf('received tax invoice') === 0 || s.indexOf('received proforma invoice') === 0 || s.indexOf('received ') === 0)
    return { stage: 1, bucket: 'Invoice Raised', cat: 'in_progress', note: 'Invoice received — PMC check pending' };

  if (!statusRaw)
    return { stage: 0, bucket: 'Invoice Raised', cat: 'in_progress', note: 'No status recorded' };

  return { stage: 1, bucket: 'Invoice Raised', cat: 'in_progress', note: statusRaw };
}

// Extract clearance date from free-text status (e.g. "Bill PASSED on 04.08.2026")
export function extractClearDate(statusRaw: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!statusRaw) return null;
  const m = /passed[^0-9]{0,8}(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/i.exec(statusRaw);
  if (!m) return null;
  let d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

// Indian FY runs Apr-Mar. Returns "FY 2026-27" style string.
export function fyOf(y: number, m: number): string {
  const startY = (m >= 4) ? y : y - 1;
  const endYY = String((startY + 1) % 100).padStart(2, '0');
  return `FY ${startY}-${endYY}`;
}

export function clearedFYOf(date: Date | null | undefined): string | null {
  if (!date) return null;
  return fiscalYearOf(date);
}

// Days pending from invoice date (for non-cleared bills)
export function daysPending(dateStr: Date | null | undefined): number | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

// Indian number formatting (₹1,23,456)
export function fmtIN(n: number): string {
  n = Math.round(n || 0);
  const neg = n < 0;
  n = Math.abs(n);
  const s = String(n);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const out = (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') : '') + ',' + last3;
  return (neg ? '-' : '') + '₹' + out;
}

export function fmtShort(n: number): string {
  n = n || 0;
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return fmtIN(n);
}

export function pct(part: number, whole: number): number {
  return whole ? Math.round(part / whole * 100) : 0;
}
