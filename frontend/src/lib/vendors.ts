// Vendor name normalisation: the ONE place that maps raw vendor spellings to a display name.
// Display/grouping only. Raw `vendor` values in the database are never changed, and overall
// totals are unaffected; only per-vendor groupings merge. Approved 19 Oct 2026 (PLAN.md, A2).
// Ambiguous names (E & Y LLP Agriculture…, the Tata lines, PMC - KPMG …) are deliberately NOT merged.

export interface VendorEntry {
  /** Display name. */
  name: string;
  /** District Support Unit this vendor serves, or null for non-DSU payees. */
  dsu: string | null;
  /** Raw spellings seen in the data (compared loosely: case, spaces and punctuation ignored). */
  aliases: string[];
}

export const VENDOR_MAP: VendorEntry[] = [
  { name: 'DSU Nagpur – E&Y', dsu: 'Nagpur', aliases: ['DSU Nagpur- E & Y', 'Nagpur - E & Y'] },
  { name: 'DSU Nashik – KPMG', dsu: 'Nashik', aliases: ['DSU Nashik KPMG', 'DSU Nashik-KPMG', 'Nashik KPMG'] },
  { name: 'DSU Chh. Sambhajinagar – Choice', dsu: 'Chh. Sambhajinagar', aliases: ['DSU CSN- Choice', 'CSN - Choice'] },
  { name: 'DSU Pune – STC', dsu: 'Pune', aliases: ['DSU Pune - STC'] },
  // "Amra" = Amravati (confirmed 19 Oct 2026).
  { name: 'DSU Amravati – Linpico', dsu: 'Amravati', aliases: ['DSU Amra Linpico'] },
];

export const NON_DSU_GROUP = 'Other / non-DSU';

const looseKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');
const INDEX = new Map(VENDOR_MAP.flatMap(entry => entry.aliases.map(alias => [looseKey(alias), entry] as const)));

export interface NormalisedVendor {
  name: string;
  dsu: string | null;
}

/** Display name and DSU for a raw vendor string. Unmapped vendors keep their (whitespace-tidied) name. */
export function normaliseVendor(raw: string): NormalisedVendor {
  const entry = INDEX.get(looseKey(raw));
  if (entry) return { name: entry.name, dsu: entry.dsu };
  return { name: raw.replace(/\s+/g, ' ').trim(), dsu: null };
}

export type GroupBy = 'vendor' | 'dsu';

export interface VendorGroup {
  name: string;
  /** Distinct raw spellings that were merged into this group (for the tooltip). */
  rawNames: string[];
  count: number;
  total: number;
  cleared: number;
  in_progress: number;
  on_hold: number;
}

/** Group bills by normalised vendor or by DSU, sorted by total value (largest first). */
export function groupBills(
  bills: { vendor: string; cat: string; amount: number }[],
  by: GroupBy,
): VendorGroup[] {
  const groups = new Map<string, VendorGroup & { raw: Set<string> }>();
  for (const bill of bills) {
    const v = normaliseVendor(bill.vendor);
    const key = by === 'dsu' ? (v.dsu ? `DSU ${v.dsu}` : NON_DSU_GROUP) : v.name;
    let g = groups.get(key);
    if (!g) {
      g = { name: key, rawNames: [], raw: new Set(), count: 0, total: 0, cleared: 0, in_progress: 0, on_hold: 0 };
      groups.set(key, g);
    }
    g.raw.add(bill.vendor);
    g.count += 1;
    g.total += bill.amount;
    if (bill.cat === 'cleared' || bill.cat === 'in_progress' || bill.cat === 'on_hold') g[bill.cat] += bill.amount;
  }
  return [...groups.values()]
    .map(({ raw, ...g }) => ({ ...g, rawNames: [...raw].sort() }))
    .sort((a, c) => c.total - a.total || a.name.localeCompare(c.name));
}
