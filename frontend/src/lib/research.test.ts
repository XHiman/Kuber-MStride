import { describe, expect, it, vi } from 'vitest';
import { createResearchLogger, research } from './research';

describe('research logger', () => {
  it('is off by default (no VITE_RESEARCH_LOG in tests) and sends nothing', () => {
    expect(research.enabled).toBe(false);
    const send = vi.fn();
    const off = createResearchLogger({ enabled: false, send, sessionId: 'abcdefgh-1' });
    off.track('view', 'bills');
    off.startTask('find_overdue', 'bills');
    off.endTask('find_overdue', 'bills');
    off.flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('times a task once and batches events', () => {
    let clock = 1000;
    const send = vi.fn();
    const log = createResearchLogger({ enabled: true, send, now: () => clock, sessionId: 'abcdefgh-1' });
    log.startTask('find_overdue', 'bills');
    log.track('filter_used', 'bills', { filter: 'view', value: 'overdue' });
    clock = 13_500;
    log.endTask('find_overdue', 'bills', 'overdue_found', { source: 'drawer' });
    log.endTask('find_overdue', 'bills', 'overdue_found'); // ignored: already ended
    log.startTask('find_overdue', 'bills'); // ignored: once per session
    log.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual([
      { sessionId: 'abcdefgh-1', type: 'task_start', page: 'bills', detail: { task: 'find_overdue' } },
      { sessionId: 'abcdefgh-1', type: 'filter_used', page: 'bills', detail: { filter: 'view', value: 'overdue' } },
      { sessionId: 'abcdefgh-1', type: 'overdue_found', page: 'bills', detail: { task: 'find_overdue', source: 'drawer' }, durationMs: 12500 },
    ]);
  });

  it('flushes automatically every 20 events', () => {
    const send = vi.fn();
    const log = createResearchLogger({ enabled: true, send, sessionId: 'abcdefgh-1' });
    for (let i = 0; i < 20; i++) log.track('view', 'budget');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
