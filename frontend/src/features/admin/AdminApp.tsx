import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { API_BASE_URL } from '../../lib/api';
import readXlsxFile from 'read-excel-file/browser';

type AdminEntity = 'bills' | 'budgets' | 'budgetHeads' | 'objectHeads' | 'transfers' | 'districts' | 'users';
type ImportEntity = AdminEntity;
type RecordRow = Record<string, unknown> & { id?: string };
type ImportFailure = { row: number; error: string };

const ADMIN_SESSION_KEY = 'mitra-admin-session';
const IMPORT_ENTITIES: { id: ImportEntity; label: string }[] = [
  { id: 'bills', label: 'Bills' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'budgetHeads', label: 'Budget heads' },
  { id: 'objectHeads', label: 'Object heads' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'districts', label: 'Districts' },
  { id: 'users', label: 'Users' },
];
const IMPORT_FIELDS: Record<ImportEntity, string[]> = {
  bills: ['sr', 'vendor', 'invoice', 'date', 'amount', 'budgetCode', 'objectHead', 'transferId', 'program', 'district', 'assignedUserId', 'bucket', 'cat', 'status', 'attribute', 'note', 'days', 'clearedFY', 'source'],
  budgets: ['id', 'code', 'fiscalYear', 'name', 'nameMr', 'prov215', 'exp215', 'prov224', 'exp224', 'prov233', 'exp233'],
  budgetHeads: ['code', 'name', 'description'],
  objectHeads: ['code', 'name', 'nameMr'],
  transfers: ['recipient', 'scopeType', 'purpose', 'objectCode', 'amount', 'fiscalYear', 'budgetCode', 'orderDate', 'status', 'utilized', 'remarks'],
  districts: ['district', 'division', 'amount', 'releaseDate', 'remarks', 'source'],
  users: ['username', 'password', 'name', 'programs', 'districts'],
};
const NUMERIC_FIELDS: Partial<Record<ImportEntity, string[]>> = {
  bills: ['sr', 'amount', 'days'],
  budgets: ['prov215', 'exp215', 'prov224', 'exp224', 'prov233', 'exp233'],
  transfers: ['amount', 'utilized'],
  districts: ['amount'],
};

const ENTITIES: { id: AdminEntity; label: string }[] = [
  { id: 'bills', label: 'Bills' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'budgetHeads', label: 'Budget heads' },
  { id: 'objectHeads', label: 'Object heads' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'districts', label: 'Districts' },
  { id: 'users', label: 'Users' },
];

