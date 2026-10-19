// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bill } from '../../types';
import BillDrawer from './BillDrawer';

const bill = {
  id: 'b1', sr: 1, vendor: 'IVA -Lochan & Co.', invoice: 'LC/EInv/25Jul16', efileNumber: null, date: '2025-10-07',
  amount: 962891.6, amountSanctioned: null, budgetCode: 'A215', objectHead: '10', transferId: null, program: 'MahaSTRIDE',
  district: null, assignedUserId: null, bucket: 'Invoice Raised', cat: 'in_progress', onHold: false, holdReason: null,
  status: 'Please Check', attribute: 'Please Check', note: null, days: null, clearedFY: null, source: 't', _days: 377,
  effectiveAmount: 962891.6,
  stageHistory: [{ id: 'h1', stage: 'Invoice Raised', enteredAt: '2026-10-08T12:32:00Z', source: 'created' }],
} as Bill;

afterEach(cleanup);

describe('BillDrawer', () => {
  it('shows details and the timeline, focuses Close, and closes on Escape', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = vi.fn();
    const { unmount } = render(
      <BillDrawer bill={bill} users={[]} overdueDays={90} readOnly onClose={onClose} onEdit={vi.fn()} onNextStage={vi.fn()} onToggleHold={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'IVA -Lochan & Co.' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('₹9,62,892')).toBeTruthy(); // exact figure in details
    expect(screen.getByText('Overdue')).toBeTruthy();
    expect(screen.getByText('Bill created / imported', { exact: false })).toBeTruthy();
    expect(document.activeElement?.textContent).toContain('Close');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.activeElement).toBe(opener); // focus returns to the row that opened it
  });

  it('offers edit / next stage / hold only when signed in', () => {
    render(<BillDrawer bill={bill} users={[]} overdueDays={90} readOnly={false} onClose={vi.fn()} onEdit={vi.fn()} onNextStage={vi.fn()} onToggleHold={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Edit bill' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Move to next stage' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Put on hold' })).toBeTruthy();
  });
});
