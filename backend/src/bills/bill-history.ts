// Audit-trail events for a bill change: who, when (DB default), why.
import { normalizeStageBucket } from '../common/bill-utils';

export interface Actor {
  id: string;
  name: string;
}

export interface HistoryEvent {
  stage: string;
  /** 'created' | 'tracked' (stage move) | 'hold' | 'release'. Only 'tracked' counts as a stage move. */
  source: 'created' | 'tracked' | 'hold' | 'release';
  changedById: string | null;
  changedByName: string | null;
  note: string | null;
}

const MAX_NOTE = 500;

export function cleanNote(note: unknown): string | null {
  if (typeof note !== 'string') return null;
  const trimmed = note.trim().slice(0, MAX_NOTE);
  return trimmed || null;
}

type State = { bucket: string; onHold: boolean; holdReason: string | null };

/** Events to record when a bill goes from `previous` to `next` (previous = null for a new bill). */
export function historyEvents(previous: State | null, next: State, actor: Actor | null, note?: unknown): HistoryEvent[] {
  const who = { changedById: actor?.id ?? null, changedByName: actor?.name ?? null };
  const why = cleanNote(note);
  if (!previous) return [{ stage: next.bucket, source: 'created', ...who, note: why }];
  const events: HistoryEvent[] = [];
  if (normalizeStageBucket(previous.bucket) !== normalizeStageBucket(next.bucket)) {
    events.push({ stage: next.bucket, source: 'tracked', ...who, note: why });
  }
  if (!previous.onHold && next.onHold) {
    events.push({ stage: next.bucket, source: 'hold', ...who, note: why ?? next.holdReason });
  } else if (previous.onHold && !next.onHold) {
    events.push({ stage: next.bucket, source: 'release', ...who, note: why });
  }
  return events;
}
