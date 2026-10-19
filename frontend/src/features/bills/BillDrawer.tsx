import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Money } from '../../components/Money';
import { ReasonBadges, RecordedText } from '../../components/StatusGlossary';
import { isOverdue } from '../../lib/aging';
import { useAppSettings } from '../../lib/appSettings';
import { formatDate, formatDateTime } from '../../lib/format';
import { stageLabel } from '../../lib/status';
import { STAGES, type Bill, type UserProfile } from '../../types';
import { DaysOpen, OverdueFlag, StageChip, billAmount } from './shared';

type Props = {
  bill: Bill;
  users: UserProfile[];
  overdueDays: number;
  readOnly: boolean;
  onClose: () => void;
  onEdit: (bill: Bill) => void;
  onNextStage: (bill: Bill) => void;
  onToggleHold: (bill: Bill) => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Side drawer with a bill's details and its full stage timeline. Esc closes; focus returns to the opener. */
export default function BillDrawer({ bill, users, overdueDays, readOnly, onClose, onEdit, onNextStage, onToggleHold }: Props) {
  const { t } = useAppSettings();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const owner = users.find(user => user.id === bill.assignedUserId)?.name;
  const timeline = [...(bill.stageHistory ?? [])].sort((a, c) => a.enteredAt.localeCompare(c.enteredAt));
  const isLastStage = STAGES.indexOf(bill.bucket) === STAGES.length - 1;

  const facts: [string, React.ReactNode][] = [
    ['Invoice no.', <RecordedText value={bill.invoice} />],
    ['E-file no.', bill.efileNumber || <span className="not-recorded">{t('Not recorded')}</span>],
    ['Invoice date', bill.date ? formatDate(bill.date) : <span className="not-recorded">{t('Not recorded')}</span>],
    ['Days open', bill.cat === 'cleared' ? t('Cleared') : <><DaysOpen days={bill._days} />{isOverdue(bill, overdueDays) && <> <OverdueFlag threshold={overdueDays} /></>}</>],
    ['Amount', <Money value={billAmount(bill)} exact />],
    ['Assigned to', owner ?? <span className="not-recorded">{t('Unassigned')}</span>],
    ['Program / District', bill.program || bill.district || '—'],
    ['Budget code', [bill.budgetCode, bill.objectHead].filter(Boolean).join(' / ') || '—'],
    ['Payment attribute', <RecordedText value={bill.attribute} />],
    ['Cleared FY', bill.clearedFY || '—'],
  ];

  return createPortal(
    <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={panelRef} className="bill-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}>
        <header className="drawer-head">
          <div>
            <p className="history-modal-kicker">{t('Bill details')}</p>
            <h2 id={titleId}>{bill.vendor}</h2>
            <div className="drawer-chips"><StageChip bill={bill} /> <ReasonBadges bill={bill} max={4} /></div>
          </div>
          <button ref={closeRef} type="button" className="btn" onClick={onClose}>{t('Close')}<span className="sr-only"> {t('bill details')}</span></button>
        </header>

        <div className="drawer-body">
          <dl className="drawer-facts">
            {facts.map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value}</dd></div>)}
          </dl>
          <section aria-labelledby={`${titleId}-status`}>
            <h3 id={`${titleId}-status`}>{t('Current status')}</h3>
            <p className="drawer-status"><RecordedText value={bill.status} /></p>
            {bill.cat === 'on_hold' && <p className="drawer-hold"><strong>{t('On-hold remarks')}:</strong> {bill.holdReason || t('No hold remark provided.')}</p>}
          </section>

          <section aria-labelledby={`${titleId}-timeline`}>
            <h3 id={`${titleId}-timeline`}>{t('Stage timeline')} <span className="note">· {t('oldest first')}</span></h3>
            {timeline.length === 0
              ? <p className="note">{t('No stage history recorded.')}</p>
              : (
                <ol className="history-timeline">
                  {timeline.map((entry, index) => {
                    const isCurrent = index === timeline.length - 1 && entry.stage === bill.bucket;
                    const imported = entry.source === 'migration_snapshot' || entry.source === 'legacy_backup_snapshot';
                    return (
                      <li key={entry.id} className={`history-timeline-entry${isCurrent ? ' is-current' : ''}${imported ? ' is-snapshot' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
                        <span className="history-timeline-marker" aria-hidden="true" />
                        <div className="history-event-card">
                          <div className="history-event-topline">
                            <span className="history-event-stage">{t(stageLabel(entry.stage))}</span>
                            {isCurrent && <span className="history-current-badge">{t('Current')}</span>}
                          </div>
                          <time className="history-event-time" dateTime={entry.enteredAt}>{formatDateTime(entry.enteredAt)}</time>
                          <span className="history-event-source">
                            {t(imported ? 'Imported snapshot' : entry.source === 'created' ? 'Bill created / imported' : 'Stage changed')}
                            {' · '}{t('Changed by')}: <span className="not-recorded">{t('not recorded')}</span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
          </section>
        </div>

        {!readOnly && (
          <footer className="drawer-foot">
            <button type="button" className="btn primary" onClick={() => onEdit(bill)}>{t('Edit bill')}</button>
            {!isLastStage && <button type="button" className="btn" onClick={() => onNextStage(bill)}>{t('Move to next stage')}</button>}
            {bill.cat !== 'cleared' && (
              <button type="button" className="btn" onClick={() => onToggleHold(bill)}>{t(bill.cat === 'on_hold' ? 'Release hold' : 'Put on hold')}</button>
            )}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
