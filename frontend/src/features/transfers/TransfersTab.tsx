import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import { FISCAL_YEARS, type Transfer, type District } from '../../types';
import { fmtIN, fmtShort } from '../bills/utils';
import { downloadCSV } from '../../lib/export';

export default function TransfersTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferStats, setTransferStats] = useState<any>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtStats, setDistrictStats] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [showDistrictForm, setShowDistrictForm] = useState(false);
  const [districtForm, setDistrictForm] = useState({ district: '', division: '', amount: 0, releaseDate: '', remarks: '' });

  const transfersByRecipient = useMemo(() => {
    const groups = new Map<string, Transfer[]>();
    for (const transfer of transfers) {
      const recipientTransfers = groups.get(transfer.recipient) || [];
      recipientTransfers.push(transfer);
      groups.set(transfer.recipient, recipientTransfers);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [transfers]);

  const [transferForm, setTransferForm] = useState({
    recipient: '',
    purpose: '',
    objectCode: '01',
    fiscalYear: 'FY 2026-27',
    budgetCode: 'A215',
    amount: 0,
    orderDate: '',
    status: 'transferred',
    utilized: 0,
    remarks: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const [stats, records, dStats, dRecords] = await Promise.all([
      apiClient.transfers.stats(),
      apiClient.transfers.records(),
      apiClient.districts.stats(),
      apiClient.districts.records(),
    ]);
    setTransferStats(stats);
    setTransfers(records);
    setDistrictStats(dStats);
    setDistricts(dRecords);
  }

  async function handleUtilizationEdit(id: string, value: number) {
    await apiClient.transfers.update(id, { utilized: value });
    load();
  }

  async function handleDistrictEdit(id: string, field: string, value: any) {
    await apiClient.districts.update(id, { [field]: value });
    load();
  }

  function openAddTransfer() {
  setEditingTransfer(null);
  setTransferForm({
    recipient: '',
    purpose: '',
    objectCode: '01',
    fiscalYear: 'FY 2026-27',
    budgetCode: 'A215',
    amount: 0,
    orderDate: '',
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
    purpose: t.purpose || '',
    objectCode: t.objectCode || '01',
    fiscalYear: t.fiscalYear || 'FY 2026-27',
    budgetCode: t.budgetCode || 'A215',
    amount: t.amount || 0,
    orderDate: t.orderDate || '',
    status: t.status || 'transferred',
    utilized: t.utilized || 0,
    remarks: t.remarks || '',
  });
  setShowModal(true);
}

async function handleTransferSave() {
  if (!transferForm.recipient.trim() || !transferForm.purpose.trim()) {
    window.alert('Enter both recipient and purpose.');
    return;
  }
  if (transferForm.status === 'transferred' && !transferForm.orderDate) {
    window.alert('Enter the transfer date for a transferred amount.');
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
      window.alert('Enter both a district and division.');
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

  function handleExport() {
    const rows = transfers.map(t => ({
      Recipient: t.recipient,
      Purpose: t.purpose,
      'Object Code': t.objectCode,
      Amount: t.amount,
      'Order Date': t.orderDate || '',
      Status: t.status,
      Utilized: t.utilized,
      Balance: t.amount - t.utilized,
      Remarks: t.remarks || '',
    }));
    downloadCSV(rows, 'transfers');
  }

  return (
    <div className="tab-panel" id="tab-transfers">
      {/* Transfer stats */}
      {transferStats && (
        <div className="stats n4">
          {[
            { lbl: 'Total transferred', val: fmtShort(transferStats.totalAmt), sub: `${transferStats.count} releases` },
            { lbl: 'Utilized to date', val: fmtShort(transferStats.totalUtil), sub: `${transferStats.utilizationPct}% of transferred` },
            { lbl: 'Unutilized balance', val: fmtShort(transferStats.unutilized), sub: 'awaiting UC' },
            { lbl: 'Awaiting minutes', val: transferStats.pending, sub: transferStats.pending ? 'not yet released' : 'all released' },
          ].map((s, i) => (
            <div key={i} className="stat">
              <div className="lbl">{s.lbl}</div>
              <div className="val mono">{s.val}</div>
              <div className="sub">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transfers table */}
      <div className="panel">
        <div className="panel-head">
          <h2>Fund transfers — agencies / DDOs</h2>
          <div className="panel-actions">
            <span className="note">{transfers.length} record{(transfers.length === 1 ? '' : 's')}</span>
            <button className="btn export-btn" onClick={handleExport}>↓ Export CSV</button>
            <button className="btn primary" onClick={openAddTransfer}>
  + Add transfer
</button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Recipient</th><th>Purpose / object code</th><th className="num">Amount transferred</th>
                <th>Order date</th><th>Release status</th><th className="num">Utilized to date</th><th className="num">Balance</th><th>Remarks</th><th></th>
              </tr>
            </thead>
            {transfersByRecipient.map(([recipient, recipientTransfers]) => (
              <tbody key={recipient}>
                <tr className="tot-row">
                  <td colSpan={9}>
                    {recipient}
                    <span className="note"> · {recipientTransfers.length} transfer{recipientTransfers.length === 1 ? '' : 's'} · {fmtIN(recipientTransfers.reduce((sum, transfer) => sum + transfer.amount, 0))} total</span>
                  </td>
                </tr>
                {recipientTransfers.map(t => (
                <tr key={t.id}>
                  <td className="vendor-cell">{t.recipient}</td>
                  <td className="status-cell">
                    {t.purpose}
                    <br /><span className="mono" style={{ color: 'var(--text-muted)' }}>{t.objectCode} · {t.fiscalYear} · {t.budgetCode || 'Unassigned'}</span>
                  </td>
                  <td className="num amt-cell mono">{fmtIN(t.amount)}</td>
                  <td className="mono">{t.orderDate ? formatDate(t.orderDate) : '—'}</td>
                  <td><span className={`chip ${t.status}`}><span className="dot" />{t.status === 'transferred' ? 'Transferred' : 'Minutes awaited'}</span></td>
                  <td className="num mono edit-cell" contentEditable onBlur={e => {
                    const val = parseFloat(e.currentTarget.textContent?.replace(/[^\d.-]/g, '') || '0');
                    if (!isNaN(val)) handleUtilizationEdit(t.id, val);
                  }}>{fmtIN(t.utilized)}</td>
                  <td className="num mono">{fmtIN(t.amount - t.utilized)}</td>
                  <td className="status-cell">{t.remarks || '—'}</td>
                  <td className="row-actions"><button className="btn-icon" onClick={() => openEditTransfer(t)} title="Edit">✎</button></td>
                </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>Each row is one transfer. Linked cleared bills update that transfer’s utilized total; its amount is counted against the selected budget year/head when transferred.</span>
          <span>Click "Utilized" to edit</span>
        </p>
      </div>

      {/* District Incentive Fund */}
      <div className="panel">
        <div className="panel-head">
          <h2>District Incentive Fund — DLI-1 performance grants</h2>
          <div className="panel-actions">
            <span className="note">₹8 Cr / ₹12 Cr / ₹16 Cr brackets per qualifying district · per the Incentive GR dated 15 Apr 2026</span>
            <button className="btn primary" onClick={() => setShowDistrictForm(true)}>+ Add district</button>
          </div>
        </div>
        {districtStats && (
          <div className="stats n4">
            {[
              { lbl: 'Districts', val: districtStats.totalDistricts, sub: 'across 6 divisions' },
              { lbl: 'Total released', val: fmtShort(districtStats.totalReleased), sub: `${districtStats.releasedCount} district${districtStats.releasedCount !== 1 ? 's' : ''} recorded` },
              { lbl: 'Awaiting release', val: districtStats.awaitingRelease, sub: 'no amount entered yet' },
              { lbl: 'Design brackets', val: districtStats.designBrackets, sub: 'per qualifying district' },
            ].map((s, i) => (
              <div key={i} className="stat">
                <div className="lbl">{s.lbl}</div>
                <div className="val mono">{s.val}</div>
                <div className="sub">{s.sub}</div>
              </div>
            ))}
          </div>
        )}
        <div className="table-scroll" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr><th>District</th><th>Division</th><th className="num">Amount released</th><th>Release date</th><th>Remarks</th></tr>
            </thead>
            <tbody>
              {districts.map(d => (
                <tr key={d.id}>
                  <td className="vendor-cell">{d.district}</td>
                  <td className="status-cell">{d.division}</td>
                  <td className="num mono edit-cell" contentEditable onBlur={e => {
                    const val = parseFloat(e.currentTarget.textContent?.replace(/[^\d.-]/g, '') || '0');
                    if (!isNaN(val)) handleDistrictEdit(d.id, 'amount', val);
                  }}>{fmtIN(d.amount)}</td>
                  <td className="mono edit-cell" contentEditable onBlur={e => {
                    const val = e.currentTarget.textContent?.trim() || '';
                    handleDistrictEdit(d.id, 'releaseDate', val === '—' ? null : val);
                  }}>{d.releaseDate || '—'}</td>
                  <td className="mono edit-cell" contentEditable onBlur={e => {
                    const val = e.currentTarget.textContent?.trim() || '';
                    handleDistrictEdit(d.id, 'remarks', val === '—' ? null : val);
                  }}>{d.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>All 36 districts listed by division; fund design (brackets only) is finalized but district-wise qualification scoring and disbursement are not yet in any source record — fill in as SSC/Finance Dept. approves releases.</span>
          <span>Click a cell to edit</span>
        </p>
      </div>

      {showModal && (
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
      <h3>{editingTransfer ? 'Edit transfer' : 'Add transfer'}</h3>

      <div className="field">
        <label>Recipient</label>
        <input
          value={transferForm.recipient}
          onChange={e =>
            setTransferForm({ ...transferForm, recipient: e.target.value })
          }
          placeholder="e.g. District Collector, Nashik"
        />
      </div>

      <div className="field">
        <label>Purpose</label>
        <input
          value={transferForm.purpose}
          onChange={e =>
            setTransferForm({ ...transferForm, purpose: e.target.value })
          }
          placeholder="e.g. Contractual Services"
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Object code</label>
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
          <label>Budget funding head</label>
          <select
            value={transferForm.budgetCode}
            onChange={event => setTransferForm({ ...transferForm, budgetCode: event.target.value })}
          >
            <option value="A215">A215 - IPF 70 % Bank Share</option>
            <option value="A224">A224 - IPF 30% State Share</option>
            <option value="A233">A233 - 70% PforR - Bank Share</option>
          </select>
        </div>
        <div className="field">
          <label>Fiscal year</label>
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
          <label>Order date</label>
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
          <label>Amount transferred (₹)</label>
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
          <label>Release status</label>
          <select
            value={transferForm.status}
            onChange={e =>
              setTransferForm({
                ...transferForm,
                status: e.target.value,
              })
            }
          >
            <option value="transferred">Transferred</option>
            <option value="minutes_awaited">Minutes awaited</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Utilized to date (₹)</label>
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
        <label>Remarks</label>
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
          Cancel
        </button>

        <button
          className="btn primary"
          onClick={handleTransferSave}
        >
          {editingTransfer ? 'Save changes' : 'Save transfer'}
        </button>
      </div>
    </div>
  </div>
)}
    {showDistrictForm && (
      <div className="modal-overlay" onClick={event => {
        if (event.target === event.currentTarget) setShowDistrictForm(false);
      }}>
        <div className="modal-card">
          <h3>Add district record</h3>
          <div className="field"><label>District</label><input value={districtForm.district} onChange={event => setDistrictForm({ ...districtForm, district: event.target.value })} /></div>
          <div className="field"><label>Division</label><input value={districtForm.division} onChange={event => setDistrictForm({ ...districtForm, division: event.target.value })} /></div>
          <div className="field"><label>Amount released (₹)</label><input type="number" min="0" step="1" value={districtForm.amount} onChange={event => setDistrictForm({ ...districtForm, amount: Number(event.target.value) || 0 })} /></div>
          <div className="field"><label>Release date</label><input type="date" value={districtForm.releaseDate} onChange={event => setDistrictForm({ ...districtForm, releaseDate: event.target.value })} /></div>
          <div className="field"><label>Remarks</label><textarea value={districtForm.remarks} onChange={event => setDistrictForm({ ...districtForm, remarks: event.target.value })} /></div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowDistrictForm(false)}>Cancel</button>
            <button className="btn primary" onClick={handleDistrictSave}>Save district</button>
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
