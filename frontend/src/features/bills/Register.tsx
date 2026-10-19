import { forwardRef, useEffect, useId, useMemo, useState } from 'react';
import { Money } from '../../components/Money';
import { ReasonBadges, RecordedText } from '../../components/StatusGlossary';
import { isOverdue } from '../../lib/aging';
import { useAppSettings } from '../../lib/appSettings';
import { downloadCSVText } from '../../lib/export';
import { formatDate } from '../../lib/format';
import { STAGE_GLOSSARY } from '../../lib/status';
import { STAGES, type Bill, type BillCategory, type UserProfile } from '../../types';
import BillDrawer from './BillDrawer';
import {
  EMPTY_FILTERS, SAVED_VIEWS, buildRegisterCsv, describeFilters, exportFilename, filterBills, paginate, sortBills,
  type RegisterFilters, type SortDir, type SortKey,
} from './registerLogic';
import { DaysOpen, OverdueFlag, StageChip, billAmount, billRef } from './shared';

const PAGE_SIZE = 25;
const EXPORT_CONFIRM_ROWS = 500;

type Props = {
  bills: Bill[];
  users: UserProfile[];
  currentUserId: string | null;
  readOnly: boolean;
  overdueDays: number;
  globalQuery: string;
  stage: string;
  onStageChange: (stage: string) => void;
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
  onNextStage: (bill: Bill) => void;
  onToggleHold: (bill: Bill) => void;
};

