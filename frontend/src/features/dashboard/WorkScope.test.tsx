// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bill, UserProfile } from '../../types';
import WorkScope from './WorkScope';

const bill = (id: string, over: Partial<Bill>) => ({
  id, vendor: 'ICARE', invoice: `I-${id}`, district: null, assignedUserId: null, cat: 'in_progress', bucket: 'Invoice Raised',
  status: 'Received', _days: 10, amount: 100000, effectiveAmount: 100000, date: '2026-01-01', efileNumber: null, holdReason: null,
  stageHistory: [], ...over,
} as Bill);
const bills = [
  bill('a', { vendor: 'Nagpur - E & Y', _days: 377 }),
  bill('b', { vendor: 'DSU Pune - STC', _days: 50 }),
  bill('c', { vendor: 'ICARE', assignedUserId: 'u1', cat: 'on_hold', holdReason: 'Query', _days: 120 }),
  bill('d', { vendor: 'DSU Nagpur- E & Y', cat: 'cleared', bucket: 'Cleared by Treasury', _days: null }),
];
const user = (over: Partial<UserProfile>): UserProfile => ({ id: 'u1', name: 'Asha Patil', programs: [], districts: [], ...over });

afterEach(cleanup);

describe('WorkScope', () => {
  it('shows name, scope, open count and oldest item for a finance user', () => {
    render(<WorkScope user={user({})} bills={bills} districtRecords={[]} loadedAt={null} onLogout={vi.fn()} />);
    const identity = screen.getByText('Name').closest<HTMLElement>('dl')!;
    expect(within(identity).getByText('Asha Patil')).toBeTruthy();
    expect(within(identity).getByText('Finance user')).toBeTruthy();
    expect(within(identity).getByText('All bills (finance)')).toBeTruthy();
    const open = screen.getByText('Open items').closest<HTMLElement>('.stat')!;
    expect(within(open).getByText('3')).toBeTruthy();
    const oldest = screen.getByText('Oldest open item').closest<HTMLElement>('.stat')!;
    expect(oldest.textContent).toContain('377 days');
    expect(oldest.textContent).toContain('DSU Nagpur – E&Y');
    expect(screen.getByText('Assigned to you').closest('.stat')!.textContent).toContain('1');
  });

  it('limits a DSU user to their DSU plus assigned bills', () => {
    render(<WorkScope user={user({ role: 'dsu', districts: ['Pune'] })} bills={bills} districtRecords={[]} loadedAt={null} onLogout={vi.fn()} />);
    expect(screen.getByText('DSU: Pune')).toBeTruthy();
    const rows = screen.getAllByRole('row').slice(1).map(r => r.textContent);
    expect(rows).toHaveLength(2); // Pune bill + the bill assigned to this user
    expect(rows[0]).toContain('120 days'); // oldest first
  });
});
