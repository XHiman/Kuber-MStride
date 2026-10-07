import { useEffect, useState, type FormEvent } from 'react';
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
  clearedBillCount: number;
  clearedAmount: number;
  districtRecords: { id: string; district: string; division: string; amount: number; releaseDate: string | null }[];
}

interface DashboardTabProps {
  user: UserProfile | null;
  sessionLoading: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onLogout: () => void;
}

export default function DashboardTab({ user, sessionLoading, onLogin, onLogout }: DashboardTabProps) {
  const { t } = useAppSettings();
  const [dashboard, setDashboard] = useState<PersonalDashboard | null>(null);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setDashboard(null);
      return;
    }
    apiClient.users.dashboard()
      .then((data: PersonalDashboard) => { setDashboard(data); setError(''); })
      .catch(loadError => setError(loadError instanceof Error ? loadError.message : t('Could not load the dashboard.')));
  }, [user?.id]);

  if (!user) {
    if (sessionLoading) return <div className="panel"><p>{t('Checking your sign-in…')}</p></div>;
    async function submitLogin(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setLoginBusy(true);
      setLoginError('');
      try {
        await onLogin(username, password);
        setPassword('');
      } catch (loginFailure) {
        setLoginError(loginFailure instanceof Error ? loginFailure.message : t('Could not sign in.'));
      } finally {
        setLoginBusy(false);
      }
    }
    return (
      <div className="panel dashboard-login">
        <h2>{t('Personal dashboard')}</h2>
        <p>{t('Sign in with the username and password provided by your administrator.')}</p>
        <form onSubmit={event => void submitLogin(event)}>
          <label htmlFor="dashboard-username">{t('Username')}</label>
          <input id="dashboard-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
          <label htmlFor="dashboard-password">{t('Password')}</label>
          <input id="dashboard-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          {loginError && <p className="form-error" role="alert">{loginError}</p>}
          <button className="btn primary" disabled={loginBusy}>{loginBusy ? t('Signing in…') : t('Sign in')}</button>
        </form>
      </div>
    );
  }
  if (error) return <div className="panel"><p className="form-error" role="alert">{error}</p></div>;
  if (!dashboard) return <div className="panel"><p>{t('Loading your dashboard…')}</p></div>;

  return (
    <div className="tab-panel">
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Personal dashboard')} · {user.name}</h2>
          <span className="note">{[...user.programs, ...user.districts].join(' · ') || t('No program or district scope set')}</span>
          <button className="btn" type="button" onClick={onLogout}>{t('Sign out')}</button>
        </div>
        <div className="stats n5">
          {[
            { label: 'Pending tasks / bills', value: dashboard.pendingTasks, detail: `${dashboard.onHoldBills} ${t('on hold')}` },
            { label: 'Pending bill value', value: fmtShort(dashboard.pendingAmount), detail: t('across your assigned scope') },
            { label: 'Bills cleared', value: dashboard.clearedBillCount, detail: `${fmtShort(dashboard.clearedAmount)} ${t('cleared value')}` },
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
