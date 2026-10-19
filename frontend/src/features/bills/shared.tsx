// Helpers shared by the bill panels and register.
import { useAppSettings } from '../../lib/appSettings';
import { STAGE_GLOSSARY, isPlaceholder, plural, stageLabel } from '../../lib/status';
import { STAGES, type Bill } from '../../types';
import { normaliseVendor } from '../../lib/vendors';

export function billAmount(bill: Bill): number {
  return bill.effectiveAmount
    ?? (bill.bucket === 'Cleared by Treasury' && bill.amountSanctioned !== null
      ? bill.amountSanctioned
      : bill.amount);
}

export function stageClass(bucket: string): string {
  const stage = STAGES.indexOf(bucket) + 1;
  return stage > 0 ? `stage-${stage}` : 'stage-1';
}

/** Stage chip: colour + dot + glossary label, with an on-hold marker so status never relies on colour alone. */
export function StageChip({ bill }: { bill: Bill }) {
  const { t } = useAppSettings();
  const definition = STAGE_GLOSSARY.find(entry => entry.stage === bill.bucket)?.definition;
  return (
    <span className={`chip ${bill.cat} ${stageClass(bill.bucket)}`} title={definition ? t(definition) : undefined}>
      <span className="dot" aria-hidden="true" />
      {bill.cat === 'on_hold' && <span aria-hidden="true">⚠ </span>}
      {t(stageLabel(bill.bucket))}
      {bill.cat === 'on_hold' && <span className="sr-only"> · {t('On hold')}</span>}
    </span>
  );
}

/** Human reference for a bill in accessible names, tolerant of a missing invoice number. */
export function billRef(bill: Bill): string {
  const vendor = normaliseVendor(bill.vendor).name;
  return isPlaceholder(bill.invoice) || !bill.invoice?.trim() ? vendor : `${vendor} ${bill.invoice}`;
}

/** "377 days" / "No invoice date". */
export function DaysOpen({ days }: { days: number | null | undefined }) {
  const { t } = useAppSettings();
  if (days === null || days === undefined) return <span className="not-recorded">{t('No invoice date')}</span>;
  return <>{days} {t(plural(days, 'day'))}</>;
}

/** Text + icon flag for bills open longer than the overdue threshold. */
export function OverdueFlag({ threshold }: { threshold: number }) {
  const { t } = useAppSettings();
  return (
    <span className="overdue-flag" title={`${t('Open longer than')} ${threshold} ${t('days')}`}>
      <span aria-hidden="true">⏱ </span>{t('Overdue')}
    </span>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-mark" aria-hidden="true">—</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
    </div>
  );
}

/** Normalised vendor name; the raw spelling stays available in the tooltip when it differs. */
export function VendorName({ vendor }: { vendor: string }) {
  const { t, language } = useAppSettings();
  const name = normaliseVendor(vendor).name;
  // Vendor names are English data; mark them so screen readers switch voice inside the Marathi UI.
  const lang = language === 'mr' ? 'en' : undefined;
  if (name === vendor) return <span lang={lang}>{vendor}</span>;
  return <span className="vendor-normalised" lang={lang} title={`${t('Recorded as')}: ${vendor}`}>{name}</span>;
}
