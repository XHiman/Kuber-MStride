import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import type { Transfer, District } from '../../types';
import { fmtIN, fmtShort, pct } from '../bills/utils';

export default function TransfersTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferStats, setTransferStats] = useState<any>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtStats, setDistrictStats] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);

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
            <button className="btn primary" onClick={() => setShowModal(true)}>+ Add transfer</button>
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
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td className="vendor-cell">{t.recipient}</td>
                  <td className="status-cell">{t.purpose} <span className="mono" style={{ color: 'var(--text-muted)' }}>({t.objectCode})</span></td>
                  <td className="num amt-cell mono">{fmtIN(t.amount)}</td>
                  <td className="mono">{t.orderDate ? formatDate(t.orderDate) : '—'}</td>
                  <td><span className={`chip ${t.status}`}><span className="dot" />{t.status === 'transferred' ? 'Transferred' : 'Minutes awaited'}</span></td>
                  <td className="num mono edit-cell" contentEditable onBlur={e => {
                    const val = parseFloat(e.currentTarget.textContent?.replace(/[^\d.-]/g, '') || '0');
                    if (!isNaN(val)) handleUtilizationEdit(t.id, val);
                  }}>{fmtIN(t.utilized)}</td>
                  <td className="num mono">{fmtIN(t.amount - t.utilized)}</td>
                  <td className="status-cell">{t.remarks || '—'}</td>
                  <td className="row-actions"><button className="btn-icon" title="Edit">✎</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>Seeded from the DDO-transfer lines in the tracker; utilization is not in the source file — add it here as UCs come in.</span>
          <span>Click "Utilized" to edit</span>
        </p>
      </div>

      {/* District Incentive Fund */}
      <div className="panel">
        <div className="panel-head">
          <h2>District Incentive Fund — DLI-1 performance grants</h2>
          <span className="note">₹8 Cr / ₹12 Cr / ₹16 Cr brackets per qualifying district · per the Incentive GR dated 15 Apr 2026</span>
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
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-card">
            <h3>Add transfer</h3>
            <div className="field"><label>Recipient</label><input placeholder="e.g. District Collector, Nashik" /></div>
            <div className="field"><label>Purpose</label><input placeholder="e.g. Contractual Services (10)" /></div>
            <div className="field-row">
              <div className="field"><label>Object code</label>
                <select>
                  {['01', '06', '10', '11', '13', '14', '16', '17', '21', '24', '26', '27', '28', '31'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Order date</label><input type="date" /></div>
            </div>
            <div className="field-row">
              <div className="field"><label>Amount transferred (₹)</label><input type="number" min="0" step="1" /></div>
              <div className="field"><label>Release status</label>
                <select>
                  <option value="transferred">Transferred</option>
                  <option value="minutes_awaited">Minutes awaited</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary">Save transfer</button>
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
