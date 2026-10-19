import { useAppSettings } from '../lib/appSettings';

/** Placeholder blocks shaped like the content that is loading; announced once as "Loading…". */
export function Skeleton({ cards = 6, rows = 6, label = 'Loading bills…' }: { cards?: number; rows?: number; label?: string }) {
  const { t } = useAppSettings();
  return (
    <div className="skeleton" role="status" aria-busy="true">
      <span className="sr-only">{t(label)}</span>
      {cards > 0 && (
        <div className="skeleton-cards" aria-hidden="true">
          {Array.from({ length: cards }, (_, i) => <span key={i} className="skeleton-block skeleton-card" />)}
        </div>
      )}
      <div className="panel skeleton-panel" aria-hidden="true">
        <span className="skeleton-block skeleton-title" />
        {Array.from({ length: rows }, (_, i) => <span key={i} className="skeleton-block skeleton-row" style={{ width: `${92 - (i % 3) * 9}%` }} />)}
      </div>
    </div>
  );
}

/** Load failure with the server's reason and a Retry button. */
export function LoadError({ message, onRetry, busy = false }: { message: string; onRetry: () => void; busy?: boolean }) {
  const { t } = useAppSettings();
  return (
    <div className="panel load-error" role="alert">
      <h2>{t('Could not load the data')}</h2>
      <p>{t(message)}</p>
      <p className="note">{t('Check your connection, then try again. Nothing you entered has been lost.')}</p>
      <button type="button" className="btn primary" onClick={onRetry} disabled={busy}>{busy ? t('Retrying…') : t('Retry')}</button>
    </div>
  );
}
