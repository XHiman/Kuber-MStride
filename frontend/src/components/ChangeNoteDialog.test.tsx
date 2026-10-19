// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChangeNoteDialog from './ChangeNoteDialog';

afterEach(cleanup);

describe('ChangeNoteDialog', () => {
  it('passes the trimmed note to onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ChangeNoteDialog title="Move to next stage" description="ICARE: Invoice raised → PMC check" confirmLabel="Move bill" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Reason for change/), { target: { value: '  PMC accepted report  ' } });
    fireEvent.click(screen.getByText('Move bill'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('PMC accepted report'));
  });

  it('shows the server error and stays open', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Select both a budget code and object head before clearing the bill.'));
    render(<ChangeNoteDialog title="Move" description="d" confirmLabel="Move bill" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Move bill'));
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('budget code');
  });

  it('cancels', () => {
    const onCancel = vi.fn();
    render(<ChangeNoteDialog title="Move" description="d" confirmLabel="Move bill" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
