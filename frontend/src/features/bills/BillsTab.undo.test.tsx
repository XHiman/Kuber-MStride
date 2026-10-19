// @vitest-environment jsdom
// Integration test with a mocked API: stage move → toast with Undo → Undo restores the previous stage.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../components/Toast';
import type { Bill } from '../../types';

const bill = {
  id: 'b1', sr: 1, vendor: 'ICARE', invoice: 'ICARE/26/01', efileNumber: null, date: '2026-05-01', amount: 506000,
  amountSanctioned: null, budgetCode: null, objectHead: null, transferId: null, program: 'MahaSTRIDE', district: null,
  assignedUserId: null, bucket: 'Invoice Raised', cat: 'in_progress', onHold: false, holdReason: null, status: 'Received tax invoice',
  attribute: null, note: null, days: null, clearedFY: null, source: 't', stageHistory: [], _days: 171, effectiveAmount: 506000,
} as Bill;

const update = vi.fn().mockResolvedValue({});
vi.mock('../../lib/api', () => ({
  apiClient: {
    bills: {
      list: vi.fn(async () => [bill]),
      dashboard: vi.fn(async () => ({
        total: 506000, cleared: { amount: 0, count: 0 }, inProgress: { amount: 506000, count: 1 }, onHold: { amount: 0, count: 0 },
        stages: { 'Invoice Raised': { amount: 506000, count: 1, onHold: 0 } }, vendors: {}, oldestPending: null,
      })),
      update: (...args: unknown[]) => update(...args),
      create: vi.fn(),
    },
    users: { list: vi.fn(async () => []) },
    transfers: { records: vi.fn(async () => []) },
    districts: { records: vi.fn(async () => []) },
  },
}));

beforeEach(() => update.mockClear());
afterEach(cleanup);

describe('BillsTab undo', () => {
  it('moves a bill with a reason, then undoes it within the toast window', async () => {
    const { default: BillsTab } = await import('./BillsTab');
    render(<ToastProvider><BillsTab readOnly={false} /></ToastProvider>);
    const row = (await screen.findAllByRole('row')).find(r => r.classList.contains('bill-register-row'))!;
    fireEvent.click(within(row).getByRole('button', { name: /Move to next stage/ }));

    await screen.findByText(/Invoice raised → PMC check/);
    const dialog = document.querySelector<HTMLElement>('.note-dialog')!;
    fireEvent.change(within(dialog).getByLabelText(/Reason for change/), { target: { value: 'PMC received report' } });
    fireEvent.click(within(dialog).getByText('Move bill'));
    await waitFor(() => expect(update).toHaveBeenCalledWith('b1', { bucket: 'PMC Check Pending', changeNote: 'PMC received report' }));

    const toast = await screen.findByText(/moved to PMC check/);
    fireEvent.click(within(toast.closest('.toast') as HTMLElement).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(update).toHaveBeenLastCalledWith('b1', { bucket: 'Invoice Raised', changeNote: 'Undo of previous change' }));
    expect(await screen.findByText('Change undone')).toBeTruthy();
  });
});
