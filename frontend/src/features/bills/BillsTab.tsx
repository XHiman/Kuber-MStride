import { useState, useEffect, useMemo, useRef, type KeyboardEvent, type MutableRefObject } from 'react';
import { apiClient } from '../../lib/api';
import { STAGES, type Bill } from '../../types';
import { fmtIN, fmtShort, pct } from '../bills/utils';
import { BillCategory } from '../../types';
import { useAppSettings } from '../../lib/appSettings';
import ExportActions from '../../components/ExportActions';
import ProgramDistrictField, { type ProgramDistrictType } from '../../components/ProgramDistrictField';
import { createPortal } from 'react-dom';

export default function BillsTab({ globalQuery = '', readOnly = false }: { globalQuery?: string; readOnly?: boolean }) {
  const { t } = useAppSettings();
  const [bills, setBills] = useState<Bill[]>([]);
  const [users, setUsers] = useState<import('../../types').UserProfile[]>([]);
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
    const [billsData, dash, people] = await Promise.all([apiClient.bills.list(), apiClient.bills.dashboard(), apiClient.users.list()]);
    setBills(billsData);
    setDashboard(dash);
    setUsers(people);
  }

  async function handleNextStage(bill: Bill) {
    const currentIndex = STAGES.indexOf(bill.bucket);
    if (currentIndex < 0 || currentIndex >= STAGES.length - 1) return;
    try {
      await apiClient.bills.update(bill.id, { bucket: STAGES[currentIndex + 1] });
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : t('Could not advance the bill stage.'));
    }
  }

  async function handleHoldToggle(bill: Bill) {
    if (bill.cat !== 'on_hold') {
      setEditingBill({ ...bill, onHold: true, holdReason: '' });
      setShowModal(true);
      return;
    }
    try {
      await apiClient.bills.update(bill.id, { onHold: false, holdReason: null });
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : t('Could not update the bill hold.'));
    }
  }

  const filtered = useMemo(() => {
    let rows = [...bills];
    if (vendorFilter) rows = rows.filter(b => b.vendor === vendorFilter);
    if (stageFilter) rows = rows.filter(b => b.bucket === stageFilter);
    if (catFilter) rows = rows.filter(b => b.cat === catFilter);
    if (search || globalQuery) {
      const q = `${search} ${globalQuery}`.toLowerCase().trim().split(/\s+/).filter(Boolean);
      rows = rows.filter(b => {
        const assignedName = users.find(user => user.id === b.assignedUserId)?.name || '';
        const haystack = `${b.vendor} ${b.invoice} ${b.efileNumber || ''} ${b.status} ${b.cat} ${b.bucket} ${b.attribute || ''} ${b.note || ''} ${b.holdReason || ''} ${b.budgetCode || ''} ${b.objectHead || ''} ${b.program || ''} ${b.district || ''} ${assignedName} ${billAmount(b)} ${b.date || ''}`.toLowerCase();
        return q.every(term => haystack.includes(term));
      });
    }
    rows.sort((a, c) => {
      let av: any = sortBy === 'amount' ? billAmount(a) : a[sortBy as keyof Bill] ?? '';
      let cv: any = sortBy === 'amount' ? billAmount(c) : c[sortBy as keyof Bill] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof cv === 'string') cv = cv.toLowerCase();
      return av < cv ? -1 * (sortDir === 'asc' ? 1 : -1) : av > cv ? 1 * (sortDir === 'asc' ? 1 : -1) : 0;
    });
    return rows;
  }, [bills, users, search, globalQuery, vendorFilter, stageFilter, catFilter, sortBy, sortDir]);

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
    await load();
    setShowModal(false);
  }

  function getExportRows() {
    return filtered.map(b => ({
      '#': b.sr ?? '',
      Vendor: b.vendor,
      Invoice: b.invoice,
      'E-file number': b.efileNumber || '',
      Date: b.date || '',
      Amount: billAmount(b),
      'Amount Raised': b.amount,
      'Amount Sanctioned': b.amountSanctioned ?? '',
      Stage: b.bucket,
      Status: b.cat,
      'Cleared FY': b.clearedFY || '',
      Attribute: b.attribute || '',
      Program: b.program || '',
      District: b.district || '',
      'Stage history': (b.stageHistory || []).map(entry => `${entry.stage}: ${formatDateTime(entry.enteredAt)}`).join(' | '),
      Assigned_to: users.find(user => user.id === b.assignedUserId)?.name || '',
      Days_Pending: b.days ?? '',
      Note: b.note || '',
    }));
  }

  return (
    <div className="tab-panel" id="tab-bills">
      {/* Process strip */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Bill clearance process')}</h2>
          <span className="note">{t('six checkpoints tracked below, in order')}</span>
        </div>
        <ProcessStrip />
      </div>

      {/* Stats */}
      {dashboard?.stages && <StatStrip dashboard={dashboard} />}

      {/* Pipeline stages */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Bills by pipeline stage')}</h2>
          <span className="note">{t('value currently sitting at each checkpoint (not cumulative)')}</span>
        </div>
        <StageRow dashboard={dashboard} />
      </div>

      {/* Vendor + Exceptions */}
      <div className="grid-2">
        <VendorPanel bills={bills} />
        <ExceptionPanel bills={bills} onEdit={bill => { setEditingBill(bill); setShowModal(true); }} readOnly={readOnly} />
      </div>

      {/* Aging */}
      <AgingPanel bills={bills} onEdit={bill => { setEditingBill(bill); setShowModal(true); }} readOnly={readOnly} />

      {/* Full register */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Full bill register')}</h2>
          <div className="panel-actions">
            <span className="note">{filtered.length} {t('of')} {bills.length} {t('bills')}</span>
            <ExportActions getRows={getExportRows} filename="bills" />
            {!readOnly && <button className="btn primary" onClick={() => { setEditingBill(null); setShowModal(true); }}>+ {t('Add bill')}</button>}
          </div>
        </div>
        <Filters
          vendors={vendors}
          search={search}
          setSearch={setSearch}
          vendorFilter={vendorFilter}
          setVendorFilter={setVendorFilter}
          stageFilter={stageFilter}
          setStageFilter={setStageFilter}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          onClear={() => {
            setSearch('');
            setVendorFilter('');
            setStageFilter('');
            setCatFilter('');
          }}
        />
        <Table
          bills={filtered}
          users={users}
          emptyMessage={bills.length === 0 ? t('No bills have been added yet. Use “Add bill” to start the register.') : t('No bills match the selected search or filters.')}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={(k: BillSortKey) => { if (sortBy === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir('desc'); } }}
          onEdit={(b: Bill) => { setEditingBill(b); setShowModal(true); }}
          onNextStage={bill => void handleNextStage(bill)}
          onToggleHold={bill => void handleHoldToggle(bill)}
          readOnly={readOnly}
        />
        <div className="reg-foot">
          <span>{t('"#" renumbers with your current filter/sort · click Date / Amount to sort · hover a row for actions')}</span>
          <span>{t('Filtered total')}: {fmtIN(filtered.reduce((s, b) => s + billAmount(b), 0))}</span>
        </div>
      </div>

      {showModal && <BillModal key={editingBill?.id ?? 'new'} bill={editingBill} onSave={handleSave} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function ProcessStrip() {
  const { t } = useAppSettings();
  return (
    <div className="process-strip">
      {[
        'Invoice Raised', 'PMC Check Pending', 'TFC Committee Approval', 'File Approval Pending', 'Sent to Treasury', 'Cleared by Treasury'
      ].map((label, i) => (
        <span key={i} className="p-step">
          <span className="dot" style={{ background: `var(--stage-${i + 1})` }} />
          {i + 1}. {t(label)}
        </span>
      ))}
    </div>
  );
}

function StatStrip({ dashboard }: { dashboard: any }) {
  const { t } = useAppSettings();
  const total = dashboard.total;
  const clearedAmt = dashboard.cleared.amount;
  const inProgAmt = dashboard.inProgress.amount;
  const onHoldAmt = dashboard.onHold.amount;
  const sgs = dashboard?.stages ?? {};
  const midPipeline = (sgs['TFC Committee Approval']?.amount || 0) + (sgs['File Approval Pending']?.amount || 0);

  return (
    <div className="stats">
      {[
        { lbl: 'Total Invoice value', val: fmtShort(total), sub: `${Object.keys(sgs).length} stages` },
        { lbl: 'Cleared by treasury', val: fmtShort(clearedAmt), sub: `${pct(clearedAmt, total)}% of total · ${dashboard.cleared.count} bills`, cls: 'good' },
        { lbl: 'In pipeline', val: fmtShort(inProgAmt), sub: `${pct(inProgAmt, total)}% of total` },
        { lbl: 'On hold / exception', val: fmtShort(onHoldAmt), sub: `${dashboard.onHold.count} bills need action`, cls: dashboard.onHold.count ? 'crit' : '' },
        { lbl: 'Approved, mid-pipeline', val: fmtShort(midPipeline), sub: 'committee-cleared, not yet at treasury' },
        { lbl: 'Oldest open bill', val: dashboard.oldestPending ? `${dashboard.oldestPending.days} days` : '—', sub: dashboard.oldestPending ? `${dashboard.oldestPending.vendor} · ${fmtShort(dashboard.oldestPending.amount)}` : '' },
      ].map((s, i) => (
        <div key={i} className="stat">
          <div className="lbl">{t(s.lbl)}</div>
          <div className="val mono">{s.val}</div>
          <div className={`sub ${s.cls || ''}`}>{t(s.sub)}</div>
        </div>
      ))}
    </div>
  );
}

function StageRow({ dashboard }: { dashboard: any }) {
  const { t } = useAppSettings();
  const stages = [
    { key: 'Invoice Raised', short: 'Invoice raised' },
    { key: 'PMC Check Pending', short: 'PMC check' },
    { key: 'TFC Committee Approval', short: 'TFC approval' },
    { key: 'File Approval Pending', short: 'File Pending' },
    { key: 'Sent to Treasury', short: 'Sent to treasury' },
    { key: 'Cleared by Treasury', short: 'Treasury clearance' },
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
              <span className="snum">{t('STAGE')} {i + 1}</span>
                {a.onHold > 0 && <span className="flag">{t('needs attention')}</span>}
            </span>
            <span className="sname">{s.short}</span>
            <span className="samt mono">{fmtShort(a.amount)}</span>
            <span className="scount">{a.count} {t(a.count === 1 ? 'bill' : 'bills')}{a.onHold ? ` · ${a.onHold} ${t('on hold')}` : ''}</span>
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
  const { t } = useAppSettings();
  const agg = useMemo(() => {
    const map: Record<string, { cleared: number; in_progress: number; on_hold: number; total: number; count: number }> = {};
    for (const b of bills) {
      if (!map[b.vendor]) map[b.vendor] = { cleared: 0, in_progress: 0, on_hold: 0, total: 0, count: 0 };
      const v = map[b.vendor];
      v.total += billAmount(b);
      v.count += 1;
      v[b.cat] += billAmount(b);
    }
    return Object.entries(map).sort((a, c) => c[1].total - a[1].total);
  }, [bills]);
  const [hoveredSegment, setHoveredSegment] = useState<{
    label: string;
    value: number;
    percentage: number;
    x: number;
    y: number;
  } | null>(null);

  const handleSegmentHover = (
    e: React.MouseEvent,
    value: number,
    total: number
  ) => {
    setHoveredSegment({
      label: e.currentTarget.classList.contains('seg-cleared') ? t('Cleared') :
             e.currentTarget.classList.contains('seg-progress') ? t('In progress') :
             e.currentTarget.classList.contains('seg-hold') ? t('On hold / exception') : '',
      value,
      percentage: pct(value, total),
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleSegmentLeave = () => {
    setHoveredSegment(null);
  };

  return (
    <div className="panel">
      <div className="panel-head"><h2>{t('By DSU / vendor')}</h2><span className="note">{t('₹ value, split by clearance status')}</span></div>
      <div className="legend-inline">
        <span><i style={{ background: 'var(--good)' }} />{t('Cleared')}</span>
        <span><i style={{ background: 'var(--accent)' }} />{t('In progress')}</span>
        <span><i style={{ background: 'var(--critical)' }} />{t('On hold / exception')}</span>
      </div>
      {agg.map(([vendor, a]) => (
        <div key={vendor} className="vendor-row">
          <div className="vendor-name" title={vendor}>{vendor} <span className="cnt">({a.count})</span></div>
            <div className="vbar">
              {a.cleared > 0 && (
                <span
                  className="seg-cleared"
                  style={{ width: `${pct(a.cleared, a.total)}%` }}
                  onMouseMove={(e) => handleSegmentHover(e, a.cleared, a.total)}
                  onMouseLeave={handleSegmentLeave}
                />
              )}

              {a.in_progress > 0 && (
                <span
                  className="seg-progress"
                  style={{ width: `${pct(a.in_progress, a.total)}%` }}
                  onMouseMove={(e) => handleSegmentHover(e, a.in_progress, a.total)}
                  onMouseLeave={handleSegmentLeave}
                />
              )}

              {a.on_hold > 0 && (
                <span
                  className="seg-hold"
                  style={{ width: `${Math.max(pct(a.on_hold, a.total), 2)}%` }}
                  onMouseMove={(e) => handleSegmentHover(e, a.on_hold, a.total)}
                  onMouseLeave={handleSegmentLeave}
                />
              )}
            </div>
          <div className="vendor-amt mono">{fmtShort(a.total)}</div>
        </div>
      ))}
      {hoveredSegment && (
        <div
          className="mouse-tooltip"
          style={{
            left: hoveredSegment.x + 12,
            top: hoveredSegment.y + 12,
          }}
        >
          <div>{hoveredSegment.label}:</div>
          <div>{fmtShort(hoveredSegment.value)} | {hoveredSegment.percentage.toFixed(1)}%</div>
        </div>
      )}
      {agg.length === 0 && <EmptyState title={t('No bill activity yet')} detail={t('Vendor summaries will appear here when bills are entered.')} />}
    </div>
  );
}

function ExceptionPanel({ bills, onEdit, readOnly }: { bills: Bill[]; onEdit: (bill: Bill) => void; readOnly: boolean }) {
  const { t } = useAppSettings();
  const exceptions = useMemo(() => bills
    .filter(b => b.cat === 'on_hold')
    .sort((a, c) => (c._days || 0) - (a._days || 0)), [bills]);
  return (
    <div className="panel">
      <div className="panel-head"><h2>{t('Needs Action')}</h2><span className="note">{exceptions.length} {t(exceptions.length === 1 ? 'bill' : 'bills')}</span></div>
      <div className="exception-scroll">
      {exceptions.map(b => (
        <div
          key={b.id}
          className={`exc-item${readOnly ? '' : ' clickable-bill'}`}
          role={readOnly ? undefined : 'button'}
          tabIndex={readOnly ? undefined : 0}
          onClick={() => !readOnly && onEdit(b)}
          onKeyDown={event => {
            if (!readOnly && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onEdit(b);
            }
          }}
        >
          <div className="exc-top">
            <span>{b.vendor} · {b.invoice}</span>
            <span className="exc-amt mono">{fmtShort(billAmount(b))}</span>
          </div>
          <div className="exc-note">{b.holdReason || b.note || t('No hold remark provided.')}</div>
          <div className="exc-meta">
            <span>{b.bucket}</span>
            {b._days !== null && b._days !== undefined && <span className="badge-days">{b._days}d</span>}
          </div>
        </div>
      ))}
      </div>
      {exceptions.length === 0 && <EmptyState title={t('Nothing needs attention')} detail={t('On-hold bills will be listed here.')} />}
    </div>
  );
}

function AgingPanel({ bills, onEdit, readOnly }: { bills: Bill[]; onEdit: (bill: Bill) => void; readOnly: boolean }) {
  const { t } = useAppSettings();
  const aging = useMemo(() => bills
    .filter(b => b.cat !== 'cleared' && b.cat !== 'on_hold' && b._days !== null && b._days !== undefined && b._days >= 0)
    .sort((a, c) => (c._days || 0) - (a._days || 0))
  , [bills]);
  return (
    <div className="panel">
      <div className="panel-head"><h2>{t('Pending bills')}</h2><span className="note">{t('days since invoice raised, still uncleared')}</span></div>
      <div className="table-scroll pending-bills-scroll">
        <table>
          <thead>
            <tr>
              <th>{t('Vendor')}</th><th>{t('Invoice')}</th><th className="num">{t('Days pending')}</th><th className="num">{t('Amount')}</th><th>{t('Stage')}</th><th>{t('Current status')}</th>
            </tr>
          </thead>
          <tbody>
            {aging.map(b => (
              <tr
                key={b.id}
                className={readOnly ? '' : 'clickable-bill'}
                onClick={() => !readOnly && onEdit(b)}
                onKeyDown={event => {
                  if (!readOnly && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onEdit(b);
                  }
                }}
                tabIndex={readOnly ? undefined : 0}
                role={readOnly ? undefined : 'button'}
              >
                <td className="vendor-cell">{b.vendor}</td>
                <td className="inv-cell mono">{b.invoice}</td>
                <td className="num mono">{b._days}</td>
                <td className="num amt-cell mono">{fmtIN(billAmount(b))}</td>
                <td><span className={`chip ${b.cat} ${stageClass(b.bucket)}`}><span className="dot" />{b.bucket}</span></td>
                <td className="status-cell">{b.status}</td>
              </tr>
            ))}
            {/* {aging.length === 0 && (
              <tr><td className="empty-table" colSpan={6}>{t('No pending bills to age.')}</td></tr>
            )} */}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-mark" aria-hidden="true">—</span>
      <span><strong>{title}</strong><small>{detail}</small></span>
    </div>
  );
}

type FiltersProps = {
  vendors: string[];
  search: string;
  setSearch: (value: string) => void;
  vendorFilter: string;
  setVendorFilter: (value: string) => void;
  stageFilter: string;
  setStageFilter: (value: string) => void;
  catFilter: BillCategory | '';
  setCatFilter: (value: BillCategory | '') => void;
  onClear: () => void;
};

function Filters({ vendors, search, setSearch, vendorFilter, setVendorFilter, stageFilter, setStageFilter, catFilter, setCatFilter, onClear }: FiltersProps) {
  const { t } = useAppSettings();
  const hasFilters = Boolean(search || vendorFilter || stageFilter || catFilter);
  return (
    <div className="filters">
      <label className="sr-only" htmlFor="bill-search">{t('Search bills')}</label>
      <input id="bill-search" type="search" placeholder={t('Search vendor, invoice no., E-file or status…')} value={search} onChange={e => setSearch(e.target.value)} />
      <label className="sr-only" htmlFor="bill-vendor-filter">{t('Filter by vendor')}</label>
      <select id="bill-vendor-filter" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}>
        <option value="">{t('All vendors')}</option>
        {vendors.map((vendor: string) => (
          <option key={vendor} value={vendor}>
            {vendor}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="bill-stage-filter">{t('Filter by stage')}</label>
      <select id="bill-stage-filter" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
        <option value="">{t('All stages')}</option>
        {['Invoice Raised', 'PMC Check Pending', 'TFC Committee Approval', 'File Approval Pending', 'Sent to Treasury', 'Cleared by Treasury'].map(s => <option key={s} value={s}>{t(s)}</option>)}
      </select>
      <label className="sr-only" htmlFor="bill-status-filter">{t('Filter by status')}</label>
      <select id="bill-status-filter" value={catFilter} onChange={e => setCatFilter(e.target.value as BillCategory | '')}>
        <option value="">{t('All statuses')}</option>
        <option value="cleared">{t('Cleared')}</option>
        <option value="in_progress">{t('In progress')}</option>
        <option value="on_hold">{t('On hold')}</option>
      </select>
      {hasFilters && <button type="button" className="btn" onClick={onClear}>{t('Clear filters')}</button>}
    </div>
  );
}

type BillSortKey = 'date' | 'amount';

 type TableProps = {
    bills: Bill[];
    users: import('../../types').UserProfile[];
    sortBy: BillSortKey;
    sortDir: 'asc' | 'desc';
    onSort: (key: BillSortKey) => void;
    onEdit: (bill: Bill) => void;
    onNextStage: (bill: Bill) => void;
    onToggleHold: (bill: Bill) => void;
    readOnly: boolean;
  };

function Table({ bills, users, emptyMessage, sortBy, sortDir, onSort, onEdit, onNextStage, onToggleHold, readOnly }: TableProps & { emptyMessage: string }) {
  const { t } = useAppSettings();
  const [historyBill, setHistoryBill] = useState<Bill | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
  return (
    <div className="table-scroll bill-register-scroll">
      <table className="bill-register-table">
        <colgroup>
          <col className="bill-col-vendor" />
          <col className="bill-col-invoice" />
          <col className="bill-col-efile" />
          <col className="bill-col-date" />
          <col className="bill-col-amount" />
          <col className="bill-col-stage" />
          <col className="bill-col-entity" />
          <col className="bill-col-assignee" />
          <col className="bill-col-attribute" />
        </colgroup>
        <thead>
          <tr>
            <th>{t('Vendor')}</th><th>{t('Invoice no.')}</th><th>{t('E-file no.')}</th>
            <th className="sortable" aria-sort={sortBy === 'date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => onSort('date')}>{t('Date')} <span aria-hidden="true">{sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span></button>
            </th>
            <th className="num sortable" aria-sort={sortBy === 'amount' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
              <button type="button" onClick={() => onSort('amount')}>{t('Amount')} <span aria-hidden="true">{sortBy === 'amount' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span></button>
            </th>
            <th>{t('Stage')}</th><th>{t('Program / District')}</th><th>{t('Assigned person')}</th><th>{t('Payment attribute')}</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b: Bill) => (
            <tr key={b.id} className="bill-register-row">
              <td className="bill-register-cell vendor-cell">{b.vendor}</td>
              <td className="bill-register-cell inv-cell mono">{b.invoice}</td>
              <td className="bill-register-cell mono">{b.efileNumber || '—'}</td>
              <td className="bill-register-cell mono">{b.date ? formatDate(b.date) : '—'}</td>
              <td className="bill-register-cell num amt-cell mono">{fmtIN(billAmount(b))}</td>
              <td className="bill-register-cell bill-stage-cell">
                <span className={`chip ${b.cat} ${stageClass(b.bucket)}`}><span className="dot" />{b.bucket}</span>
              </td>
              <td className="bill-register-cell">{b.program || b.district || '—'}</td>
              <td className="bill-register-cell">{users.find(user => user.id === b.assignedUserId)?.name || '—'}</td>
              <td className={`bill-register-cell status-cell ${readOnly ? '' : 'bill-attribute-cell'}`}>
                <span className="bill-attribute-value" title={b.attribute || undefined}>{b.attribute || '—'}</span>
                {!readOnly && <div className="bill-row-actions" aria-label={t('Bill actions')}>
                 {b.bucket !== STAGES[STAGES.length - 1] && (
  <button
    type="button"
    className="btn-icon"
    onClick={() => onNextStage(b)}
    title={t('Move to next stage')}
    aria-label={`${t('Move to next stage')}: ${b.invoice}`}
  >
    ⇢
  </button>
)}

{!!b.stageHistory?.length && (
    <button
      type="button"
      className="btn-icon"
      onClick={event => {
        historyTriggerRef.current = event.currentTarget;
        setHistoryBill(b);
      }}
      title={t('View History')}
      aria-label={`View history for: ${b.invoice}`}
    >
      {/* History icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l4 2" />
      </svg>
    </button>
)}

                  <button type="button" className="btn-icon" onClick={() => onToggleHold(b)} title={t(b.cat === 'on_hold' ? 'Release hold' : 'Put on hold')} aria-label={`${t(b.cat === 'on_hold' ? 'Release hold' : 'Put on hold')}: ${b.invoice}`}>{b.cat === 'on_hold' ? '▶' : 'Ⅱ'}</button>
                  <button type="button" className="btn-icon" onClick={() => onEdit(b)} title={t('Edit')} aria-label={`${t('Edit')}: ${b.invoice}`}>✎</button>
                </div>}
              </td>
            </tr>
          ))}
          {bills.length === 0 && (
            <tr><td className="empty-table" colSpan={9}>{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
      {historyBill && (
        <BillHistoryModal
          bill={historyBill}
          onClose={() => setHistoryBill(null)}
          triggerRef={historyTriggerRef}
        />
      )}
    </div>
  );
}

function BillHistoryModal({
  bill,
  onClose,
  triggerRef,
}: {
  bill: Bill;
  onClose: () => void;
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
}) {
  const { t } = useAppSettings();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const footerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const timeline = [...bill.stageHistory].reverse();
  const currentEventId = timeline.find(entry => entry.stage === bill.bucket)?.id;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [bill.id, triggerRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const focusableButtons = [closeButtonRef.current, footerCloseButtonRef.current]
        .filter((button): button is HTMLButtonElement => button !== null);
      const currentIndex = focusableButtons.findIndex(button => button === document.activeElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusableButtons.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusableButtons.length - 1 ? 0 : currentIndex + 1);
      focusableButtons[nextIndex]?.focus();
    }
  }

  return createPortal(
    <div className="history-modal-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
        aria-describedby="history-modal-description"
        onKeyDown={handleKeyDown}
      >
        <header className="history-modal-head">
          <div>
            <p className="history-modal-kicker">{t('Bill audit trail')}</p>
            <h2 id="history-modal-title">{t('Stage History')}</h2>
            <p id="history-modal-description">{t('Chronological record of this bill’s workflow stages.')}</p>
          </div>
          {/* <button
            ref={closeButtonRef}
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label={t('Close')}
            title={t('Close')}
          >
            ×
          </button> */}
        </header>

        <div className="history-modal-content">
          <section className="history-bill-summary" aria-label={t('Bill details')}>
            <div className="history-bill-identity">
              <span className="history-summary-label">{t('Vendor')}</span>
              <strong title={bill.vendor}>{bill.vendor}</strong>
              <span className="history-bill-invoice mono">{bill.invoice}</span>
            </div>
            <div className="history-summary-item">
              <span className="history-summary-label">{t('E-file no.')}</span>
              <strong className="mono">{bill.efileNumber || '—'}</strong>
            </div>
            <div className="history-summary-item">
              <span className="history-summary-label">{t('Amount')}</span>
              <strong className="mono">{fmtIN(billAmount(bill))}</strong>
            </div>
            <div className="history-current-stage">
              <span className="history-summary-label">{t('Current stage')}</span>
              <span className={`chip ${bill.cat} ${stageClass(bill.bucket)}`}>
                <span className="dot" />{t(bill.bucket)}
              </span>
            </div>
          </section>

          <section className="history-timeline-section" aria-labelledby="history-timeline-title">
            <div className="history-timeline-heading">
              <div>
                <h3 id="history-timeline-title">{t('Workflow timeline')}</h3>
                <p>{t('Oldest event first')}</p>
              </div>
              <span className="history-event-count">
                {timeline.length} {t(timeline.length === 1 ? 'record' : 'records')}
              </span>
            </div>

            <ol className="history-timeline">
              {timeline.map((entry, index) => {
                const isSnapshot = entry.source === 'migration_snapshot' ||
                  entry.source === 'legacy_backup_snapshot';
                const isCurrent = entry.id === currentEventId;
                const stageIndex = STAGES.indexOf(entry.stage);
                return (
                  <li
                    key={entry.id}
                    className={`history-timeline-entry${isCurrent ? ' is-current' : ''}${isSnapshot ? ' is-snapshot' : ''}`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    <span className="history-timeline-marker" aria-hidden="true" />
                    <div className="history-event-card">
                      <div className="history-event-topline">
                        <span className="history-event-stage">{t(entry.stage)}</span>
                        {isCurrent && <span className="history-current-badge">{t('Current')}</span>}
                        {stageIndex >= 0 && (
                          <span className="history-event-step">
                            {t('Stage')} {stageIndex + 1} / {STAGES.length}
                          </span>
                        )}
                      </div>
                      <time className="history-event-time" dateTime={entry.enteredAt}>
                        {formatDateTime(entry.enteredAt)}
                      </time>
                      <span className="history-event-source">
                        {t(isSnapshot ? 'Imported snapshot' : entry.source === 'created' ? 'Initial record' : 'Workflow update')}
                        {!isSnapshot && index === timeline.length - 1 && entry.source === 'created'
                          ? ` · ${t('Bill created')}`
                          : ''}
                      </span>
                      {isSnapshot && (
                        <p className="history-snapshot-notice">
                          {t('Snapshot; earlier stages unavailable')}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
        <footer className="history-modal-foot">
          <span>{t('This is the recorded workflow history; snapshot entries do not include unavailable earlier stages.')}</span>
          <button ref={footerCloseButtonRef} type="button" className="btn" onClick={onClose}>{t('Close')}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function BillModal({ bill, onSave, onClose }: { bill: Bill | null; onSave: (data: Partial<Bill>) => Promise<void>; onClose: () => void }) {
  const { t } = useAppSettings();
  const dialogRef = useRef<HTMLFormElement>(null);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [users, setUsers] = useState<import('../../types').UserProfile[]>([]);
  const [districts, setDistricts] = useState<import('../../types').District[]>([]);
  const [entityType, setEntityType] = useState<ProgramDistrictType>(bill?.district ? 'district' : 'program');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    vendor: bill?.vendor || '',
    invoice: bill?.invoice || '',
    efileNumber: bill?.efileNumber || '',
    date: bill?.date || '',
    amount: bill?.amount || '',
    amountSanctioned: bill?.amountSanctioned ?? '',
    onHold: bill?.onHold ?? bill?.cat === 'on_hold',
    holdReason: bill?.holdReason || (bill?.cat === 'on_hold' ? bill?.note || '' : ''),
    attribute: bill?.attribute || '',
    status: bill?.status || '',
    budgetCode: bill?.budgetCode || '',
    objectHead: bill?.objectHead || '',
    transferId: bill?.transferId || '',
    program: bill?.program || '',
    district: bill?.district || '',
    assignedUserId: bill?.assignedUserId || '',
    bucket: bill?.bucket || 'Invoice Raised',
  });

  useEffect(() => {
    apiClient.transfers.records().then(setTransfers);
    apiClient.users.list().then(setUsers);
    apiClient.districts.records().then(setDistricts);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError('');
    setSaving(true);
    try {
      await onSave({
        ...form,
        amount: Number(form.amount),
        amountSanctioned: form.amountSanctioned === '' ? null : Number(form.amountSanctioned),
        date: form.date || null,
        onHold: form.onHold,
        holdReason: form.onHold ? form.holdReason.trim() : null,
        budgetCode: form.budgetCode || null,
        objectHead: form.objectHead || null,
        transferId: form.transferId || null,
        program: form.program.trim() || null,
        district: form.district.trim() || null,
        assignedUserId: form.assignedUserId || null,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('Failed to save bill. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  function trapDialogKeys(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!saving) onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    ) ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="modal-overlay" onClick={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form
        ref={dialogRef}
        className="modal-card bill-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bill-modal-title"
        aria-describedby="bill-modal-description"
        onSubmit={event => void submit(event)}
        onKeyDown={trapDialogKeys}
      >
        <div className="bill-modal-heading">
          <h3 id="bill-modal-title">{t(bill ? 'Edit bill' : 'Add bill')}</h3>
          <p id="bill-modal-description">{t('Enter the invoice details. Fields marked required must be completed before saving.')}</p>
        </div>
        <div className="bill-form-grid">
          <div className="bill-field-wide">
            <ProgramDistrictField
              label="Vendor / DSU — Program or DSU"
              districtLabel="DSU"
              districtPlaceholder="Select or enter a DSU"
              required
              type={entityType}
              value={form.vendor}
              programs={[...users.flatMap(user => user.programs), ...transfers.filter(transfer => transfer.scopeType === 'program').map(transfer => transfer.recipient), ...(form.program ? [form.program] : [])]}
              districts={[...districts.map(district => district.district), ...users.flatMap(user => user.districts), ...transfers.filter(transfer => transfer.scopeType === 'district').map(transfer => transfer.recipient), ...(form.district ? [form.district] : [])]}
              onTypeChange={type => {
                setEntityType(type);
                setForm(previous => ({
                  ...previous,
                  program: type === 'program' ? previous.vendor : '',
                  district: type === 'district' ? previous.vendor : '',
                }));
              }}
              onValueChange={value => setForm(previous => ({
                ...previous,
                vendor: value,
                program: entityType === 'program' ? value : '',
                district: entityType === 'district' ? value : '',
              }))}
            />
          </div>
          <div className="field">
            <label htmlFor="bill-invoice">{t('Invoice no.')} <span aria-hidden="true">*</span></label>
            <input id="bill-invoice" required value={form.invoice} onChange={event => setForm({ ...form, invoice: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="bill-efile">{t('E-file number')}</label>
            <input id="bill-efile" value={form.efileNumber} onChange={event => setForm({ ...form, efileNumber: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="bill-date">{t('Invoice date')}</label>
            <input id="bill-date" type="date" value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} />
          </div>
          <div className="field bill-field-wide">
            <label htmlFor="bill-stage">{t('Stage')}</label>
            <select id="bill-stage" value={form.bucket} onChange={event => setForm({ ...form, bucket: event.target.value })}>
              {STAGES.map(stage => <option key={stage} value={stage}>{t(stage)}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bill-amount-raised">{t('Amount Raised (₹)')} <span aria-hidden="true">*</span></label>
            <input id="bill-amount-raised" type="number" min="0" step="1" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value === '' ? '' : Number(event.target.value) })} />
          </div>
          <div className="field">
            <label htmlFor="bill-amount-sanctioned">{t('Amount Sanctioned (₹)')}</label>
            <input
              id="bill-amount-sanctioned"
              type="number"
              min="0"
              step="1"
              disabled={form.bucket !== 'Cleared by Treasury'}
              value={form.amountSanctioned}
              onChange={event => setForm({ ...form, amountSanctioned: event.target.value === '' ? '' : Number(event.target.value) })}
            />
            <small className="note">{form.bucket === 'Cleared by Treasury'
              ? t('When entered, this becomes the bill amount used in totals; otherwise Amount Raised is used.')
              : t('Available when the bill reaches Cleared by Treasury.')}</small>
          </div>
          <div className="field">
            <label htmlFor="bill-budget-code">{t('Budget code')}</label>
            <select id="bill-budget-code" value={form.budgetCode} onChange={event => setForm({ ...form, budgetCode: event.target.value })}>
              <option value="">{t('Select budget code')}</option>
              <option value="A215">A215 - {t('IPF 70 % Bank Share')}</option>
              <option value="A224">A224 - {t('IPF 30% State Share')}</option>
              <option value="A233">A233 - {t('70% PforR - Bank Share')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="bill-object-head">{t('Object Head')}</label>
            <select id="bill-object-head" value={form.objectHead} onChange={event => setForm({ ...form, objectHead: event.target.value })}>
              <option value="">{t('Select Object Head')}</option>
              <option value="01">01 - {t('Salary')}</option>
              <option value="06">06 - {t('Telephone/Electricity/Water')}</option>
              <option value="10">10 - {t('Contractual Services')}</option>
              <option value="11">11 - {t('Domestic Travel')}</option>
              <option value="13">13 - {t('Office Expenses')}</option>
              <option value="14">14 - {t('Rent and Taxes')}</option>
              <option value="16">16 - {t('Publications')}</option>
              <option value="17">17 - {t('Computer Expenses')}</option>
              <option value="21">21 - {t('Supplies and Materials')}</option>
              <option value="24">24 - {t('Petrol/Oil/Lubricant')}</option>
              <option value="26">26 - {t('Advertisement and Publicity')}</option>
              <option value="27">27 - {t('Minor Works')}</option>
              <option value="28">28 - {t('Professional Services')}</option>
              <option value="31">31 - {t('Grant-in-aid (non-salary)')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="bill-attribute">{t('Payment attribute')}</label>
            <input id="bill-attribute" value={form.attribute} onChange={event => setForm({ ...form, attribute: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="bill-assignee">{t('Assigned person')}</label>
            <select id="bill-assignee" value={form.assignedUserId} onChange={event => setForm({ ...form, assignedUserId: event.target.value })}>
              <option value="">{t('Unassigned')}</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
          </div>
          <div className="field bill-field-wide">
            <label htmlFor="bill-status">{t('Current status')} <span aria-hidden="true">*</span></label>
            <textarea id="bill-status" required value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} />
          </div>
          <div className="bill-hold-control bill-field-wide">
            <label>
              <input type="checkbox" checked={form.onHold} onChange={event => setForm({ ...form, onHold: event.target.checked })} />
              {t('Put this bill on hold')}
            </label>
            {form.onHold && (
              <div className="field">
                <label htmlFor="bill-hold-reason">{t('On-hold remarks')} <span aria-hidden="true">*</span></label>
                <textarea
                  id="bill-hold-reason"
                  required
                  placeholder={t('Explain why this bill is on hold')}
                  value={form.holdReason}
                  onChange={event => setForm({ ...form, holdReason: event.target.value })}
                />
              </div>
            )}
          </div>
        </div>
        {saveError && <p className="bill-save-error" role="alert">{saveError}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>{t('Cancel')}</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? t('Saving…') : t('Save bill')}</button>
        </div>
      </form>
    </div>
  );
}

// function formatDate(d: string): string {
//   const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
//   const p = d.split('-');
//   if (p.length < 3) return d;
//   return `${p[2]} ${months[parseInt(p[1]) - 1]} ${p[0]}`;
// }
function formatDate(d: string): string {
  const p = d.split('-');
  if (p.length < 3) return d;

  const yy = p[0].slice(-2);
  const mm = p[1].padStart(2, '0');
  const dd = p[2].padStart(2, '0');

  return `${dd}/${mm}/${yy}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function billAmount(bill: Bill): number {
  return bill.effectiveAmount
    ?? (bill.bucket === 'Cleared by Treasury' && bill.amountSanctioned !== null
      ? bill.amountSanctioned
      : bill.amount);
}

function stageClass(bucket: string): string {
  const stages = [
    'Invoice Raised',
    'PMC Check Pending',
    'TFC Committee Approval',
    'File Approval Pending',
    'Sent to Treasury',
    'Cleared by Treasury'
  ];
  const stage = stages.indexOf(bucket) + 1;
  return stage > 0 ? `stage-${stage}` : 'stage-1';
}
