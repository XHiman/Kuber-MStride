import { useMemo, useState } from 'react';
import { AsOf, Money } from '../../components/Money';
import { ReasonBadges, RecordedText } from '../../components/StatusGlossary';
import { isOverdue, DEFAULT_OVERDUE_DAYS } from '../../lib/aging';
import { useAppSettings } from '../../lib/appSettings';
import { formatDate } from '../../lib/format';
import { roleOf, scopeBills, scopeLabel, summariseWork } from '../../lib/scope';
import { plural } from '../../lib/status';
import type { Bill, UserProfile } from '../../types';
import { DaysOpen, OverdueFlag, StageChip, VendorName, billAmount } from '../bills/shared';

export type DistrictRecord = { id: string; district: string; division: string; amount: number; releaseDate: string | null };

type Props = {
  user: UserProfile;
  bills: Bill[];
  districtRecords: DistrictRecord[];
  loadedAt: Date | null;
  onLogout: () => void;
};

const PREVIEW_ROWS = 10;

/** "Your assigned work & scope": who you are, what you cover, and your open items, oldest first. */
export default function WorkScope({ user, bills, districtRecords, loadedAt, onLogout }: Props) {
  const { t } = useAppSettings();
  const [showAll, setShowAll] = useState(false);
  const inScope = useMemo(() => scopeBills(bills, user), [bills, user]);
  const work = useMemo(() => summariseWork(inScope, user.id, billAmount), [inScope, user.id]);
  const openRows = useMemo(
    () => inScope.filter(b => b.cat !== 'cleared').sort((a, c) => (c._days ?? -1) - (a._days ?? -1)),
    [inScope],
  );
  const role = roleOf(user);
  const visible = showAll ? openRows : openRows.slice(0, PREVIEW_ROWS);

  return (
    <div className="tab-panel">
      <section className="panel work-scope" aria-labelledby="work-scope-title">
        <div className="panel-head">
          <h2 id="work-scope-title">{t('Your assigned work & scope')}</h2>
          <button className="btn" type="button" onClick={onLogout}>{t('Sign out')}</button>
        </div>

        <dl className="work-identity">
          <div><dt>{t('Name')}</dt><dd>{user.name}</dd></div>
          <div><dt>{t('Role')}</dt><dd>{t(role === 'dsu' ? 'DSU user' : 'Finance user')}</dd></div>
          <div><dt>{t('Scope')}</dt><dd>{t(scopeLabel(user))}</dd></div>
        </dl>

        <div className="stats n4">
          <div className="stat">
            <div className="lbl">{t('Open items')}</div>
            <div className="val mono">{work.open}</div>
            <div className="sub"><Money value={work.openAmount} /> · {work.onHold} {t('on hold')}</div>
          </div>
          <div className="stat">
            <div className="lbl">{t('Oldest open item')}</div>
            <div className="val mono">{work.oldest ? <DaysOpen days={work.oldest._days} /> : '—'}</div>
            <div className="sub">{work.oldest ? <><VendorName vendor={work.oldest.vendor} /> · <Money value={billAmount(work.oldest)} /></> : t('Nothing open')}</div>
          </div>
          <div className="stat">
            <div className="lbl">{t('Assigned to you')}</div>
            <div className="val mono">{work.assignedOpen}</div>
            <div className="sub">{t('open bills with you as owner')}</div>
          </div>
          <div className="stat">
            <div className="lbl">{t('Bills in your scope')}</div>
            <div className="val mono">{work.inScope}</div>
            <div className="sub">{work.inScope - work.open} {t('cleared')}</div>
          </div>
        </div>
        <p className="as-of-row"><AsOf at={loadedAt} /></p>
      </section>

      <section className="panel" aria-labelledby="open-items-title">
        <div className="panel-head">
          <h2 id="open-items-title">{t('Open items, oldest first')}</h2>
          <span className="note">{openRows.length} {t(plural(openRows.length, 'bill'))}</span>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{t('Open bills in your scope, oldest first')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Vendor')}</th><th scope="col">{t('Invoice')}</th><th scope="col" className="num">{t('Days open')}</th>
                <th scope="col">{t('Stage')}</th><th scope="col">{t('Current status')}</th><th scope="col" className="num">{t('Amount')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(bill => (
                <tr key={bill.id}>
                  <td className="vendor-cell"><VendorName vendor={bill.vendor} /></td>
                  <td className="mono"><RecordedText value={bill.invoice} /></td>
                  <td className="num mono">
                    <DaysOpen days={bill._days} />
                    {isOverdue(bill, DEFAULT_OVERDUE_DAYS) && <><br /><OverdueFlag threshold={DEFAULT_OVERDUE_DAYS} /></>}
                  </td>
                  <td><StageChip bill={bill} /></td>
                  <td><RecordedText value={bill.status} /> <ReasonBadges bill={bill} /></td>
                  <td className="num mono"><Money value={billAmount(bill)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {openRows.length === 0 && (
            <div className="empty-state" role="status">
              <span className="empty-mark" aria-hidden="true">—</span>
              <span><strong>{t('Nothing open in your scope')}</strong><small>{t(role === 'dsu' && !user.districts.length ? 'Ask an administrator to set your DSU district.' : 'All bills in your scope are cleared.')}</small></span>
            </div>
          )}
        </div>
        {openRows.length > PREVIEW_ROWS && (
          <button type="button" className="link-btn show-all" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>
            {showAll ? t('Show fewer') : `${t('Show all')} ${openRows.length}`}
          </button>
        )}
      </section>

      {districtRecords.length > 0 && (
        <section className="panel" aria-labelledby="district-records-title">
          <div className="panel-head"><h2 id="district-records-title">{t('District records')}</h2></div>
          <div className="table-scroll"><table>
            <thead><tr><th scope="col">{t('District')}</th><th scope="col">{t('Division')}</th><th scope="col">{t('Release date')}</th><th scope="col" className="num">{t('Amount released')}</th></tr></thead>
            <tbody>{districtRecords.map(record => <tr key={record.id}><td>{record.district}</td><td>{record.division}</td><td>{formatDate(record.releaseDate)}</td><td className="num mono"><Money value={record.amount} /></td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
