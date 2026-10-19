import { useAppSettings } from '../lib/appSettings';
import { fmtIN, fmtShort, formatDateTime } from '../lib/format';

/**
 * A rupee amount in the app-wide format (₹24.07 Cr / ₹35.4 L / ₹53,880).
 * The exact figure is always in the tooltip, and is shown inline when "Exact amounts" is on.
 */
export function Money({ value, exact }: { value: number; exact?: boolean }) {
  const { exactAmounts } = useAppSettings();
  const full = fmtIN(value);
  const short = fmtShort(value);
  const showExact = exact ?? exactAmounts;
  return (
    <span className="money" title={!showExact && full !== short ? full : undefined}>
      {showExact ? full : short}
    </span>
  );
}

/** "As of 19 Oct 2026, 14:05": when the figures beside it were loaded. */
export function AsOf({ at }: { at: Date | null }) {
  const { t } = useAppSettings();
  if (!at) return null;
  return (
    <span className="as-of">
      {t('As of')} <time dateTime={at.toISOString()}>{formatDateTime(at)}</time>
    </span>
  );
}
