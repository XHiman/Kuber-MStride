import { useId, useMemo, useState } from 'react';
import { AsOf, Money } from '../../components/Money';
import { RecordedText, ReasonBadges } from '../../components/StatusGlossary';
import { AGING_BUCKETS, agingBucket, isOpen, isOverdue, parseThreshold, summariseAging, type AgingBucketId } from '../../lib/aging';
import { useAppSettings } from '../../lib/appSettings';
import { plural } from '../../lib/status';
import type { Bill } from '../../types';
import { DaysOpen, EmptyState, OverdueFlag, StageChip, VendorName, billAmount, billRef } from './shared';

type Props = {
  bills: Bill[];
  asOf: Date | null;
  threshold: number;
  onThresholdChange: (days: number) => void;
  onOpen: (bill: Bill) => void;
  readOnly: boolean;
};

/** Aging buckets (count + value) for open bills, and the open-bill list, oldest first. */
export default function AgingPanel({ bills, asOf, threshold, onThresholdChange, onOpen, readOnly }: Props) {
  const { t } = useAppSettings();
  const thresholdId = useId();
  const [bucketFilter, setBucketFilter] = useState<AgingBucketId | ''>('');
  const summary = useMemo(() => summariseAging(bills.map(b => ({ ...b, effectiveAmount: billAmount(b) }))), [bills]);
  const overdueCount = bills.filter(b => isOverdue(b, threshold)).length;
  const maxAmount = Math.max(...Object.values(summary).map(s => s.amount), 1);

  const rows = useMemo(() => bills
    .filter(b => isOpen(b) && (!bucketFilter || agingBucket(b._days) === bucketFilter))
    // Oldest first; undated bills last.
    .sort((a, c) => (c._days ?? -1) - (a._days ?? -1)), [bills, bucketFilter]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{t('Aging of open bills')}</h2>
        <span className="note">{t('days since invoice date, all uncleared bills incl. on hold')} · <AsOf at={asOf} /></span>
      </div>

      <div className="aging-controls">
        <label htmlFor={thresholdId}>{t('Overdue after')}</label>
        <input
          id={thresholdId}
          type="number"
          min={1}
          max={3650}
          value={threshold}
          onChange={event => onThresholdChange(parseThreshold(event.target.value))}
        />
        <span>{t('days')}</span>
        <strong className="aging-overdue-count">
          <span aria-hidden="true">⏱ </span>{overdueCount} {t(plural(overdueCount, 'bill'))} {t('overdue')}
        </strong>
      </div>

      <div className="aging-buckets" role="group" aria-label={t('Filter by age')}>
        {AGING_BUCKETS.map(bucket => {
          const s = summary[bucket.id];
          const selected = bucketFilter === bucket.id;
          return (
            <button
              key={bucket.id}
              type="button"
              className={`aging-bucket aging-${bucket.id}${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => setBucketFilter(selected ? '' : bucket.id)}
            >
              <span className="aging-label">{t(bucket.label)}</span>
              <span className="aging-count">{s.count} {t(plural(s.count, 'bill'))}</span>
              <span className="aging-amount mono"><Money value={s.amount} /></span>
              <span className="aging-track" aria-hidden="true"><span style={{ width: `${Math.round(s.amount / maxAmount * 100)}%` }} /></span>
            </button>
          );
        })}
      </div>

      <div className="table-scroll pending-bills-scroll">
        <table>
          <caption className="sr-only">
            {t('Open bills, oldest first')}{bucketFilter ? ` · ${t(AGING_BUCKETS.find(b => b.id === bucketFilter)!.label)}` : ''}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Vendor')}</th><th scope="col">{t('Invoice')}</th><th scope="col" className="num">{t('Days open')}</th>
              <th scope="col" className="num">{t('Amount')}</th><th scope="col">{t('Stage')}</th><th scope="col">{t('Current status')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(b => (
              <tr key={b.id}>
                <td className="vendor-cell">
                  {readOnly ? <VendorName vendor={b.vendor} /> : <button type="button" className="link-btn" onClick={() => onOpen(b)} aria-label={`${t('Edit')}: ${billRef(b)}`}><VendorName vendor={b.vendor} /></button>}
                </td>
                <td className="inv-cell mono"><RecordedText value={b.invoice} /></td>
                <td className="num mono">
                  <DaysOpen days={b._days} />
                  {isOverdue(b, threshold) && <><br /><OverdueFlag threshold={threshold} /></>}
                </td>
                <td className="num amt-cell mono"><Money value={billAmount(b)} /></td>
                <td><StageChip bill={b} /></td>
                <td className="status-cell"><RecordedText value={b.status} /> <ReasonBadges bill={b} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title={t('No open bills in this range')} detail={t('Choose another age range or clear the selection.')} />}
      </div>
    </div>
  );
}
