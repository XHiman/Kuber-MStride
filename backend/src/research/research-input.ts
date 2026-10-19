// Validation for research payloads. Anything outside the whitelist is dropped, never stored.
import { BadRequestException } from '@nestjs/common';

export const EVENT_TYPES = ['task_start', 'task_end', 'filter_used', 'overdue_found', 'error', 'view'] as const;
export const PAGES = ['bills', 'budget', 'transfers', 'dashboard'] as const;
/** Detail keys that describe the interface, never the data (no search text, names or amounts). */
const DETAIL_KEYS = ['task', 'filter', 'value', 'source', 'kind', 'theme', 'language', 'width'] as const;
const MAX_EVENTS = 50;
export const MAX_COMMENT = 280;

export interface CleanEvent {
  sessionId: string;
  type: string;
  page: string;
  detail: string | null;
  durationMs: number | null;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function cleanDetail(detail: unknown): string | null {
  if (!isObject(detail)) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const key of DETAIL_KEYS) {
    const value = detail[key];
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) out[key] = value;
    // Short slug-like strings only (e.g. "stage", "overdue", "tfc"); free text is rejected.
    else if (typeof value === 'string' && /^[a-z0-9_.:-]{1,40}$/i.test(value)) out[key] = value;
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

export function cleanEvents(body: unknown): CleanEvent[] {
  const events = isObject(body) && Array.isArray(body.events) ? body.events : null;
  if (!events) throw new BadRequestException('events must be an array.');
  return events.slice(0, MAX_EVENTS).flatMap(raw => {
    if (!isObject(raw)) return [];
    const { sessionId, type, page, durationMs } = raw;
    if (typeof sessionId !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(sessionId)) return [];
    if (typeof type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(type)) return [];
    if (typeof page !== 'string' || !(PAGES as readonly string[]).includes(page)) return [];
    const duration = typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0 && durationMs < 86_400_000
      ? Math.round(durationMs)
      : null;
    return [{ sessionId, type, page, detail: cleanDetail(raw.detail), durationMs: duration }];
  });
}

export function cleanFeedback(body: unknown): { page: string; comment: string } {
  if (!isObject(body)) throw new BadRequestException('Invalid feedback.');
  const { page, comment } = body;
  if (typeof page !== 'string' || !(PAGES as readonly string[]).includes(page)) throw new BadRequestException('Unknown page.');
  if (typeof comment !== 'string' || !comment.trim()) throw new BadRequestException('Enter a comment.');
  // One line, capped; long digit runs (phone / account numbers) are masked before storage.
  const oneLine = comment.replace(/\s+/g, ' ').trim().slice(0, MAX_COMMENT)
    .replace(/\d(?:[ -]?\d){8,17}/g, match => `XXXX${match.replace(/\D/g, '').slice(-4)}`);
  return { page, comment: oneLine };
}