const Register = forwardRef<HTMLHeadingElement, Props>(function Register(
  { bills, users, currentUserId, readOnly, overdueDays, globalQuery, stage, onStageChange, onAdd, onEdit, onNextStage, onToggleHold },
  headingRef,
) {
  const { t } = useAppSettings();
  const captionId = useId();
  const [filters, setFilters] = useState<Omit<RegisterFilters, 'stage'>>(EMPTY_FILTERS);
  // Oldest first by default, so the longest-waiting bills are seen first.
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [openBillId, setOpenBillId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState('');

  const allFilters: RegisterFilters = { ...filters, stage };
  const ctx = { users, currentUserId, overdueDays, globalQuery };
  const filtered = useMemo(
    () => sortBills(filterBills(bills, allFilters, ctx), sortKey, sortDir),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bills, users, currentUserId, overdueDays, globalQuery, stage, filters, sortKey, sortDir],
  );
  const view = paginate(filtered, page, PAGE_SIZE);
  const filterText = describeFilters(allFilters, globalQuery);
  const hasFilters = filterText.length > 0;
  const vendors = useMemo(() => Array.from(new Set(bills.map(b => b.vendor))).sort(), [bills]);
  const openBill = openBillId ? bills.find(b => b.id === openBillId) ?? null : null;

  // Back to page 1 whenever the result set changes shape.
  useEffect(() => { setPage(1); }, [stage, filters, globalQuery, sortKey, sortDir]);

  function update(patch: Partial<typeof filters>) {
    setFilters(previous => ({ ...previous, ...patch }));
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    onStageChange('');
  }

  function sortBy(key: SortKey) {
    if (key === sortKey) setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'date' || key === 'vendor' || key === 'stage' ? 'asc' : 'desc'); }
  }

  function exportCsv() {
    if (!filtered.length) { setExportMessage(t('There is no data to export.')); return; }
    if (filtered.length > EXPORT_CONFIRM_ROWS && !window.confirm(`${t('Export')} ${filtered.length} ${t('rows to CSV?')}`)) return;
    const now = new Date();
    const filename = exportFilename(now);
    downloadCSVText(buildRegisterCsv(filtered, users, filterText, now), filename);
    setExportMessage(`${t('Exported')} ${filtered.length} ${t(filtered.length === 1 ? 'row' : 'rows')} ${t('to')} ${filename}.csv`);
  }

  const header = (key: SortKey, label: string, className = '') => {
    const active = sortKey === key;
    return (
      <th scope="col" className={`sortable ${className}`} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => sortBy(key)}>
          {t(label)} <span aria-hidden="true">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="panel register-panel">
      <div className="panel-head">
        <h2 id="bill-register" ref={headingRef} tabIndex={-1}>
          {t('Bill register')}
          {stage && <span className="register-scope"> · {t(STAGE_GLOSSARY.find(entry => entry.stage === stage)?.label ?? stage)}</span>}
        </h2>
        <div className="panel-actions">
          <button className="btn export-btn" type="button" onClick={exportCsv}>
            <span aria-hidden="true">↓ </span>{t('Export CSV')}<span className="sr-only"> ({filtered.length} {t('rows')})</span>
          </button>
          {!readOnly && <button className="btn primary" type="button" onClick={onAdd}>+ {t('Add bill')}</button>}
        </div>
      </div>
      <p className="export-status" role="status">{exportMessage}</p>

      <div className="saved-views" role="group" aria-label={t('Saved views')}>
        {SAVED_VIEWS.map(v => {
          const disabled = v.id === 'mine' && !currentUserId;
          return (
            <button
              key={v.id || 'all'}
              type="button"
              className={`view-chip${filters.view === v.id ? ' is-selected' : ''}`}
              aria-pressed={filters.view === v.id}
              disabled={disabled}
              title={disabled ? t('Sign in to see bills assigned to you') : undefined}
              onClick={() => update({ view: v.id })}
            >
              {t(v.label)}
            </button>
          );
        })}
      </div>

      <div className="filters">
        <label className="sr-only" htmlFor="bill-search">{t('Search bills')}</label>
        <input id="bill-search" type="search" placeholder={t('Search vendor, invoice no., E-file or status…')} value={filters.search} onChange={e => update({ search: e.target.value })} />
        <label className="sr-only" htmlFor="bill-vendor-filter">{t('Filter by vendor')}</label>
        <select id="bill-vendor-filter" value={filters.vendor} onChange={e => update({ vendor: e.target.value })}>
          <option value="">{t('All vendors')}</option>
          {vendors.map(vendor => <option key={vendor} value={vendor}>{vendor}</option>)}
        </select>
        <label className="sr-only" htmlFor="bill-stage-filter">{t('Filter by stage')}</label>
        <select id="bill-stage-filter" value={stage} onChange={e => onStageChange(e.target.value)}>
          <option value="">{t('All stages')}</option>
          {STAGE_GLOSSARY.map(s => <option key={s.stage} value={s.stage}>{t(s.label)}</option>)}
        </select>
        <label className="sr-only" htmlFor="bill-status-filter">{t('Filter by status')}</label>
        <select id="bill-status-filter" value={filters.cat} onChange={e => update({ cat: e.target.value as BillCategory | '' })}>
          <option value="">{t('All statuses')}</option>
          <option value="cleared">{t('Cleared')}</option>
          <option value="in_progress">{t('In progress')}</option>
          <option value="on_hold">{t('On hold')}</option>
        </select>
        {hasFilters && <button type="button" className="btn" onClick={clearAll}>{t('Clear filters')}</button>}
      </div>

      <div className="table-scroll bill-register-scroll">
        <table className="bill-register-table">
          <caption id={captionId} className="register-caption">
            {t('Showing')} {view.from}–{view.to} {t('of')} {view.total} {t(view.total === 1 ? 'bill' : 'bills')}
            {view.total !== bills.length && <> ({t('filtered from')} {bills.length})</>}
            {` · ${t('sorted by')} ${t({ vendor: 'Vendor', date: 'Invoice date', days: 'Days open', amount: 'Amount', stage: 'Stage' }[sortKey])}, ${t(sortDir === 'asc' ? 'ascending' : 'descending')}`}
          </caption>
          <colgroup>
            {['vendor', 'invoice', 'efile', 'date', 'days', 'amount', 'stage', 'entity', 'assignee', 'attribute', ...(readOnly ? [] : ['actions'])]
              .map(col => <col key={col} className={`bill-col-${col}`} />)}
          </colgroup>
          <thead>
            <tr>
              {header('vendor', 'Vendor')}
              <th scope="col">{t('Invoice no.')}</th>
              <th scope="col">{t('E-file no.')}</th>
              {header('date', 'Invoice date')}
              {header('days', 'Days open', 'num')}
              {header('amount', 'Amount', 'num')}
              {header('stage', 'Stage')}
              <th scope="col">{t('Program / District')}</th>
              <th scope="col">{t('Assigned person')}</th>
              <th scope="col">{t('Payment attribute')}</th>
              {!readOnly && <th scope="col"><span className="sr-only">{t('Actions')}</span></th>}
            </tr>
          </thead>
          <tbody>
            {view.rows.map(b => (
              <tr key={b.id} className="bill-register-row" onClick={() => setOpenBillId(b.id)}>
                <td className="vendor-cell">
                  <button type="button" className="link-btn row-open" onClick={event => { event.stopPropagation(); setOpenBillId(b.id); }}>
                    {b.vendor}<span className="sr-only"> · {t('open details')}</span>
                  </button>
                </td>
                <td className="inv-cell mono"><RecordedText value={b.invoice} /></td>
                <td className="mono">{b.efileNumber || '—'}</td>
                <td className="mono">{formatDate(b.date)}</td>
                <td className="num mono">
                  {b.cat === 'cleared' ? '—' : <DaysOpen days={b._days} />}
                  {isOverdue(b, overdueDays) && <><br /><OverdueFlag threshold={overdueDays} /></>}
                </td>
                <td className="num amt-cell mono"><Money value={billAmount(b)} /></td>
                <td className="bill-stage-cell"><StageChip bill={b} /><ReasonBadges bill={b} /></td>
                <td>{b.program || b.district || '—'}</td>
                <td>{users.find(user => user.id === b.assignedUserId)?.name || '—'}</td>
                <td className="status-cell"><span className="bill-attribute-value" title={b.attribute || undefined}><RecordedText value={b.attribute} /></span></td>
                {!readOnly && (
                  <td className="row-actions-cell" onClick={event => event.stopPropagation()}><div className="row-actions">
                    {b.bucket !== STAGES[STAGES.length - 1] && (
                      <button type="button" className="btn-icon" onClick={() => onNextStage(b)} title={t('Move to next stage')} aria-label={`${t('Move to next stage')}: ${billRef(b)}`}>⇢</button>
                    )}
                    {b.cat !== 'cleared' && (
                      <button type="button" className="btn-icon" onClick={() => onToggleHold(b)} title={t(b.cat === 'on_hold' ? 'Release hold' : 'Put on hold')} aria-label={`${t(b.cat === 'on_hold' ? 'Release hold' : 'Put on hold')}: ${billRef(b)}`}>{b.cat === 'on_hold' ? '▶' : 'Ⅱ'}</button>
                    )}
                    <button type="button" className="btn-icon" onClick={() => onEdit(b)} title={t('Edit bill')} aria-label={`${t('Edit bill')}: ${billRef(b)}`}>✎</button>
                  </div></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {view.total === 0 && (
          <div className="empty-state register-empty" role="status">
            <span className="empty-mark" aria-hidden="true">—</span>
            <span>
              <strong>{bills.length === 0 ? t('No bills have been added yet.') : t('No bills match these filters.')}</strong>
              <small>
                {bills.length === 0
                  ? (readOnly ? t('Bills will appear here once they are added.') : t('Use “Add bill” to start the register.'))
                  : `${t('Active filters')}: ${filterText.join('; ')}${globalQuery.trim() ? ` · ${t('Clear the global search box at the top to include all records.')}` : ''}`}
              </small>
            </span>
            {bills.length > 0 && <button type="button" className="btn" onClick={clearAll}>{t('Clear filters')}</button>}
          </div>
        )}
      </div>

      <div className="reg-foot">
        <nav className="pager" aria-label={t('Register pages')}>
          <button type="button" className="btn" onClick={() => setPage(view.page - 1)} disabled={view.page <= 1}>‹ {t('Previous')}</button>
          <span aria-live="polite">{t('Page')} {view.page} {t('of')} {view.pages}</span>
          <button type="button" className="btn" onClick={() => setPage(view.page + 1)} disabled={view.page >= view.pages}>{t('Next')} ›</button>
        </nav>
        <span>{t('Filtered total')}: <Money value={filtered.reduce((sum, b) => sum + billAmount(b), 0)} /></span>
      </div>

      {openBill && (
        <BillDrawer
          bill={openBill}
          users={users}
          overdueDays={overdueDays}
          readOnly={readOnly}
          onClose={() => setOpenBillId(null)}
          onEdit={bill => { setOpenBillId(null); onEdit(bill); }}
          onNextStage={onNextStage}
          onToggleHold={bill => { if (bill.cat !== 'on_hold') setOpenBillId(null); onToggleHold(bill); }}
        />
      )}
    </div>
  );
});

export default Register;
