import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppSettings } from '../lib/appSettings';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastOptions {
  kind?: ToastKind;
  /** Optional action, e.g. Undo. The toast stays for `duration` ms so the action can be used. */
  action?: { label: string; onAction: () => Promise<void> | void };
  /** Default 5 s; 10 s when there is an action (Undo window). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/**
 * Toasts announced through a polite live region (errors use role="alert").
 * Hovering or focusing a toast pauses its timer so the Undo button is always reachable by keyboard.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(item => item.id !== id)), []);
  const show = useCallback((message: string, options: ToastOptions = {}) => {
    const id = nextId.current++;
    setToasts(list => [...list.slice(-2), { id, message, ...options }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map(toast => <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />)}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { t } = useAppSettings();
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const remaining = useRef(toast.duration ?? (toast.action ? 10_000 : 5_000));
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(onDismiss, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onDismiss]);

  async function runAction() {
    if (!toast.action) return;
    setBusy(true);
    try {
      await toast.action.onAction();
    } finally {
      onDismiss();
    }
  }

  const kind = toast.kind ?? 'success';
  return (
    <div
      className={`toast toast-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-icon" aria-hidden="true">{kind === 'error' ? '!' : kind === 'info' ? 'i' : '✓'}</span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button type="button" className="btn toast-action" onClick={() => void runAction()} disabled={busy}>
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast-close" onClick={onDismiss} aria-label={t('Dismiss notification')}>×</button>
    </div>
  );
}
