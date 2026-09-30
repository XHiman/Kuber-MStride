import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { API_BASE_URL } from '../../lib/api';

type AdminEntity = 'bills' | 'budgets' | 'budgetHeads' | 'objectHeads' | 'transfers' | 'districts' | 'users' | 'devices';
type RecordRow = Record<string, unknown> & { id?: string };

const ENTITIES: { id: AdminEntity; label: string }[] = [
  { id: 'bills', label: 'Bills' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'budgetHeads', label: 'Budget heads' },
  { id: 'objectHeads', label: 'Object heads' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'districts', label: 'Districts' },
  { id: 'users', label: 'Users' },
  { id: 'devices', label: 'Devices & access' },
];

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/adminX/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Request': '1',
      ...options.headers,
    },
  });
  const body = await response.text();
  let result: unknown = null;
  if (body) {
    try {
      result = JSON.parse(body);
    } catch {
      result = body;
    }
  }
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'message' in result
      ? String((result as { message: unknown }).message)
      : String(result || `Request failed (${response.status}).`);
    throw new Error(message);
  }
  return result as T;
}

function blankRecord(entity: AdminEntity): RecordRow {
  switch (entity) {
    case 'bills':
      return { vendor: '', invoice: '', date: null, amount: 0, bucket: 'Invoice Raised', cat: 'in_progress', status: '', source: 'admin' };
    case 'budgets':
      return { code: '', fiscalYear: 'FY 2026-27', name: '', nameMr: '', prov215: 0, exp215: 0, prov224: 0, exp224: 0, prov233: 0, exp233: 0 };
    case 'budgetHeads':
      return { code: '', name: '', description: '' };
    case 'objectHeads':
      return { code: '', name: '', nameMr: '' };
    case 'transfers':
      return { recipient: '', scopeType: 'program', purpose: '', objectCode: '01', fiscalYear: 'FY 2026-27', budgetCode: 'A215', amount: 0, orderDate: null, status: 'minutes_awaited', utilized: 0, remarks: null };
    case 'districts':
      return { district: '', division: '', amount: 0, releaseDate: null, remarks: null, source: 'admin' };
    case 'users':
      return { name: '', programs: [], districts: [] };
    case 'devices':
      return { deviceId: '', ipAddress: null, userAgent: '', userId: null, accessEnabled: false };
  }
}

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('XHiman');
  const [password, setPassword] = useState('');
  const [entity, setEntity] = useState<AdminEntity>('bills');
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordQuery, setRecordQuery] = useState('');
  const [users, setUsers] = useState<RecordRow[]>([]);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [editor, setEditor] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedUserId = typeof selected?.userId === 'string' ? selected.userId : '';
  const visibleSummary = useMemo(() => (record: RecordRow) => {
    const primary = record.name || record.vendor || record.recipient || record.district || record.code || record.deviceId || record.id;
    return String(primary || 'New record');
  }, []);
  const filteredRecords = useMemo(() => {
    const query = recordQuery.trim().toLocaleLowerCase();
    if (!query) return records;
    return records.filter(record => JSON.stringify(record).toLocaleLowerCase().includes(query));
  }, [recordQuery, records]);

  async function loadRecords(forEntity: AdminEntity = entity) {
    setBusy(true);
    try {
      const result = await adminRequest<RecordRow[]>(`/${forEntity}`);
      setRecords(result);
      if (forEntity === 'users') setUsers(result);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load database records.');
    } finally {
      setBusy(false);
    }
  }

  async function checkSession() {
    try {
      await adminRequest('/session');
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
  }

  useEffect(() => { void checkSession(); }, []);
  useEffect(() => {
    if (authenticated) {
      setSelected(null);
      setEditor('');
      setIsNew(false);
      void loadRecords();
      if (entity !== 'users') {
        adminRequest<RecordRow[]>('/users').then(setUsers).catch(loadError => {
          setError(loadError instanceof Error ? loadError.message : 'Could not load user list.');
        });
      }
    }
  }, [authenticated, entity]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setPassword('');
      setAuthenticated(true);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Admin sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await adminRequest('/logout', { method: 'POST' });
      setAuthenticated(false);
      setRecords([]);
      setSelected(null);
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not sign out.');
    }
  }

  function selectRecord(record: RecordRow, newRecord = false) {
    setSelected(record);
    setEditor(JSON.stringify(record, null, 2));
    setIsNew(newRecord);
    setNotice('');
  }

  async function saveRecord() {
    let value: RecordRow;
    try {
      const parsed: unknown = JSON.parse(editor);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Enter a JSON object for one record.');
      }
      value = parsed as RecordRow;
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Invalid JSON.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const selectedId = selected ? String(entity === 'budgetHeads' || entity === 'objectHeads' ? selected.code ?? '' : selected.id ?? '') : '';
      const id = !isNew && selectedId ? `/${encodeURIComponent(selectedId)}` : '';
      await adminRequest(`/${entity}${id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(value),
      });
      setNotice(isNew ? 'Record created.' : 'Record updated.');
      setSelected(null);
      setEditor('');
      setIsNew(false);
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecord() {
    const selectedId = selected ? String(entity === 'budgetHeads' || entity === 'objectHeads' ? selected.code ?? '' : selected.id ?? '') : '';
    if (!selectedId || !window.confirm(`Permanently delete this ${entity.slice(0, -1)} record?`)) return;
    setBusy(true);
    setError('');
    try {
      await adminRequest(`/${entity}/${encodeURIComponent(selectedId)}`, { method: 'DELETE' });
      setSelected(null);
      setEditor('');
      setNotice('Record deleted.');
      await loadRecords();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete this record.');
    } finally {
      setBusy(false);
    }
  }

  async function updateDevice(data: { userId?: string | null; accessEnabled?: boolean }) {
    if (!selected?.id) return;
    setBusy(true);
    setError('');
    try {
      const updated = await adminRequest<RecordRow>(`/devices/${encodeURIComponent(selected.id)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      selectRecord(updated);
      setNotice('Device access updated.');
      await loadRecords('devices');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update device access.');
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="admin-shell admin-login">
        <form className="admin-card" onSubmit={login}>
          <p className="eyebrow">MahaSTRIDE · MITRA</p>
          <h1>Admin sign in</h1>
          <p className="admin-muted">Credentials are verified by the server and are never bundled into the website.</p>
          <label htmlFor="admin-username">User ID</label>
          <input id="admin-username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <a href="/">← Back to tracker</a>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-copy">
          <p className="eyebrow">MahaSTRIDE · MITRA</p>
          <h1>Database admin</h1>
          <p className="admin-muted">Signed in as XHiman · changes are saved when you confirm them.</p>
        </div>
        <button className="btn admin-signout" onClick={() => void logout()}>Sign out</button>
      </header>
      <nav className="admin-entities" aria-label="Database tables">
        {ENTITIES.map(item => (
          <button key={item.id} type="button" className={item.id === entity ? 'active' : ''} onClick={() => setEntity(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="admin-warning" role="note">
        Direct database edits take effect immediately. Deleting records can affect linked bills, transfers, and budget accounting.
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      <section className="admin-workspace">
        <div className="admin-records">
          <div className="admin-records-head">
            <div>
              <h2>{ENTITIES.find(item => item.id === entity)?.label}</h2>
              <p className="admin-muted">{records.length} {records.length === 1 ? 'record' : 'records'}</p>
            </div>
            <button className="btn primary" onClick={() => selectRecord(blankRecord(entity), true)}>+ New</button>
          </div>
          <label className="admin-record-search">
            <span className="sr-only">Filter records</span>
            <input
              type="search"
              value={recordQuery}
              onChange={event => setRecordQuery(event.target.value)}
              placeholder={`Filter ${ENTITIES.find(item => item.id === entity)?.label.toLocaleLowerCase()}…`}
            />
          </label>
          <div className="admin-record-list" aria-live="polite">
          {busy && <p className="admin-muted admin-list-message">Loading records…</p>}
          {filteredRecords.map((record, index) => {
            const recordId = String(entity === 'budgetHeads' || entity === 'objectHeads' ? record.code ?? index : record.id ?? index);
            const selectedId = selected
              ? String(entity === 'budgetHeads' || entity === 'objectHeads' ? selected.code ?? '' : selected.id ?? '')
              : '';
            return (
            <button
              type="button"
              key={recordId}
              className={`admin-record ${selectedId === recordId ? 'selected' : ''}`}
              onClick={() => selectRecord(record)}
            >
              <strong>{visibleSummary(record)}</strong>
              <small>{String(record.fiscalYear && record.code ? `${record.fiscalYear} · ${record.code}` : record.id || record.code || '')}</small>
              {entity === 'devices' && (
                <small>{record.accessEnabled ? 'Access enabled' : 'Access revoked'} · {String(record.ipAddress || 'IP unknown')} · {String(record.userAgent || '').slice(0, 58)}</small>
              )}
            </button>
            );
          })}
          {!busy && !filteredRecords.length && <p className="admin-muted admin-list-message">{records.length ? 'No records match this filter.' : 'No records in this table yet.'}</p>}
          </div>
        </div>
        <div className="admin-editor">
          {(selected || isNew) && <h2>{isNew ? 'Create record' : 'Edit record'}</h2>}
          {!selected && !isNew && (
            <div className="admin-empty-editor">
              <span className="admin-empty-icon" aria-hidden="true">✦</span>
              <h2>Manage {ENTITIES.find(item => item.id === entity)?.label.toLocaleLowerCase()}</h2>
              <p>Select a record to review or edit it. Use the filter to find one quickly, or create a new record.</p>
              <button className="btn primary" onClick={() => selectRecord(blankRecord(entity), true)}>Create new record</button>
            </div>
          )}
          {entity === 'devices' && selected && (
            <div className="device-access-controls">
              <label htmlFor="device-user">Assigned user</label>
              <select
                id="device-user"
                value={selectedUserId}
                onChange={event => void updateDevice({ userId: event.target.value || null })}
              >
                <option value="">No assigned user</option>
                {users.map(user => <option key={String(user.id)} value={String(user.id)}>{String(user.name)}</option>)}
              </select>
              <button
                className={`btn ${selected.accessEnabled ? '' : 'primary'}`}
                disabled={busy}
                onClick={() => void updateDevice({ accessEnabled: selected.accessEnabled !== true })}
              >
                {selected.accessEnabled ? 'Revoke device access' : 'Grant device access'}
              </button>
              <p className="admin-muted">Unassigning a user also revokes access. Device ID is the browser token; do not share it.</p>
            </div>
          )}
          {(selected || isNew) && (
            <>
              <p className="admin-muted">Edit this record as JSON. Protected fields such as database IDs are managed by the server.</p>
              <textarea className="admin-json-editor" spellCheck={false} value={editor} onChange={event => setEditor(event.target.value)} />
              <div className="admin-editor-actions">
                <button className="btn primary" disabled={busy} onClick={() => void saveRecord()}>{busy ? 'Saving…' : isNew ? 'Create record' : 'Save changes'}</button>
                {!isNew && selected && (selected.id || entity === 'budgetHeads' || entity === 'objectHeads') && <button className="btn danger" disabled={busy} onClick={() => void deleteRecord()}>Delete record</button>}
                <button className="btn" onClick={() => { setSelected(null); setIsNew(false); setEditor(''); }}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
