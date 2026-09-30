import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api';
import type { Bill, UserProfile } from '../../types';
import { fmtIN, fmtShort } from '../bills/utils';
import { useAppSettings } from '../../lib/appSettings';

interface PersonalDashboard {
  user: UserProfile;
  bills: Bill[];
  pendingTasks: number;
  onHoldBills: number;
  pendingAmount: number;
  districtRecords: { id: string; district: string; division: string; amount: number; releaseDate: string | null }[];
}

export default function DashboardTab({ user }: { user: UserProfile | null }) {
  const { t } = useAppSettings();
  const [dashboard, setDashboard] = useState<PersonalDashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setDashboard(null);
      return;
    }
    apiClient.users.dashboard(user.id)
      .then((data: PersonalDashboard) => { setDashboard(data); setError(''); })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('Could not load the dashboard.')));
  }, [user?.id]);

  if (!user) {
    return <div className="panel"><h2>{t('Personal dashboard')}</h2><p>{t('Name this device to see your assigned bills and dashboard scope.')}</p></div>;
  }
  if (error) return <div className="panel"><p className="form-error" role="alert">{error}</p></div>;
  if (!dashboard) return <div className="panel"><p>{t('Loading your dashboard…')}</p></div>;

  return (
    <div className="tab-panel">
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Personal dashboard')} · {user.name}</h2>
          <span className="note">{[...user.programs, ...user.districts].join(' · ') || t('No program or district scope set')}</span>
        </div>
        <div className="stats n4">
          {[
            { label: 'Pending tasks / bills', value: dashboard.pendingTasks, detail: `${dashboard.onHoldBills} ${t('on hold')}` },
            { label: 'Pending bill value', value: fmtShort(dashboard.pendingAmount), detail: t('across your assigned scope') },
            { label: 'Bills in your scope', value: dashboard.bills.length, detail: t('assigned or matching your program/district') },
            { label: 'District records', value: dashboard.districtRecords.length, detail: t('in your selected districts') },
          ].map(card => <div className="stat" key={card.label}><div className="lbl">{t(card.label)}</div><div className="val mono">{card.value}</div><div className="sub">{card.detail}</div></div>)}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><h2>{t('Bills in your scope')}</h2><span className="note">{dashboard.bills.length} {t('records')}</span></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{t('Vendor')}</th><th>{t('Invoice')}</th><th>{t('Program')}</th><th>{t('District')}</th><th>{t('Current status')}</th><th className="num">{t('Amount')}</th></tr></thead>
            <tbody>
              {dashboard.bills.map(bill => <tr key={bill.id}>
                <td className="vendor-cell">{bill.vendor}</td><td className="mono">{bill.invoice}</td>
                <td>{bill.program || '—'}</td><td>{bill.district || '—'}</td><td>{bill.status}</td><td className="num mono">{fmtIN(bill.amount)}</td>
              </tr>)}
              {!dashboard.bills.length && <tr><td className="empty-table" colSpan={6}>{t('No bills are assigned to you or match your selected scope.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {dashboard.districtRecords.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h2>{t('District records')}</h2></div>
          <div className="table-scroll"><table><thead><tr><th>{t('District')}</th><th>{t('Division')}</th><th>{t('Release date')}</th><th className="num">{t('Amount released')}</th></tr></thead>
            <tbody>{dashboard.districtRecords.map(record => <tr key={record.id}><td>{record.district}</td><td>{record.division}</td><td>{record.releaseDate || '—'}</td><td className="num mono">{fmtIN(record.amount)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
