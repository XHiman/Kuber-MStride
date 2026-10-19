// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function Trigger({ withUndo, onUndo }: { withUndo?: boolean; onUndo?: () => void }) {
  const toast = useToast();
  return <button onClick={() => toast('Bill moved to PMC check', withUndo ? { action: { label: 'Undo', onAction: onUndo! } } : {})}>go</button>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Toast', () => {
  it('announces and disappears after 5 s', () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByRole('status').textContent).toContain('Bill moved to PMC check');
    act(() => { vi.advanceTimersByTime(5_100); });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps an Undo action available for 10 s', async () => {
    const onUndo = vi.fn();
    render(<ToastProvider><Trigger withUndo onUndo={onUndo} /></ToastProvider>);
    fireEvent.click(screen.getByText('go'));
    act(() => { vi.advanceTimersByTime(9_000); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('expires the Undo window after 10 s', () => {
    render(<ToastProvider><Trigger withUndo onUndo={vi.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByText('go'));
    act(() => { vi.advanceTimersByTime(10_100); });
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('pauses while focused so keyboard users can reach Undo', () => {
    render(<ToastProvider><Trigger withUndo onUndo={vi.fn()} /></ToastProvider>);
    fireEvent.click(screen.getByText('go'));
    fireEvent.focus(screen.getByRole('button', { name: 'Undo' }));
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });
});
