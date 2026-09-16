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
