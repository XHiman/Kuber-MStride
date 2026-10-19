import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '../../lib/api';
import type { Bill, UserProfile } from '../../types';
import { useAppSettings } from '../../lib/appSettings';
import WorkScope, { type DistrictRecord } from './WorkScope';

interface PersonalDashboard {
  user: UserProfile;
  bills: Bill[];
  pendingTasks: number;
  onHoldBills: number;
  pendingAmount: number;
  clearedBillCount: number;
  clearedAmount: number;
  districtRecords: DistrictRecord[];
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
  const [allBills, setAllBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    if (!user) {
      setDashboard(null);
      return;
    }
    // The scope (finance → all bills, DSU → own DSU) is applied client-side to the full bill list.
    Promise.all([apiClient.users.dashboard(), apiClient.bills.list()])
      .then(([data, bills]: [PersonalDashboard, Bill[]]) => { setDashboard(data); setAllBills(bills); setError(''); setLoadedAt(new Date()); })
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
  if (!dashboard || !allBills) return <div className="panel"><p>{t('Loading your dashboard…')}</p></div>;

  return (
    <WorkScope
      user={{ ...user, ...dashboard.user }}
      bills={allBills}
      districtRecords={dashboard.districtRecords}
      loadedAt={loadedAt}
      onLogout={onLogout}
    />
  );
}