function parseCsv(text: string): unknown[][] {
  const rows: unknown[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const csv = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.');
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

async function parseSpreadsheet(file: File, entity: ImportEntity): Promise<RecordRow[]> {
  let matrix: unknown[][];
  if (file.name.toLowerCase().endsWith('.csv')) {
    matrix = parseCsv(await file.text());
  } else {
    matrix = (await readXlsxFile(file))[0]?.data ?? [];
  }
  if (!matrix.length) throw new Error('The spreadsheet is empty.');

  const allowedFields = new Set(IMPORT_FIELDS[entity]);
  const headers = matrix[0].map(value => String(value ?? '').trim());
  const columns = headers
    .map((field, index) => ({ field, index }))
    .filter(column => column.field !== '');
  if (!columns.length) throw new Error('The first row must contain column names.');
  const seen = new Set<string>();
  for (const { field } of columns) {
    if (!allowedFields.has(field)) {
      throw new Error(`Unknown "${field}" column. Use the template field names for ${entity}.`);
    }
    if (seen.has(field)) throw new Error(`The "${field}" column appears more than once.`);
    seen.add(field);
  }

  const numericFields = new Set(NUMERIC_FIELDS[entity] ?? []);
  const rows: RecordRow[] = [];
  matrix.slice(1).forEach((cells, index) => {
    if (!cells.some(value => value !== '' && value !== null && value !== undefined)) return;
    const record: RecordRow = { _sourceRow: index + 2 };
    for (const { field, index: columnIndex } of columns) {
      const value = cells[columnIndex];
      if (value === '' || value === null || value === undefined) continue;
      if (value instanceof Date) {
        record[field] = value.toISOString();
      } else if (numericFields.has(field) && typeof value === 'string') {
        const normalized = value.replace(/,/g, '').trim();
        const numericValue = Number(normalized);
        record[field] = normalized && Number.isFinite(numericValue) ? numericValue : value.trim();
      } else if (entity === 'users' && (field === 'programs' || field === 'districts') && typeof value === 'string') {
        record[field] = value.split('|').map(item => item.trim()).filter(Boolean);
      } else {
        record[field] = typeof value === 'string' ? value.trim() : value;
      }
    }
    rows.push(record);
  });
  if (!rows.length) throw new Error('The spreadsheet has column names but no data rows.');
  if (rows.length > 5000) throw new Error('A spreadsheet import is limited to 5,000 rows.');
  return rows;
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sessionToken = sessionStorage.getItem(ADMIN_SESSION_KEY);
  const response = await fetch(`${API_BASE_URL}/adminX/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
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
    if (response.status === 401) sessionStorage.removeItem(ADMIN_SESSION_KEY);
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
      return { username: '', password: '', name: '', programs: [], districts: [] };
  }
}

export default function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('XHiman');
  const [password, setPassword] = useState('');
  const [entity, setEntity] = useState<AdminEntity>('bills');
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [recordQuery, setRecordQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [editor, setEditor] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [importEntity, setImportEntity] = useState<ImportEntity>('bills');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFailures, setImportFailures] = useState<ImportFailure[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const visibleSummary = useMemo(() => (record: RecordRow) => {
    const primary = record.name || record.vendor || record.recipient || record.district || record.code || record.id;
    return String(primary || 'New record');
  }, []);
  const filteredRecords = useMemo(() => {
    const query = recordQuery.trim().toLocaleLowerCase();
    if (!query) return records;
    return records.filter(record => JSON.stringify(record).toLocaleLowerCase().includes(query));
  }, [recordQuery, records]);
  const getRecordId = (record: RecordRow) => String(
    entity === 'budgetHeads' || entity === 'objectHeads' ? record.code ?? '' : record.id ?? '',
  );
  const selectedCount = records.filter(record => selectedIds.has(getRecordId(record))).length;
  const visibleRecordIds = filteredRecords.map(getRecordId).filter(Boolean);
  const allVisibleSelected = visibleRecordIds.length > 0 && visibleRecordIds.every(id => selectedIds.has(id));

  async function loadRecords(forEntity: AdminEntity = entity) {
    setBusy(true);
    try {
      const result = await adminRequest<RecordRow[]>(`/${forEntity}`);
      setRecords(result);
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
      setSelectedIds(new Set());
      setEditor('');
      setIsNew(false);
      void loadRecords();
    }
  }, [authenticated, entity]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { sessionToken } = await adminRequest<{ sessionToken: string }>('/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (!sessionToken) throw new Error('The server did not return an admin session.');
      sessionStorage.setItem(ADMIN_SESSION_KEY, sessionToken);
      await adminRequest('/session');
      setPassword('');
      setAuthenticated(true);
    } catch (loginError) {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      setError(loginError instanceof Error ? loginError.message : 'Admin sign-in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await adminRequest('/logout', { method: 'POST' });
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
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

  function toggleRecordSelection(record: RecordRow) {
    const id = getRecordId(record);
    if (!id) return;
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds(current => {
      const next = new Set(current);
      for (const id of visibleRecordIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
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
      setSelectedIds(current => {
        const next = new Set(current);
        next.delete(selectedId);
        return next;
      });
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

  async function deleteSelectedRecords() {
    const targets = records.filter(record => selectedIds.has(getRecordId(record)));
    if (!targets.length || !window.confirm(`Permanently delete all ${targets.length} selected ${entity} record(s)?`)) return;

    setBusy(true);
    setError('');
    setNotice('');
    const failedIds = new Set<string>();
    const failures: string[] = [];
    try {
      for (const record of targets) {
        const id = getRecordId(record);
        try {
          await adminRequest(`/${entity}/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (deleteError) {
          failedIds.add(id);
          const reason = deleteError instanceof Error ? deleteError.message : 'Unknown error';
          failures.push(`${visibleSummary(record)}: ${reason}`);
        }
      }

      setSelectedIds(failedIds);
      if (selected && targets.some(record => getRecordId(record) === getRecordId(selected) && !failedIds.has(getRecordId(record)))) {
        setSelected(null);
        setEditor('');
        setIsNew(false);
      }
      await loadRecords();
      const deletedCount = targets.length - failures.length;
      if (failures.length) {
        const details = failures.slice(0, 5).join(' ');
        const remaining = failures.length > 5 ? ` And ${failures.length - 5} more.` : '';
        setError(`${deletedCount} record(s) deleted; ${failures.length} could not be deleted. ${details}${remaining}`);
      } else {
        setNotice(`${deletedCount} selected record(s) deleted.`);
      }
    } finally {
      setBusy(false);
    }
  }

  function downloadImportTemplate() {
    const csv = `${IMPORT_FIELDS[importEntity].map(field => `"${field}"`).join(',')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${importEntity}-import-template.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importSpreadsheet() {
    if (!importFile) return;
    setBusy(true);
    setError('');
    setNotice('');
    setImportFailures([]);
    try {
      const rows = await parseSpreadsheet(importFile, importEntity);
      if (!window.confirm(`Import ${rows.length} rows into ${IMPORT_ENTITIES.find(item => item.id === importEntity)?.label}? This adds records; it does not update existing ones.`)) {
        return;
      }
      const result = await adminRequest<{ imported: number; failed: ImportFailure[] }>(
        `/import/${importEntity}`,
        { method: 'POST', body: JSON.stringify({ rows }) },
      );
      setNotice(
        result.failed.length
          ? `Imported ${result.imported} of ${rows.length} rows; ${result.failed.length} need correction.`
          : `Imported all ${result.imported} rows successfully.`,
      );
      setImportFailures(result.failed);
      setImportFile(null);
      if (entity === importEntity) await loadRecords();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not import this spreadsheet.');
    } finally {
      setBusy(false);
    }
  }

  function downloadImportErrors() {
    const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [
      '"Row","Error"',
      ...importFailures.map(item => `${item.row},${quote(item.error)}`),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spreadsheet-import-errors.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadDatabaseBackup() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const sessionToken = sessionStorage.getItem(ADMIN_SESSION_KEY);
      const response = await fetch(`${API_BASE_URL}/adminX/api/database/backup`, {
        credentials: 'include',
        headers: {
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
          setAuthenticated(false);
        }
        const responseText = await response.text();
        let message = responseText || `Backup download failed (${response.status}).`;
        try {
          const responseBody = JSON.parse(responseText) as { message?: unknown };
          if (responseBody.message) message = String(responseBody.message);
        } catch {
          // Keep the server's plain-text error.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mahastride-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice('Database backup downloaded.');
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : 'Could not download the database backup.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreDatabaseBackup() {
    if (!restoreFile) return;
    if (!window.confirm('Restore this backup? This replaces all current database records, including bills, transfers, users, and history. This cannot be undone.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const backup: unknown = JSON.parse(await restoreFile.text());
      const result = await adminRequest<{ restored: Record<string, number> }>('/database/restore', {
        method: 'POST',
        body: JSON.stringify(backup),
      });
      const count = Object.values(result.restored).reduce((total, value) => total + value, 0);
      setRestoreFile(null);
      setNotice(`Database restored successfully (${count} records across ${Object.keys(result.restored).length} tables).`);
      setSelected(null);
      setEditor('');
      setIsNew(false);
      await loadRecords();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Could not restore this database backup.');
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
      <section className="admin-data-tools" aria-label="Import and database backup">
        <article className="admin-tool-card">
          <div>
            <h2>Import spreadsheet</h2>
            <p className="admin-muted">Add rows from .xlsx or CSV. Use the template column names; imports do not overwrite existing records. Bill reference codes and IDs must already exist; import their budget heads, object heads, transfers, or users first. User programs and districts can be separated with |.</p>
          </div>
          <label>
            <span>Table</span>
            <select value={importEntity} onChange={event => {
              setImportEntity(event.target.value as ImportEntity);
              setImportFailures([]);
            }}>
              {IMPORT_ENTITIES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <button className="btn" type="button" onClick={downloadImportTemplate}>Download CSV template</button>
          <label>
            <span>Excel or CSV file</span>
            <input
              type="file"
              accept=".xlsx,.csv"
              onChange={event => {
                setImportFile(event.target.files?.[0] ?? null);
                setImportFailures([]);
              }}
            />
          </label>
          <button className="btn primary" type="button" disabled={busy || !importFile} onClick={() => void importSpreadsheet()}>
            {busy && importFile ? 'Importing…' : 'Import rows'}
          </button>
        </article>
        <article className="admin-tool-card">
          <div>
            <h2>Database backup</h2>
            <p className="admin-muted">Download a complete JSON backup, or restore one later. Restore replaces every table; download a fresh backup before restoring.</p>
          </div>
          <button className="btn primary" type="button" disabled={busy} onClick={() => void downloadDatabaseBackup()}>
            {busy && !importFile && !restoreFile ? 'Preparing backup…' : 'Download whole database'}
          </button>
          <label>
            <span>Restore from backup file</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={event => setRestoreFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <button className="btn danger" type="button" disabled={busy || !restoreFile} onClick={() => void restoreDatabaseBackup()}>
            {busy && restoreFile ? 'Restoring…' : 'Replace database from backup'}
          </button>
        </article>
      </section>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {importFailures.length > 0 && (
        <details className="admin-import-errors">
          <summary>{importFailures.length} spreadsheet row(s) need correction</summary>
          <button className="btn" type="button" onClick={downloadImportErrors}>Download error report (CSV)</button>
          <div className="admin-import-error-list">
            {importFailures.slice(0, 10).map((item, index) => (
              <p key={`${item.row}-${index}`}><strong>Row {item.row}:</strong> {item.error}</p>
            ))}
            {importFailures.length > 10 && <p className="admin-muted">Showing the first 10 errors. Download the CSV for the full report.</p>}
          </div>
        </details>
      )}
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
          <div className="admin-selection-toolbar">
            <button type="button" className="btn" disabled={busy || !visibleRecordIds.length} onClick={toggleVisibleSelection}>
              {allVisibleSelected ? 'Clear visible selection' : 'Select all visible'}
            </button>
            <span className="admin-muted">{selectedCount} selected</span>
            <button type="button" className="btn danger" disabled={busy || !selectedCount} onClick={() => void deleteSelectedRecords()}>
              Delete selected
            </button>
          </div>
          <div className="admin-record-list" aria-live="polite">
          {busy && <p className="admin-muted admin-list-message">Loading records…</p>}
          {filteredRecords.map((record, index) => {
            const recordId = getRecordId(record) || String(index);
            const selectedId = selected
              ? getRecordId(selected)
              : '';
            return (
            <div
              key={`${recordId}-${index}`}
              className="admin-record-entry"
            >
              <input
                type="checkbox"
                checked={Boolean(getRecordId(record) && selectedIds.has(getRecordId(record)))}
                disabled={!getRecordId(record) || busy}
                aria-label={`Select ${visibleSummary(record)}`}
                onChange={() => toggleRecordSelection(record)}
              />
              <button
                type="button"
                className={`admin-record ${selectedId === getRecordId(record) ? 'selected' : ''}`}
                onClick={() => selectRecord(record)}
              >
                <strong>{visibleSummary(record)}</strong>
                <small>{String(record.fiscalYear && record.code ? `${record.fiscalYear} · ${record.code}` : record.id || record.code || '')}</small>
              </button>
            </div>
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
          {(selected || isNew) && (
            <>
              <p className="admin-muted">Edit this record as JSON. Protected fields such as database IDs are managed by the server.</p>
              {entity === 'users' && (
                <p className="admin-muted">
                  User accounts require a unique username and an initial password of at least 10 characters. To reset a password, add a "password" field; leave it out to keep the existing password. Password hashes are never shown here.
                </p>
              )}
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
