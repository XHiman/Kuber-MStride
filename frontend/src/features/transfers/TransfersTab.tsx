import { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../../lib/api';
import { FISCAL_YEARS, type Transfer, type District, type UserProfile } from '../../types';
import { fmtIN, fmtShort } from '../bills/utils';
import { useAppSettings } from '../../lib/appSettings';
import ExportActions from '../../components/ExportActions';
import ProgramDistrictField, { type ProgramDistrictType } from '../../components/ProgramDistrictField';

export default function TransfersTab({ globalQuery = '', readOnly = false }: { globalQuery?: string; readOnly?: boolean }) {
  const { t } = useAppSettings();
  const translateLabel = t;
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferStats, setTransferStats] = useState<any>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtStats, setDistrictStats] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [showDistrictForm, setShowDistrictForm] = useState(false);
  const [districtForm, setDistrictForm] = useState({ district: '', division: '', amount: 0, releaseDate: '', remarks: '' });
  const [collapsedRecipients, setCollapsedRecipients] = useState<Set<string>>(new Set());
  const [recipientAnimations, setRecipientAnimations] = useState<Map<string, 'opening' | 'closing'>>(new Map());
  const recipientAnimationTimers = useRef<Map<string, number>>(new Map());

  const visibleTransfers = useMemo(() => {
    const terms = globalQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return transfers.filter(transfer => {
      const value = `${transfer.recipient} ${transfer.purpose} ${transfer.objectCode} ${transfer.fiscalYear} ${transfer.budgetCode || ''} ${transfer.status} ${transfer.remarks || ''} ${transfer.amount} ${transfer.orderDate || ''}`.toLowerCase();
      return terms.every(term => value.includes(term));
    });
  }, [transfers, globalQuery]);

  const visibleDistricts = useMemo(() => {
    const terms = globalQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return districts.filter(district => {
      const value = `${district.district} ${district.division} ${district.remarks || ''} ${district.amount} ${district.releaseDate || ''}`.toLowerCase();
      return terms.every(term => value.includes(term));
    });
  }, [districts, globalQuery]);

  const programOptions = useMemo(() => [...new Set([
    ...users.flatMap(user => user.programs),
    ...transfers.filter(transfer => transfer.scopeType === 'program').map(transfer => transfer.recipient),
  ])].sort((left, right) => left.localeCompare(right)), [transfers, users]);
  const districtOptions = useMemo(() => [...new Set([
    ...districts.map(district => district.district),
    ...users.flatMap(user => user.districts),
    ...transfers.filter(transfer => transfer.scopeType === 'district').map(transfer => transfer.recipient),
  ])].sort((left, right) => left.localeCompare(right)), [districts, transfers, users]);

  const transfersByRecipient = useMemo(() => {
    const groups = new Map<string, Transfer[]>();
    for (const transfer of visibleTransfers) {
      const recipientTransfers = groups.get(transfer.recipient) || [];
      recipientTransfers.push(transfer);
      groups.set(transfer.recipient, recipientTransfers);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [visibleTransfers]);

  const [transferForm, setTransferForm] = useState({
    recipient: '',
    scopeType: 'program' as ProgramDistrictType,
    purpose: '',
    objectCode: '01',
    fiscalYear: 'FY 2026-27',
    budgetCode: 'A215',
    amount: 0,
    orderDate: localToday(),
    status: 'transferred',
    utilized: 0,
    remarks: '',
  });

  useEffect(() => { load(); }, []);

  useEffect(() => () => {
    recipientAnimationTimers.current.forEach(timer => window.clearTimeout(timer));
  }, []);

  async function load() {
    const [stats, records, dStats, dRecords, people] = await Promise.all([
      apiClient.transfers.stats(),
      apiClient.transfers.records(),
      apiClient.districts.stats(),
      apiClient.districts.records(),
      apiClient.users.list(),
    ]);
    setTransferStats(stats);
    setTransfers(records);
    setDistrictStats(dStats);
    setDistricts(dRecords);
    setUsers(people);
  }

  function toggleRecipient(recipient: string) {
    const isExpanded = !collapsedRecipients.has(recipient) && recipientAnimations.get(recipient) !== 'closing';
    const shouldExpand = !isExpanded;
    const existingTimer = recipientAnimationTimers.current.get(recipient);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);

    if (shouldExpand) {
      setCollapsedRecipients(previous => {
        const next = new Set(previous);
        next.delete(recipient);
        return next;
      });
    }
    setRecipientAnimations(previous => new Map(previous).set(recipient, shouldExpand ? 'opening' : 'closing'));

    const timer = window.setTimeout(() => {
      if (!shouldExpand) {
        setCollapsedRecipients(previous => new Set(previous).add(recipient));
      }
      setRecipientAnimations(previous => {
        const next = new Map(previous);
        next.delete(recipient);
        return next;
      });
      recipientAnimationTimers.current.delete(recipient);
    }, 180);
    recipientAnimationTimers.current.set(recipient, timer);
  }

  async function handleUtilizationEdit(id: string, value: number) {
    await apiClient.transfers.update(id, { utilized: value });
    load();
  }

  async function handleDistrictEdit(
    id: string,
    field: 'amount' | 'releaseDate' | 'remarks',
    value: number | string | null,
  ) {
    await apiClient.districts.update(id, { [field]: value });
    await load();
  }

  function openAddTransfer() {
    setEditingTransfer(null);
    setTransferForm({
      recipient: '',
      scopeType: 'program',
      purpose: '',
      objectCode: '01',
      fiscalYear: 'FY 2026-27',
      budgetCode: 'A215',
      amount: 0,
      orderDate: localToday(),
      status: 'transferred',
      utilized: 0,
      remarks: '',
    });
    setShowModal(true);
  }

  function openEditTransfer(t: Transfer) {
    setEditingTransfer(t);
    setTransferForm({
      recipient: t.recipient || '',
      scopeType: t.scopeType || 'program',
      purpose: t.purpose || '',
      objectCode: t.objectCode || '01',
      fiscalYear: t.fiscalYear || 'FY 2026-27',
      budgetCode: t.budgetCode || 'A215',
      amount: t.amount || 0,
      orderDate: t.orderDate || localToday(),
      status: t.status || 'transferred',
      utilized: t.utilized || 0,
      remarks: t.remarks || '',
    });
    setShowModal(true);
  }

  function selectRecipient(recipient: string, scopeType: ProgramDistrictType) {
    const preferences = transfers.filter(transfer => transfer.recipient === recipient && transfer.scopeType === scopeType);
    const counts = new Map<string, { count: number; purpose: string; objectCode: string }>();
    for (const transfer of preferences) {
      const key = `${transfer.purpose}\u0000${transfer.objectCode}`;
      const existing = counts.get(key);
      counts.set(key, {
        count: (existing?.count || 0) + 1,
        purpose: transfer.purpose,
        objectCode: transfer.objectCode,
      });
    }
    const frequent = [...counts.values()].sort((left, right) => right.count - left.count)[0];
    setTransferForm(previous => ({
      ...previous,
      recipient,
      scopeType,
      purpose: frequent?.purpose || '',
      objectCode: frequent?.objectCode || '01',
    }));
  }

async function handleTransferSave() {
  if (!transferForm.recipient.trim() || !transferForm.purpose.trim()) {
    window.alert(t('Enter both recipient and purpose.'));
    return;
  }
  if (transferForm.status === 'transferred' && !transferForm.orderDate) {
    window.alert(t('Enter the transfer date for a transferred amount.'));
    return;
  }

  if (editingTransfer) {
    await apiClient.transfers.update(editingTransfer.id, transferForm);
  } else {
    await apiClient.transfers.create(transferForm);
  }

  setShowModal(false);
  setEditingTransfer(null);
  await load();
}

  async function handleDistrictSave() {
    if (!districtForm.district.trim() || !districtForm.division.trim()) {
      window.alert(t('Enter both a district and division.'));
      return;
    }
    await apiClient.districts.create({
      ...districtForm,
      releaseDate: districtForm.releaseDate || null,
      remarks: districtForm.remarks || null,
    });
    setDistrictForm({ district: '', division: '', amount: 0, releaseDate: '', remarks: '' });
    setShowDistrictForm(false);
    await load();
  }

  function getExportRows() {
    return visibleTransfers.flatMap(t => {
      const utilizationUpdates = t.history.filter(entry => entry.field === 'utilized');
      const lastUtilizationUpdate = utilizationUpdates[utilizationUpdates.length - 1]?.changedAt || '';
      const base = {
      Recipient: t.recipient,
      'Recipient type': t.scopeType || '',
      Purpose: t.purpose,
      'Object Code': t.objectCode,
      'Fiscal year': t.fiscalYear,
      'Budget funding head': t.budgetCode || '',
      Amount: t.amount,
      'Order Date': t.orderDate || '',
      Status: t.status,
      Utilized: t.utilized,
      Balance: t.amount - t.utilized,
      Remarks: t.remarks || '',
      'Created At': t.createdAt,
      'Last Updated At': t.updatedAt,
      'Utilization Updated At': lastUtilizationUpdate,
      };
      if (!t.history.length) {
        return [{ ...base, 'Change Date': '', 'Changed Field': '', 'Previous Value': '', 'New Value': '' }];
      }
      return t.history.map(entry => ({
        ...base,
        'Change Date': entry.changedAt,
        'Changed Field': entry.field,
        'Previous Value': entry.oldValue || '',
        'New Value': entry.newValue || '',
      }));
    });
  }

  return (
    <div className="tab-panel" id="tab-transfers">
      {/* Transfer stats */}
      {transferStats && (
        <div className="stats n4">
          {[
            { lbl: 'Total transferred', val: fmtShort(transferStats.totalAmt), sub: `${transferStats.count} ${t('releases')}` },
            { lbl: 'Utilized to date', val: fmtShort(transferStats.totalUtil), sub: `${transferStats.utilizationPct}% ${t('of transferred')}` },
            { lbl: 'Unutilized balance', val: fmtShort(transferStats.unutilized), sub: 'awaiting UC' },
            { lbl: 'Awaiting minutes', val: transferStats.pending, sub: transferStats.pending ? 'not yet released' : 'all released' },
          ].map((s, i) => (
            <div key={i} className="stat">
              <div className="lbl">{t(s.lbl)}</div>
              <div className="val mono">{s.val}</div>
              <div className="sub">{t(s.sub)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transfers table */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Fund transfers — agencies / DDOs')}</h2>
          <div className="panel-actions">
            <span className="note">{visibleTransfers.length} {t(visibleTransfers.length === 1 ? 'record' : 'records')}</span>
            <ExportActions getRows={getExportRows} filename="transfers" />
            {!readOnly && <button className="btn primary" onClick={openAddTransfer}>
  + {t('Add transfer')}
</button>}
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t('Recipient')}</th><th>{t('Purpose / object code')}</th><th className="num">{t('Amount transferred')}</th>
                <th>{t('Order date')}</th><th>{t('Release status')}</th><th className="num">{t('Utilized to date')}</th><th className="num">{t('Balance')}</th><th>{t('Remarks')}</th>{!readOnly && <th></th>}
              </tr>
            </thead>
            {visibleTransfers.length === 0 ? (
              <tbody>
                <tr>
                  <td className="empty-table" colSpan={readOnly ? 8 : 9}>
                    <div className="empty-state">
                      <span className="empty-mark" aria-hidden="true">—</span>
                      <span>
                        <strong>{t('No transfers recorded')}</strong>
                        <small>{t('Record a release to start tracking recipients, utilization, and remaining balances.')}</small>
                      </span>
                      {!readOnly && <button className="btn primary" onClick={openAddTransfer}>+ {t('Add transfer')}</button>}
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : transfersByRecipient.map(([recipient, recipientTransfers]) => {
              const collapsed = collapsedRecipients.has(recipient);
              const animation = recipientAnimations.get(recipient);
              const expanded = !collapsed && animation !== 'closing';
              return (
                <tbody key={recipient}>
                <tr className="tot-row">
                  <td colSpan={readOnly ? 8 : 9}>
                    <button
                      className="recipient-group-toggle"
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${t(expanded ? 'Collapse' : 'Expand')} ${t('transfers for')} ${recipient}`}
                      onClick={() => toggleRecipient(recipient)}
                    >
                      <svg
                        className={`recipient-chevron ${expanded ? '' : 'collapsed'}`}
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path d="m6 8 4 4 4-4" />
                      </svg>
                      <span className="recipient-group-name">{recipient}</span>
                      <span className="note">· {recipientTransfers.length} {t(recipientTransfers.length === 1 ? 'transfer' : 'transfers')} · {fmtIN(recipientTransfers.reduce((sum, transfer) => sum + transfer.amount, 0))} {t('total')}</span>
                    </button>
                  </td>
                </tr>
                {(!collapsed || animation === 'closing') && recipientTransfers.map(t => (
                  <tr key={t.id} className={`recipient-transfer-row ${animation || ''}`}>
                    <td className="vendor-cell">{t.recipient}</td>
                    <td className="status-cell">
                      {t.purpose}
                      <br /><span className="mono" style={{ color: 'var(--text-muted)' }}>{t.objectCode} · {t.fiscalYear} · {t.budgetCode || translateLabel('Unassigned')}</span>
                    </td>
                    <td className="num amt-cell mono">{fmtIN(t.amount)}</td>
                    <td className="mono">{t.orderDate ? formatDate(t.orderDate) : '—'}</td>
                    <td><span className={`chip ${t.status}`}><span className="dot" />{translateLabel(t.status === 'transferred' ? 'Transferred' : 'Minutes awaited')}</span></td>
                    <td className={`num${readOnly ? '' : ' edit-cell'}`}>
                      {readOnly ? fmtIN(t.utilized) : (
                      <input
                        className="table-edit-input mono"
                        type="number"
                        min="0"
                        max={t.amount}
                        step="1"
                        aria-label={`${translateLabel('Utilized amount for')} ${t.recipient}`}
                        defaultValue={t.utilized}
                        onBlur={event => {
                          const value = Number(event.currentTarget.value);
                          if (Number.isFinite(value) && value !== t.utilized) {
                            void handleUtilizationEdit(t.id, value);
                          }
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                        }}
                      />
                      )}
                    </td>
                    <td className="num mono">{fmtIN(t.amount - t.utilized)}</td>
                    <td className="status-cell">{t.remarks || '—'}</td>
                    {!readOnly && <td className="row-actions"><button className="btn-icon" onClick={() => openEditTransfer(t)} title={translateLabel('Edit')}>✎</button></td>}
                  </tr>
                ))}
                </tbody>
              );
            })}
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>{t('Each row is one transfer. Linked cleared bills update that transfer’s utilized total; its amount is counted against the selected budget year/head when transferred.')}</span>
          {!readOnly && <span>{t('Click "Utilized" to edit')}</span>}
        </p>
      </div>

      {/* District Incentive Fund */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('District Incentive Fund — DLI-1 performance grants')}</h2>
          <div className="panel-actions">
            <span className="note">{t('₹8 Cr / ₹12 Cr / ₹16 Cr brackets per qualifying district · per the Incentive GR dated 15 Apr 2026')}</span>
            {!readOnly && <button className="btn primary" onClick={() => setShowDistrictForm(true)}>+ {t('Add district')}</button>}
          </div>
        </div>
        {districtStats && (
          <div className="stats n4">
            {[
              { lbl: 'Districts', val: districtStats.totalDistricts, sub: 'across 6 divisions' },
              { lbl: 'Total released', val: fmtShort(districtStats.totalReleased), sub: `${districtStats.releasedCount} ${t(districtStats.releasedCount === 1 ? 'district' : 'districts')} ${t('recorded')}` },
              { lbl: 'Awaiting release', val: districtStats.awaitingRelease, sub: 'no amount entered yet' },
              { lbl: 'Design brackets', val: districtStats.designBrackets, sub: 'per qualifying district' },
            ].map((s, i) => (
              <div key={i} className="stat">
                <div className="lbl">{t(s.lbl)}</div>
                <div className="val mono">{s.val}</div>
                <div className="sub">{t(s.sub)}</div>
              </div>
            ))}
          </div>
        )}
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr><th>{t('District')}</th><th>{t('Division')}</th><th className="num">{t('Amount released')}</th><th>{t('Release date')}</th><th>{t('Remarks')}</th></tr>
            </thead>
            <tbody>
              {visibleDistricts.map(d => (
                <tr key={d.id}>
                  <td className="vendor-cell">{d.district}</td>
                  <td className="status-cell">{d.division}</td>
                  <td className={`num${readOnly ? '' : ' edit-cell'}`}>
                    {readOnly ? fmtIN(d.amount) : (
                    <input
                      className="table-edit-input mono"
                      type="number"
                      min="0"
                      step="1"
                      aria-label={`${t('Amount released for')} ${d.district}`}
                      defaultValue={d.amount}
                      onBlur={event => {
                        const value = Number(event.currentTarget.value);
                        if (Number.isFinite(value) && value !== d.amount) {
                          void handleDistrictEdit(d.id, 'amount', value);
                        }
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                      }}
                    />
                    )}
                  </td>
                  <td className={readOnly ? '' : 'edit-cell'}>
                    {readOnly ? (d.releaseDate ? formatDate(d.releaseDate) : '—') : (
                    <input
                      className="table-edit-input mono"
                      type="date"
                      aria-label={`${t('Release date')} ${d.district}`}
                      defaultValue={d.releaseDate || ''}
                      onBlur={event => {
                        const value = event.currentTarget.value || null;
                        if (value !== d.releaseDate) {
                          void handleDistrictEdit(d.id, 'releaseDate', value);
                        }
                      }}
                    />
                    )}
                  </td>
                  <td className={readOnly ? '' : 'edit-cell'}>
                    {readOnly ? (d.remarks || '—') : (
                    <input
                      className="table-edit-input mono"
                      type="text"
                      aria-label={`${t('Remarks for')} ${d.district}`}
                      defaultValue={d.remarks || ''}
                      placeholder="—"
                      onBlur={event => {
                        const value = event.currentTarget.value.trim() || null;
                        if (value !== d.remarks) {
                          void handleDistrictEdit(d.id, 'remarks', value);
                        }
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                      }}
                    />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>{t('All 36 districts listed by division; fund design (brackets only) is finalized but district-wise qualification scoring and disbursement are not yet in any source record — fill in as SSC/Finance Dept. approves releases.')}</span>
          {!readOnly && <span>{t('Click a cell to edit')}</span>}
        </p>
      </div>

      {!readOnly && showModal && (
  <div
    className="modal-overlay"
    onClick={e => {
      if (e.target === e.currentTarget) {
        setShowModal(false);
        setEditingTransfer(null);
      }
    }}
  >
    <div className="modal-card">
      <h3>{t(editingTransfer ? 'Edit transfer' : 'Add transfer')}</h3>

      <ProgramDistrictField
          label="Recipient — Program or District"
          type={transferForm.scopeType}
          value={transferForm.recipient}
          programs={[...programOptions, ...(transferForm.scopeType === 'program' && transferForm.recipient ? [transferForm.recipient] : [])]}
          districts={[...districtOptions, ...(transferForm.scopeType === 'district' && transferForm.recipient ? [transferForm.recipient] : [])]}
          onTypeChange={type => selectRecipient(transferForm.recipient, type)}
          onValueChange={recipient => selectRecipient(recipient, transferForm.scopeType)}
      />

      <div className="field">
        <label>{t('Purpose')}</label>
        <input
          value={transferForm.purpose}
          onChange={e =>
            setTransferForm({ ...transferForm, purpose: e.target.value })
          }
          placeholder={t('e.g. Contractual Services')}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>{t('Object code')}</label>
          <select
            value={transferForm.objectCode}
            onChange={e =>
              setTransferForm({
                ...transferForm,
                objectCode: e.target.value,
              })
            }
          >
            {[
              '01', '06', '10', '11', '13', '14', '16',
              '17', '21', '24', '26', '27', '28', '31'
            ].map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('Budget funding head')}</label>
          <select
            value={transferForm.budgetCode}
            onChange={event => setTransferForm({ ...transferForm, budgetCode: event.target.value })}
          >
            <option value="A215">A215 - {t('IPF 70 % Bank Share')}</option>
            <option value="A224">A224 - {t('IPF 30% State Share')}</option>
            <option value="A233">A233 - {t('70% PforR - Bank Share')}</option>
          </select>
        </div>
        <div className="field">
          <label>{t('Fiscal year')}</label>
          <select
            value={transferForm.fiscalYear}
            onChange={event => setTransferForm({ ...transferForm, fiscalYear: event.target.value })}
          >
            {FISCAL_YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>{t('Order date')}</label>
          <input
            type="date"
            value={transferForm.orderDate}
            onChange={e =>
              setTransferForm({
                ...transferForm,
                orderDate: e.target.value,
              })
            }
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>{t('Amount transferred (₹)')}</label>
          <input
            type="number"
            min="0"
            step="1"
            value={transferForm.amount}
            onChange={e =>
              setTransferForm({
                ...transferForm,
                amount: parseFloat(e.target.value) || 0,
              })
            }
          />
        </div>

        <div className="field">
          <label>{t('Release status')}</label>
          <select
            value={transferForm.status}
            onChange={e =>
              setTransferForm({
                ...transferForm,
                status: e.target.value,
              })
            }
          >
            <option value="transferred">{t('Transferred')}</option>
            <option value="minutes_awaited">{t('Minutes awaited')}</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>{t('Utilized to date (₹)')}</label>
        <input
          type="number"
          min="0"
          step="1"
          value={transferForm.utilized}
          onChange={e =>
            setTransferForm({
              ...transferForm,
              utilized: parseFloat(e.target.value) || 0,
            })
          }
        />
      </div>

      <div className="field">
        <label>{t('Remarks')}</label>
        <textarea
          value={transferForm.remarks}
          onChange={e =>
            setTransferForm({
              ...transferForm,
              remarks: e.target.value,
            })
          }
        />
      </div>

      <div className="modal-actions">
        <button
          className="btn"
          onClick={() => {
            setShowModal(false);
            setEditingTransfer(null);
          }}
        >
          {t('Cancel')}
        </button>

        <button
          className="btn primary"
          onClick={handleTransferSave}
        >
          {t(editingTransfer ? 'Save changes' : 'Save transfer')}
        </button>
      </div>
    </div>
  </div>
)}
    {!readOnly && showDistrictForm && (
      <div className="modal-overlay" onClick={event => {
        if (event.target === event.currentTarget) setShowDistrictForm(false);
      }}>
        <div className="modal-card">
          <h3>{t('Add district record')}</h3>
          <div className="field"><label>{t('District')}</label><input value={districtForm.district} onChange={event => setDistrictForm({ ...districtForm, district: event.target.value })} /></div>
          <div className="field"><label>{t('Division')}</label><input value={districtForm.division} onChange={event => setDistrictForm({ ...districtForm, division: event.target.value })} /></div>
          <div className="field"><label>{t('Amount released (₹)')}</label><input type="number" min="0" step="1" value={districtForm.amount} onChange={event => setDistrictForm({ ...districtForm, amount: Number(event.target.value) || 0 })} /></div>
          <div className="field"><label>{t('Release date')}</label><input type="date" value={districtForm.releaseDate} onChange={event => setDistrictForm({ ...districtForm, releaseDate: event.target.value })} /></div>
          <div className="field"><label>{t('Remarks')}</label><textarea value={districtForm.remarks} onChange={event => setDistrictForm({ ...districtForm, remarks: event.target.value })} /></div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowDistrictForm(false)}>{t('Cancel')}</button>
            <button className="btn primary" onClick={handleDistrictSave}>{t('Save district')}</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

function formatDate(d: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = d.split('-');
  if (p.length < 3) return d;
  return `${p[2]} ${months[parseInt(p[1]) - 1]} ${p[0]}`;
}

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
