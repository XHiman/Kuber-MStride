// Role-based scope for the personal dashboard.
// TODO(roles): placeholder roles. This shapes what the dashboard shows; it is NOT access control —
// the bills API remains publicly readable.
import type { Bill, UserProfile, UserRole } from '../types';
import { normaliseVendor } from './vendors';

export function roleOf(user: Pick<UserProfile, 'role'> | null | undefined): UserRole {
  return user?.role === 'dsu' ? 'dsu' : 'finance';
}

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Bills a user is responsible for: finance → all; DSU → own DSU district(s) plus anything assigned to them. */
export function scopeBills(bills: Bill[], user: UserProfile): Bill[] {
  if (roleOf(user) === 'finance') return bills;
  const districts = new Set(user.districts.map(key));
  return bills.filter(bill => {
    if (bill.assignedUserId === user.id) return true;
    const dsu = normaliseVendor(bill.vendor).dsu;
    return (!!dsu && districts.has(key(dsu))) || (!!bill.district && districts.has(key(bill.district)));
  });
}

export function scopeLabel(user: UserProfile): string {
  if (roleOf(user) === 'finance') return 'All bills (finance)';
  return user.districts.length ? `DSU: ${user.districts.join(', ')}` : 'DSU: no district set';
}

export interface WorkSummary {
  inScope: number;
  open: number;
  openAmount: number;
  onHold: number;
  assignedOpen: number;
  oldest: Bill | null;
}

/** Open = not cleared (held bills included). Oldest = longest open among dated bills. */
export function summariseWork(bills: Bill[], userId: string, amount: (bill: Bill) => number): WorkSummary {
  const open = bills.filter(bill => bill.cat !== 'cleared');
  const oldest = open
    .filter(bill => bill._days !== null && bill._days !== undefined)
    .sort((a, c) => (c._days ?? 0) - (a._days ?? 0))[0] ?? null;
  return {
    inScope: bills.length,
    open: open.length,
    openAmount: open.reduce((sum, bill) => sum + amount(bill), 0),
    onHold: open.filter(bill => bill.cat === 'on_hold').length,
    assignedOpen: open.filter(bill => bill.assignedUserId === userId).length,
    oldest,
  };
}
