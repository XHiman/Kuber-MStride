import { useId, useMemo, useState } from 'react';
import { AsOf, Money } from '../../components/Money';
import { ReasonBadges, RecordedText } from '../../components/StatusGlossary';
import { isOverdue } from '../../lib/aging';
import { useAppSettings } from '../../lib/appSettings';
import { REASONS, deriveReasons, plural } from '../../lib/status';
import type { Bill, UserProfile } from '../../types';
import { DaysOpen, EmptyState, OverdueFlag, StageChip, VendorName, billAmount, billRef } from './shared';

type Props = {
  bills: Bill[];
  users: UserProfile[];
  asOf: Date | null;
  threshold: number;
  readOnly: boolean;
  onEdit: (bill: Bill) => void;
  onAssign: (bill: Bill, userId: string | null) => Promise<void>;
  onResolveHold: (bill: Bill) => Promise<void>;
};

/** On-hold bills first, then bills with missing data, each with owner, next action and controls. */
export default function NeedsActionPanel({ bills, users, asOf, threshold, readOnly, onEdit, onAssign, onResolveHold }: Props) {
  const { t } = useAppSettings();
  const items = useMemo(() => bills
    .filter(b => b.cat === 'on_hold' || deriveReasons(b).length > 0)
    .sort((a, c) => Number(c.cat === 'on_hold') - Number(a.cat === 'on_hold') || (c._days ?? -1) - (a._days ?? -1)), [bills]);
  const heldCount = items.filter(b => b.cat === 'on_hold').length;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{t('Needs action')}</h2>
        <span className="note">{items.length} {t(plural(items.length, 'bill'))} · {heldCount} {t('on hold')} · <AsOf at={asOf} /></span>
      </div>
      <ul className="exception-scroll action-list">
        {items.map(b => (
          <ActionCard key={b.id} bill={b} users={users} threshold={threshold} readOnly={readOnly} onEdit={onEdit} onAssign={onAssign} onResolveHold={onResolveHold} />
        ))}
      </ul>
      {items.length === 0 && <EmptyState title={t('Nothing needs attention')} detail={t('On-hold bills and bills with missing details will be listed here.')} />}
    </div>
  );
}

function ActionCard({ bill: b, users, threshold, readOnly, onEdit, onAssign, onResolveHold }: Omit<Props, 'bills' | 'asOf'> & { bill: Bill }) {
  const { t } = useAppSettings();
  const assignId = useId();
  const [busy, setBusy] = useState(false);
  const held = b.cat === 'on_hold';
  const reason = deriveReasons(b)[0];
  const owner = users.find(user => user.id === b.assignedUserId)?.name;
  const nextAction = held
    ? (b.holdReason ? `${t('Resolve:')} ${b.holdReason}` : t('No hold remark provided.'))
    : t(REASONS[reason]?.action ?? '');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }

  return (
    <li className={`exc-item${held ? ' is-held' : ''}`}>
      <div className="exc-top">
        <span><VendorName vendor={b.vendor} /> · <RecordedText value={b.invoice} /></span>
        <span className="exc-amt mono"><Money value={billAmount(b)} /></span>
      </div>
      <ReasonBadges bill={b} />
      <dl className="action-facts">
        <div><dt>{t('Days open')}</dt><dd><DaysOpen days={b._days} />{isOverdue(b, threshold) && <> <OverdueFlag threshold={threshold} /></>}</dd></div>
        <div><dt>{t('Stage')}</dt><dd><StageChip bill={b} /></dd></div>
        <div><dt>{t('Owner')}</dt><dd>{owner ?? <span className="not-recorded">{t('Unassigned')}</span>}</dd></div>
        <div className="action-next"><dt>{t('Next action')}</dt><dd>{nextAction}</dd></div>
      </dl>
      {!readOnly && (
        <div className="action-controls">
          <label htmlFor={assignId} className="sr-only">{t('Assign')} {billRef(b)}</label>
          <select
            id={assignId}
            value={b.assignedUserId ?? ''}
            disabled={busy}
            onChange={event => void run(() => onAssign(b, event.target.value || null))}
          >
            <option value="">{t('Assign to…')}</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          {held
            ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`${t('Mark as resolved and release the hold on')} ${billRef(b)}?`)) void run(() => onResolveHold(b));
                }}
              >
                {t('Mark resolved')}
              </button>
            )
            : <button type="button" className="btn" disabled={busy} onClick={() => onEdit(b)}>{t('Fix details')}</button>}
        </div>
      )}
    </li>
  );
}
