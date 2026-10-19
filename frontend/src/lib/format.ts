// One money and date format for the whole app.
// Money: Indian grouping with ₹. ≥ ₹1 Cr → "₹24.07 Cr", ≥ ₹1 L → "₹35.4 L", below ₹1 L the full figure "₹53,880".
// Dates: "19 Oct 2026" (dd MMM yyyy); timestamps add the local time, "19 Oct 2026, 14:05".

/** Exact rupees with Indian digit grouping, rounded to the rupee: ₹1,10,20,140. */
export function fmtIN(n: number): string {
  n = Math.round(n || 0);
  const neg = n < 0;
  n = Math.abs(n);
  const s = String(n);
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const out = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`
    : last3;
  return (neg ? '-' : '') + '₹' + out;
}

/** The app-wide display format (Cr / L suffixes, full figures below ₹1 L). */
export function fmtShort(n: number): string {
  n = n || 0;
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)} L`;
  return fmtIN(n);
}

export function pct(part: number, whole: number): number {
  return whole ? Math.round(part / whole * 100) : 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "19 Oct 2026". Date-only strings (YYYY-MM-DD) are read as calendar dates, so no time zone can shift
 * the day; full timestamps use the viewer's local date. Unparseable input is returned unchanged.
 */
export function formatDate(value: string | Date | null | undefined, empty = '—'): string {
  if (!value) return empty;
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${String(date.getDate()).padStart(2, '0')} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** "19 Oct 2026, 14:05" in the viewer's local time. */
export function formatDateTime(value: string | Date | null | undefined, empty = '—'): string {
  if (!value) return empty;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${formatDate(date)}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
