// Optional, anonymised usage log for UX research (HCI case study).
// OFF by default: enabled only when the build sets VITE_RESEARCH_LOG=true AND the server sets
// RESEARCH_LOG_ENABLED=true. No user id, name, search text or record values are ever sent — only an
// anonymous per-tab session id, the event type, the page, interface-level detail and durations.

export type ResearchPage = 'bills' | 'budget' | 'transfers' | 'dashboard';
export type ResearchEventType = 'task_start' | 'task_end' | 'filter_used' | 'overdue_found' | 'error' | 'view';
export type ResearchDetail = Partial<Record<'task' | 'filter' | 'value' | 'source' | 'kind' | 'theme' | 'language' | 'width', string | number | boolean>>;

export interface ResearchEvent {
  sessionId: string;
  type: ResearchEventType;
  page: ResearchPage;
  detail?: ResearchDetail;
  durationMs?: number;
}

interface LoggerOptions {
  enabled: boolean;
  send: (events: ResearchEvent[]) => void;
  now?: () => number;
  sessionId?: string;
}

export function createResearchLogger({ enabled, send, now = () => performance.now(), sessionId = randomId() }: LoggerOptions) {
  let queue: ResearchEvent[] = [];
  const tasks = new Map<string, number>();
  const done = new Set<string>();

  function flush() {
    if (!queue.length) return;
    const batch = queue;
    queue = [];
    send(batch);
  }

  function track(type: ResearchEventType, page: ResearchPage, detail?: ResearchDetail, durationMs?: number) {
    if (!enabled) return;
    queue.push({ sessionId, type, page, ...(detail && { detail }), ...(durationMs !== undefined && { durationMs: Math.round(durationMs) }) });
    if (queue.length >= 20) flush();
  }

  return {
    enabled,
    track,
    flush,
    /** Starts a timed task once per session (e.g. "find_overdue" from page load). */
    startTask(task: string, page: ResearchPage) {
      if (!enabled || tasks.has(task) || done.has(task)) return;
      tasks.set(task, now());
      track('task_start', page, { task });
    },
    /** Ends a task and records how long it took. Later calls are ignored. */
    endTask(task: string, page: ResearchPage, type: ResearchEventType = 'task_end', detail: ResearchDetail = {}) {
      const started = tasks.get(task);
      if (!enabled || started === undefined) return;
      tasks.delete(task);
      done.add(task);
      track(type, page, { task, ...detail }, now() - started);
    },
  };
}

function randomId(): string {
  try {
    const existing = sessionStorage.getItem('mitra-research-session');
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem('mitra-research-session', id);
    return id;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

const enabled = import.meta.env.VITE_RESEARCH_LOG === 'true';
const apiBase = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/bill-api' : '')).replace(/\/+$/, '');

export const research = createResearchLogger({
  enabled,
  send: events => {
    const body = JSON.stringify({ events });
    // sendBeacon survives page close; fall back to a keepalive fetch.
    if (!navigator.sendBeacon?.(`${apiBase}/research/events`, new Blob([body], { type: 'application/json' }))) {
      void fetch(`${apiBase}/research/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  },
});

if (enabled && typeof window !== 'undefined') {
  window.setInterval(() => research.flush(), 10_000);
  window.addEventListener('pagehide', () => research.flush());
}
