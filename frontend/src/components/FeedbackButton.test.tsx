// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast';

const feedback = vi.fn().mockResolvedValue({ saved: true });
vi.mock('../lib/api', () => ({ apiClient: { research: { feedback: (...args: unknown[]) => feedback(...args) } } }));

afterEach(cleanup);

describe('FeedbackButton', () => {
  it('sends one trimmed line with the page name and confirms', async () => {
    const { default: FeedbackButton } = await import('./FeedbackButton');
    render(<ToastProvider><FeedbackButton page="budget" /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Feedback/ }));
    const input = screen.getByLabelText(/clearer or faster/) as HTMLInputElement;
    expect(input.maxLength).toBe(280);
    fireEvent.change(input, { target: { value: '  FY totals are hard to compare  ' } });
    fireEvent.click(screen.getByText('Send feedback', { selector: 'button' }));
    await waitFor(() => expect(feedback).toHaveBeenCalledWith({ page: 'budget', comment: 'FY totals are hard to compare' }));
    expect(await screen.findByText(/your feedback was saved/)).toBeTruthy();
  });
});
