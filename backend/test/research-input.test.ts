import { describe, expect, it } from 'vitest';
import { cleanEvents, cleanFeedback } from '../src/research/research-input';

const sessionId = '3f2a9c1e-7b4d-4a8e-9f00-123456789abc';

describe('cleanEvents', () => {
  it('keeps whitelisted events and interface-only detail', () => {
    expect(cleanEvents({ events: [
      { sessionId, type: 'filter_used', page: 'bills', detail: { filter: 'view', value: 'overdue' } },
      { sessionId, type: 'overdue_found', page: 'bills', durationMs: 12345.6, detail: { task: 'find_overdue' } },
    ] })).toEqual([
      { sessionId, type: 'filter_used', page: 'bills', detail: '{"filter":"view","value":"overdue"}', durationMs: null },
      { sessionId, type: 'overdue_found', page: 'bills', detail: '{"task":"find_overdue"}', durationMs: 12346 },
    ]);
  });

  it('drops personal or free-text data', () => {
    const [event] = cleanEvents({ events: [{
      sessionId, type: 'filter_used', page: 'bills',
      detail: { filter: 'search', value: 'Asha Patil nagpur', userId: 'u1', name: 'Asha', email: 'a@b.c' },
    }] });
    expect(event.detail).toBe('{"filter":"search"}');
  });

  it('rejects unknown types, pages and malformed session ids', () => {
    expect(cleanEvents({ events: [
      { sessionId, type: 'keystroke', page: 'bills' },
      { sessionId, type: 'view', page: 'admin' },
      { sessionId: 'Asha Patil', type: 'view', page: 'bills' },
      { sessionId, type: 'view', page: 'bills', durationMs: -5 },
    ] })).toEqual([{ sessionId, type: 'view', page: 'bills', detail: null, durationMs: null }]);
  });

  it('caps a batch at 50 events', () => {
    const many = Array.from({ length: 80 }, () => ({ sessionId, type: 'view', page: 'bills' }));
    expect(cleanEvents({ events: many })).toHaveLength(50);
  });
});

describe('cleanFeedback', () => {
  it('stores one masked line with the page', () => {
    expect(cleanFeedback({ page: 'budget', comment: '  Totals unclear.\nCall me on 9876543210  ' }))
      .toEqual({ page: 'budget', comment: 'Totals unclear. Call me on XXXX3210' });
  });
  it('caps length and rejects empty or unknown pages', () => {
    expect(cleanFeedback({ page: 'bills', comment: 'x'.repeat(400) }).comment).toHaveLength(280);
    expect(() => cleanFeedback({ page: 'bills', comment: '   ' })).toThrow();
    expect(() => cleanFeedback({ page: 'adminX', comment: 'hi' })).toThrow();
  });
});
