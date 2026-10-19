// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bill, UserProfile } from '../../types';
import NeedsActionPanel from './NeedsActionPanel';

const bill = (over: Partial<Bill>): Bill => ({
  id: 'b1', sr: 1, vendor: 'DSU CSN- Choice', invoice: 'CCS/25-26/04-47', efileNumber: null, date: '2025-10-07',
  amount: 3537097, amountSanctioned: null, budgetCode: null, objectHead: null, transferId: null, program: null,
  district: null, assignedUserId: null, bucket: 'File Approval Pending', cat: 'on_hold', onHold: true,
  holdReason: 'They Did not Share the Handover Data to us', status: 'File submitted', attribute: null, note: null,
  days: null, clearedFY: null, source: 'test', stageHistory: [], _days: 377, effectiveAmount: 3537097,
  ...over,
} as Bill);

const users: UserProfile[] = [{ id: 'u1', name: 'Asha Patil', programs: [], districts: [] }];

afterEach(cleanup);

describe('NeedsActionPanel', () => {
  it('shows bill, days open, stage, owner and next action', () => {
    render(<NeedsActionPanel bills={[bill({})]} users={users} asOf={null} threshold={90} readOnly onEdit={vi.fn()} onAssign={vi.fn()} onResolveHold={vi.fn()} />);
    const card = screen.getByRole('listitem');
    expect(within(card).getByText(/DSU CSN- Choice/)).toBeTruthy();
    expect(within(card).getByText('377 days')).toBeTruthy();
    expect(within(card).getByText('Overdue')).toBeTruthy();
    expect(within(card).getByText('File approval pending')).toBeTruthy();
    expect(within(card).getByText('Unassigned')).toBeTruthy();
    expect(within(card).getByText(/Resolve: They Did not Share/)).toBeTruthy();
    expect(within(card).queryByRole('button')).toBeNull(); // read-only: no controls
  });

  it('assigns and resolves through the handlers', async () => {
    const onAssign = vi.fn().mockResolvedValue(undefined);
    const onResolveHold = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<NeedsActionPanel bills={[bill({})]} users={users} asOf={null} threshold={90} readOnly={false} onEdit={vi.fn()} onAssign={onAssign} onResolveHold={onResolveHold} />);
    fireEvent.change(screen.getByLabelText(/Assign/), { target: { value: 'u1' } });
    expect(onAssign).toHaveBeenCalledWith(expect.objectContaining({ id: 'b1' }), 'u1');
    const resolve = screen.getByRole('button', { name: 'Mark resolved' }) as HTMLButtonElement;
    await waitFor(() => expect(resolve.disabled).toBe(false));
    fireEvent.click(resolve);
    expect(onResolveHold).toHaveBeenCalledTimes(1);
  });

  it('offers "Fix details" for missing-data bills', () => {
    const onEdit = vi.fn();
    render(<NeedsActionPanel bills={[bill({ id: 'b2', cat: 'in_progress', onHold: false, holdReason: null, date: null, _days: null, bucket: 'Invoice Raised' })]} users={users} asOf={null} threshold={90} readOnly={false} onEdit={onEdit} onAssign={vi.fn()} onResolveHold={vi.fn()} />);
    expect(screen.getAllByText('No invoice date').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Fix details' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
