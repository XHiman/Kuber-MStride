import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import type { Bill } from '../../types';
import { fmtIN, fmtShort, pct } from '../bills/utils';
import { BillCategory } from '../../types';
import { downloadCSV } from '../../lib/export';

export default function BillsTab() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [catFilter, setCatFilter] = useState<BillCategory | ''>('');
  const [sortBy, setSortBy] = useState<BillSortKey>('amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [billsData, dash] = await Promise.all([apiClient.bills.list(), apiClient.bills.dashboard()]);
    setBills(billsData);
    setDashboard(dash);
  }

  const filtered = useMemo(() => {
    let rows = [...bills];
    if (vendorFilter) rows = rows.filter(b => b.vendor === vendorFilter);
    if (stageFilter) rows = rows.filter(b => b.bucket === stageFilter);
    if (catFilter) rows = rows.filter(b => b.cat === catFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(b => `${b.vendor} ${b.invoice} ${b.status}`.toLowerCase().includes(q));
    }
    rows.sort((a, c) => {
      let av: any = a[sortBy as keyof Bill] ?? '';
      let cv: any = c[sortBy as keyof Bill] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof cv === 'string') cv = cv.toLowerCase();
      return av < cv ? -1 * (sortDir === 'asc' ? 1 : -1) : av > cv ? 1 * (sortDir === 'asc' ? 1 : -1) : 0;
    });
    return rows;
  }, [bills, search, vendorFilter, stageFilter, catFilter, sortBy, sortDir]);

  const vendors = useMemo(() => {
    const set = new Set(bills.map(b => b.vendor));
    return Array.from(set).sort();
  }, [bills]);

  async function handleSave(data: Partial<Bill>) {
    if (editingBill) {
      await apiClient.bills.update(editingBill.id, data);
    } else {
      await apiClient.bills.create(data);
    }
    load();
    setShowModal(false);
  }

  function handleExport() {
    const rows = filtered.map(b => ({
      '#': b.sr ?? '',
      Vendor: b.vendor,
      Invoice: b.invoice,
      Date: b.date || '',
      Amount: b.amount,
      Stage: b.bucket,
      Status: b.cat,
      'Cleared FY': b.clearedFY || '',
      Attribute: b.attribute || '',
      Days_Pending: b.days ?? '',
      Note: b.note || '',
    }));
    downloadCSV(rows, 'bills');
  }

  return (
    <div className="tab-panel" id="tab-bills">
      {/* Process strip */}
      <div className="panel">
        <div className="panel-head">
          <h2>Bill clearance process</h2>
          <span className="note">six checkpoints tracked below, in order</span>
        </div>
        <ProcessStrip />
      </div>

      {/* Stats */}
      {dashboard?.stages && <StatStrip dashboard={dashboard} />}

      {/* Pipeline stages */}
      <div className="panel">
        <div className="panel-head">
          <h2>Bills by pipeline stage</h2>
          <span className="note">value currently sitting at each checkpoint (not cumulative)</span>
        </div>
        <StageRow dashboard={dashboard} />
      </div>

      {/* Vendor + Exceptions */}
      <div className="grid-2">
        <VendorPanel bills={bills} />
        <ExceptionPanel bills={bills} />
      </div>

      {/* Aging */}
      <AgingPanel bills={bills} />

      {/* Full register */}
      <div className="panel">
        <div className="panel-head">
          <h2>Full bill register</h2>
          <div className="panel-actions">
            <span className="note">{filtered.length} of {bills.length} bills</span>
            <button className="btn export-btn" onClick={handleExport}>↓ Export CSV</button>
            <button className="btn primary" onClick={() => { setEditingBill(null); setShowModal(true); }}>+ Add bill</button>
          </div>
        </div>
        <Filters vendors={vendors} search={search} setSearch={setSearch} vendorFilter={vendorFilter} setVendorFilter={setVendorFilter} stageFilter={stageFilter} setStageFilter={setStageFilter} catFilter={catFilter} setCatFilter={setCatFilter} />
        <Table bills={filtered} sortBy={sortBy} sortDir={sortDir} onSort={(k: BillSortKey) => { if (sortBy === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir('desc'); } }} onEdit={(b: Bill) => { setEditingBill(b); setShowModal(true); }} />
        <div className="reg-foot">
          <span>"#" renumbers with your current filter/sort · click Date / Amount to sort · click ✎ to edit</span>
          <span>Filtered total: {fmtIN(filtered.reduce((s, b) => s + b.amount, 0))}</span>
        </div>
      </div>

      {showModal && <BillModal bill={editingBill} onSave={handleSave} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function ProcessStrip() {
  return (
    <div className="process-strip">
      {[
        'Raising of invoice', 'Check by PMC', 'TFC / TEC (Bill) committee approval',
        'Putting it up on file', 'Sent to treasury', 'Clearance by treasury'
      ].map((label, i) => (
        <span key={i} className="p-step">
          <span className="dot" style={{ background: `var(--stage-${i + 1})` }} />
          {i + 1}. {label}
        </span>
      ))}
    </div>
  );
}

function StatStrip({ dashboard }: { dashboard: any }) {
  const total = dashboard.total;
  const clearedAmt = dashboard.cleared.amount;
  const inProgAmt = dashboard.inProgress.amount;
  const onHoldAmt = dashboard.onHold.amount;
  const sgs = dashboard?.stages ?? {};
  const midPipeline = (sgs['TFC/TEC Committee Approval']?.amount || 0) + (sgs['Put Up on File']?.amount || 0);

  return (
    <div className="stats">
      {[
        { lbl: 'Total bill value', val: fmtShort(total), sub: `${Object.keys(sgs).length} stages` },
        { lbl: 'Cleared by treasury', val: fmtShort(clearedAmt), sub: `${pct(clearedAmt, total)}% of total · ${dashboard.cleared.count} bills`, cls: 'good' },
        { lbl: 'In pipeline', val: fmtShort(inProgAmt), sub: `${pct(inProgAmt, total)}% of total` },
        { lbl: 'On hold / exception', val: fmtShort(onHoldAmt), sub: `${dashboard.onHold.count} bills need action`, cls: dashboard.onHold.count ? 'crit' : '' },
        { lbl: 'Approved, mid-pipeline', val: fmtShort(midPipeline), sub: 'committee-cleared, not yet at treasury' },
        { lbl: 'Oldest open bill', val: dashboard.oldestPending ? `${dashboard.oldestPending.days} days` : '—', sub: dashboard.oldestPending ? `${dashboard.oldestPending.vendor} · ${fmtShort(dashboard.oldestPending.amount)}` : '' },
      ].map((s, i) => (
        <div key={i} className="stat">
          <div className="lbl">{s.lbl}</div>
          <div className="val mono">{s.val}</div>
          <div className={`sub ${s.cls || ''}`}>{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function StageRow({ dashboard }: { dashboard: any }) {
  const stages = [
    { key: 'Invoice Raised', short: 'Invoice raised' },
    { key: 'PMC Check', short: 'PMC check' },
    { key: 'TFC/TEC Committee Approval', short: 'TFC / TEC approval' },
    { key: 'Put Up on File', short: 'Put up on file' },
    { key: 'Sent to Treasury', short: 'Sent to treasury' },
    { key: 'Treasury Clearance', short: 'Treasury clearance' },
  ];

  const sgs = dashboard?.stages ?? {};
  const maxAmt = Math.max(...stages.map(s => sgs[s.key]?.amount || 0), 1);

  return (
    <div className="stage-row">
      {stages.map((s, i) => {
        const a = sgs[s.key] ?? { amount: 0, count: 0, onHold: 0 };
        const pctW = Math.max(a.amount ? 4 : 0, Math.round(a.amount / maxAmt * 100));
        return (
          <div key={i} className="stage-card">
            <span className="stop-row">
              <span className="snum">STAGE {i + 1}</span>
              {a.onHold > 0 && <span className="flag">needs attention</span>}
            </span>
            <span className="sname">{s.short}</span>
            <span className="samt mono">{fmtShort(a.amount)}</span>
            <span className="scount">{a.count} bill{(a.count === 1 ? '' : 's')}{a.onHold ? ` · ${a.onHold} on hold` : ''}</span>
            <div className="stage-bar-track">
              <div className="stage-bar-fill" style={{ width: `${pctW}%`, background: `var(--stage-${i + 1})` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VendorPanel({ bills }: { bills: Bill[] }) {
  const agg = useMemo(() => {
    const map: Record<string, { cleared: number; in_progress: number; on_hold: number; total: number; count: number }> = {};
    for (const b of bills) {
      if (!map[b.vendor]) map[b.vendor] = { cleared: 0, in_progress: 0, on_hold: 0, total: 0, count: 0 };
      const v = map[b.vendor];
      v.total += b.amount;
      v.count += 1;
      v[b.cat] += b.amount;
    }
    return Object.entries(map).sort((a, c) => c[1].total - a[1].total);
  }, [bills]);

  return (
    <div className="panel">
      <div className="panel-head"><h2>By DSU / vendor</h2><span className="note">₹ value, split by clearance status</span></div>
      <div className="legend-inline">
        <span><i style={{ background: 'var(--good)' }} />Cleared</span>
        <span><i style={{ background: 'var(--accent)' }} />In progress</span>
        <span><i style={{ background: 'var(--critical)' }} />On hold / exception</span>
      </div>
      {agg.map(([vendor, a]) => (
        <div key={vendor} className="vendor-row">
          <div className="vendor-name" title={vendor}>{vendor} <span className="cnt">({a.count})</span></div>
          <div className="vbar">
            {a.cleared > 0 && <span className="seg-cleared" style={{ width: `${pct(a.cleared, a.total)}%` }} />}
            {a.in_progress > 0 && <span className="seg-progress" style={{ width: `${pct(a.in_progress, a.total)}%` }} />}
            {a.on_hold > 0 && <span className="seg-hold" style={{ width: `${Math.max(pct(a.on_hold, a.total), 2)}%` }} />}
          </div>
          <div className="vendor-amt mono">{fmtShort(a.total)}</div>
        </div>
      ))}
    </div>
  );
}

function ExceptionPanel({ bills }: { bills: Bill[] }) {
  const exceptions = useMemo(() => bills.filter(b => b.cat === 'on_hold').sort((a, c) => (c.days || 0) - (a.days || 0)), [bills]);
  return (
    <div className="panel">
      <div className="panel-head"><h2>On hold — needs action</h2><span className="note">{exceptions.length} bill{(exceptions.length === 1 ? '' : 's')}</span></div>
      {exceptions.map(b => (
        <div key={b.id} className="exc-item">
          <div className="exc-top">
            <span>{b.vendor} · {b.invoice}</span>
            <span className="exc-amt mono">{fmtShort(b.amount)}</span>
          </div>
          <div className="exc-note">{b.note}</div>
          <div className="exc-meta">
            <span>{b.bucket}</span>
            {b.days && <span className="badge-days">{b.days}d</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgingPanel({ bills }: { bills: Bill[] }) {
  const aging = useMemo(() => bills.filter(b => b.days).sort((a, c) => (c.days || 0) - (a.days || 0)).slice(0, 10), [bills]);
  return (
    <div className="panel">
      <div className="panel-head"><h2>Oldest pending bills</h2><span className="note">days since invoice raised, still uncleared</span></div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Vendor</th><th>Invoice</th><th className="num">Days pending</th><th className="num">Amount</th><th>Stage</th><th>Current status</th>
            </tr>
          </thead>
          <tbody>
            {aging.map(b => (
              <tr key={b.id}>
                <td className="vendor-cell">{b.vendor}</td>
                <td className="inv-cell mono">{b.invoice}</td>
                <td className="num mono">{b.days}</td>
                <td className="num amt-cell mono">{fmtIN(b.amount)}</td>
                <td><span className={`chip ${b.cat}`}><span className="dot" />{b.bucket}</span></td>
                <td className="status-cell">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filters({ vendors, search, setSearch, vendorFilter, setVendorFilter, stageFilter, setStageFilter, catFilter, setCatFilter }: any) {
  return (
    <div className="filters">
      <input type="text" placeholder="Search vendor, invoice no. or status…" value={search} onChange={e => setSearch(e.target.value)} />
      <select value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}>
        {vendors.map((vendor: string) => (
          <option key={vendor} value={vendor}>
            {vendor}
          </option>
        ))}
        {Array.from(new Set([])).map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
        <option value="">All stages</option>
        {['Invoice Raised', 'PMC Check', 'TFC/TEC Committee Approval', 'Put Up on File', 'Sent to Treasury', 'Treasury Clearance'].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
        <option value="">All statuses</option>
        <option value="cleared">Cleared</option>
        <option value="in_progress">In progress</option>
        <option value="on_hold">On hold</option>
      </select>
    </div>
  );
}

type BillSortKey = 'date' | 'amount';

 type TableProps = {
    bills: Bill[];
    sortBy: BillSortKey;
    sortDir: 'asc' | 'desc';
    onSort: (key: BillSortKey) => void;
    onEdit: (bill: Bill) => void;
  };

function Table({ bills, sortBy, sortDir, onSort, onEdit }: TableProps) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Vendor</th><th>Invoice no.</th>
            <th className="sortable" onClick={() => onSort('date')}>
  Date {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
</th>

<th className="num sortable" onClick={() => onSort('amount')}>
  Amount {sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
</th>
            <th>Stage</th><th>Cleared FY</th><th>Payment attribute</th><th>Status / tracker remark</th><th></th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b: Bill, i: number) => (
            <tr key={b.id}>
              <td className="mono">{i + 1}</td>
              <td className="vendor-cell">{b.vendor}</td>
              <td className="inv-cell mono">{b.invoice}</td>
              <td className="mono">{b.date ? formatDate(b.date) : '—'}</td>
              <td className="num amt-cell mono">{fmtIN(b.amount)}</td>
              <td><span className={`chip ${b.cat}`}><span className="dot" />{b.bucket}</span></td>
              <td className="mono">{b.clearedFY || '—'}</td>
              <td className="status-cell">{b.attribute || '—'}</td>
              <td className="status-cell">{b.status}</td>
              <td className="row-actions"><button className="btn-icon" onClick={() => onEdit(b)} title="Edit">✎</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillModal({ bill, onSave, onClose }: { bill: any; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    vendor: bill?.vendor || '',
    invoice: bill?.invoice || '',
    date: bill?.date || '',
    amount: bill?.amount || '',
    attribute: bill?.attribute || '',
    status: bill?.status || '',
    budgetCode: bill?.budgetCode || '',
    objectHead: bill?.objectHead || '',
  });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <h3>{bill ? 'Edit bill' : 'Add bill'}</h3>
        <div className="field"><label>Vendor / DSU</label><input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} /></div>
        <div className="field-row">
          <div className="field"><label>Invoice no.</label><input value={form.invoice} onChange={e => setForm({ ...form, invoice: e.target.value })} /></div>
          <div className="field"><label>Invoice date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div className="field"><label>Budget code</label><input value={form.budgetCode} onChange={e => setForm({ ...form, budgetCode: e.target.value })} /></div>
          <div className="field"><label>Object Head</label><input value={form.objectHead} onChange={e => setForm({ ...form, objectHead: e.target.value })} /></div>
        </div>
        <div className="field"><label>Amount (₹)</label><input type="number" min="0" step="1" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
        <div className="field"><label>Payment attribute</label><input value={form.attribute} onChange={e => setForm({ ...form, attribute: e.target.value })} /></div>
        <div className="field"><label>Current status</label><textarea value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} /></div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(form)}>Save bill</button>
        </div>
      </div>
    </div>
  );
}

function formatDate(d: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = d.split('-');
  if (p.length < 3) return d;
  return `${p[2]} ${months[parseInt(p[1]) - 1]} ${p[0]}`;
}
