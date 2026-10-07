import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import type { BudgetRow } from '../../types';
import { fmtIN, fmtShort, pct } from '../bills/utils';
import { useAppSettings } from '../../lib/appSettings';
import ExportActions from '../../components/ExportActions';

const BUDGET_CODE_ORDER = ['01', '06', '10', '11', '13', '14', '16', '17', '21', '24', '26', '27', '28', '31'];

export default function BudgetTab({ globalQuery = '', initialFiscalYear, readOnly = false }: { globalQuery?: string; initialFiscalYear?: string; readOnly?: boolean }) {
  const { t } = useAppSettings();
  const [budget, setBudget] = useState<any>(null);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [fiscalYear, setFiscalYear] = useState('FY 2026-27');
  const [pendingEdits, setPendingEdits] = useState<Map<string, Partial<BudgetRow>>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [refreshAfterEdits, setRefreshAfterEdits] = useState(false);

  useEffect(() => { load(); }, [fiscalYear]);
  useEffect(() => {
    const refreshBudget = () => {
      if (pendingEdits.size > 0) {
        setRefreshAfterEdits(true);
      } else {
        void load();
      }
    };
    window.addEventListener('budget:refresh', refreshBudget);
    return () => window.removeEventListener('budget:refresh', refreshBudget);
  }, [fiscalYear, pendingEdits.size]);
  useEffect(() => {
    if (initialFiscalYear && initialFiscalYear !== fiscalYear) setFiscalYear(initialFiscalYear);
  }, [initialFiscalYear]);

  useEffect(() => {
    if (pendingEdits.size > 0) {
      const handler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }
  }, [pendingEdits.size]);

  async function load() {
    const data = await apiClient.budget.get(fiscalYear);
    setBudget(data);
    setRows(data.rows || []);
  }

  const effectiveRows = useMemo(() => rows.map(row => ({
    ...row,
    ...pendingEdits.get(row.code),
  })), [rows, pendingEdits]);
  const searchTerms = globalQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const visibleRows = effectiveRows.filter(row => {
    const searchable = `${row.code} ${row.name} ${row.nameMr} ${row.fiscalYear} ${row.prov215} ${row.exp215} ${row.prov224} ${row.exp224} ${row.prov233} ${row.exp233}`.toLowerCase();
    return searchTerms.every(term => searchable.includes(term));
  });
  const rowsByCode = useMemo(() => new Map(visibleRows.map(row => [row.code, row])), [visibleRows]);

  function toggleBudgetGroup(group: string) {
    setCollapsedGroups(previous => {
      const next = new Set(previous);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  if (!budget) return <div className="panel"><p>{t('Loading budget data…')}</p></div>;

  const budgetHeads = new Map(
    (budget.budgetHeads || []).map((head: { code: string; name: string }) => [head.code, head.name]),
  );
  const headLabel = (code: string, fallback: string) => budgetHeads.get(code) || fallback;
  const budgetGroups = [
    { key: '215', label: 'A215' },
    { key: '224', label: 'A224' },
    { key: '233', label: 'A233' },
    { key: 'total', label: 'Total' },
  ];

  function getExportRows() {
    return visibleRows.map((r: BudgetRow) => ({
      Fiscal_Year: r.fiscalYear,
      Code: r.code,
      'Object head': r.name,
      '215_Provision': r.prov215,
      '215_Release': r.rel215,
      '215_Expenditure': r.exp215,
      '215_Balance': (r.rel215 || 0) - (r.exp215 || 0),
      '224_Provision': r.prov224,
      '224_Release': r.rel224,
      '224_Expenditure': r.exp224,
      '224_Balance': (r.rel224 || 0) - (r.exp224 || 0),
      '233_Provision': r.prov233,
      '233_Release': r.rel233,
      '233_Expenditure': r.exp233,
      '233_Balance': (r.rel233 || 0) - (r.exp233 || 0),
      'Total_Provision': (r.prov215 || 0) + (r.prov224 || 0) + (r.prov233 || 0),
      'Total_Release': (r.rel215 || 0) + (r.rel224 || 0) + (r.rel233 || 0),
      'Total_Expenditure': (r.exp215 || 0) + (r.exp224 || 0) + (r.exp233 || 0),
      'Total_Balance': (r.rel215 || 0) + (r.rel224 || 0) + (r.rel233 || 0) - (r.exp215 || 0) - (r.exp224 || 0) - (r.exp233 || 0),
    }));
  }

  const totals = effectiveRows.reduce((acc, r) => ({
    prov215: acc.prov215 + (r.prov215 || 0),
    exp215: acc.exp215 + (r.exp215 || 0),
    rel215: acc.rel215 + (r.rel215 || 0),
    prov224: acc.prov224 + (r.prov224 || 0),
    exp224: acc.exp224 + (r.exp224 || 0),
    rel224: acc.rel224 + (r.rel224 || 0),
    prov233: acc.prov233 + (r.prov233 || 0),
    exp233: acc.exp233 + (r.exp233 || 0),
    rel233: acc.rel233 + (r.rel233 || 0),
  }), { prov215: 0, exp215: 0, rel215: 0, prov224: 0, exp224: 0, rel224: 0, prov233: 0, exp233: 0, rel233: 0 });
  const grandProv = totals.prov215 + totals.prov224 + totals.prov233;
  const grandRelease = totals.rel215 + totals.rel224 + totals.rel233;
  const grandExp = totals.exp215 + totals.exp224 + totals.exp233;
  const grandBal = grandRelease - grandExp;

  type EditableBudgetField =
  | 'prov215'
  | 'exp215'
  | 'rel215'
  | 'prov224'
  | 'exp224'
  | 'rel224'
  | 'prov233'
  | 'exp233'
  | 'rel233';

function handleEdit(
  code: string,
  field: EditableBudgetField,
  value: number,
) {
  setSaveError('');
  setPendingEdits(prev => {
    const copy = new Map(prev);
    const existing = copy.get(code) || {};
    copy.set(code, { ...existing, [field]: value });
    return copy;
  });
}

async function handleSave() {
  if (pendingEdits.size === 0) return;
  setSaving(true);
  setSaveError('');
  try {
    for (const [code, edits] of pendingEdits) {
      await apiClient.budget.update(fiscalYear, code, edits);
    }
    await load();
    setPendingEdits(new Map());
    setRefreshAfterEdits(false);
  } catch (error) {
    setSaveError(error instanceof Error ? error.message : 'Could not save budget changes.');
  } finally {
    setSaving(false);
  }
}

function handleUndo() {
  setSaveError('');
  setPendingEdits(new Map());
  if (refreshAfterEdits) {
    setRefreshAfterEdits(false);
    void load();
  }
}

function cell(row: BudgetRow, field: EditableBudgetField, startsGroup = false) {
  const pending = pendingEdits.get(row.code)?.[field];
  const displayValue = pending ?? row[field] ?? 0;
  const labels: Record<EditableBudgetField, string> = {
    prov215: 'A215 Provision',
    exp215: 'A215 Expenditure',
    prov224: 'A224 Provision',
    exp224: 'A224 Expenditure',
    prov233: 'A233 Provision',
    exp233: 'A233 Expenditure',
    rel233: 'A233 Release',
    rel224: 'A224 Release',
    rel215: 'A215 Release',
  };
  return (
    <td
      data-label={labels[field]}
      data-budget-group={field.slice(-3)}
      className={`num mono${startsGroup ? ' budget-group-start' : ''} ${fiscalYear === 'FY Total' || readOnly ? '' : 'edit-cell'}`}
      contentEditable={!readOnly && fiscalYear !== 'FY Total'}
      suppressContentEditableWarning
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onBlur={e => {
        if (readOnly) return;
        const val = parseFloat(
          e.currentTarget.textContent?.replace(/[^\d.-]/g, '') || '0',
        );

        if (!isNaN(val)) {
          handleEdit(row.code, field, val);
        }
      }}
    >
      {fmtIN(displayValue)}
    </td>
  );
}

function collapsedSummary(
  group: string,
  expenditure: number,
  release: number,
  balance: number,
  label: string,
) {
  const utilization = release > 0 ? pct(expenditure, release) : null;
  const overRelease = expenditure > release;
  const status = utilization === null
    ? t(overRelease ? 'Over release' : 'No release')
    : `${utilization}%`;
  const progressWidth = utilization === null
    ? (overRelease ? 100 : 0)
    : Math.min(100, Math.max(0, utilization));
  return (
    <td
      data-budget-group={group}
      data-label={t(label)}
      className={`num budget-summary-cell budget-group-start${overRelease ? ' is-over-release' : ''}`}
    >
      <div className="budget-summary-content" title={`${fmtIN(expenditure)} ${t('spent')} ${t('of')} ${fmtIN(release)} ${t('released')}`}>
        <div className="budget-summary-amounts">
          <strong>{fmtShort(expenditure)} {t('spent')}</strong>
          <span className="budget-summary-percent">{status}</span>
        </div>
        <div className="budget-summary-release">
          {release > 0 ? `${t('of')} ${fmtShort(release)} ${t('released')}` : t('No release recorded')}
        </div>
        <div
          className="budget-utilization-track"
          role="img"
          aria-label={utilization === null ? status : `${utilization}% ${t('utilized')}`}
        >
          <span style={{ width: `${progressWidth}%` }} />
        </div>
        <div className="budget-summary-balance">{t('Balance')}: {fmtShort(balance)}</div>
      </div>
    </td>
  );
}

  return (
    <div className="tab-panel" id="tab-budget">
      {/* Budget stats */}
      <div className="stats" style={{whiteSpace: 'pre-line'}}>
        {[
          { lbl: `${t('Total approved budget')}\n(${fiscalYear})`, val: fmtShort(grandProv), sub: '3451-A215 + A224 + A233' },
          { lbl: 'Total expenditure to date\n\n', val: fmtShort(grandExp), sub: `${pct(grandExp, grandRelease)}% ${t('utilized')}` },
          { lbl: `A215 -\n${headLabel('A215','PMU establishment')}`, val: fmtShort(totals.prov215), sub: `${fmtShort(totals.exp215)} ${t('spent')} · ${pct(totals.exp215, totals.prov215)}%` },
          { lbl: `A224 -\n${headLabel('A224', 'IPF (World Bank)')}`, val: fmtShort(totals.prov224), sub: `${fmtShort(totals.exp224)} ${t('spent')} · ${pct(totals.exp224, totals.prov224)}%` },
          { lbl: `A233 -\n${headLabel('A233', 'PforR (state share)')}`, val: fmtShort(totals.prov233), sub: `${fmtShort(totals.exp233)} ${t('spent')} · ${pct(totals.exp233, totals.prov233)}%` },
          { lbl: 'Balance remaining\n\n', val: fmtShort(grandBal), sub: `${pct(grandBal, grandRelease)}% ${t('of release')}` },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="lbl">{t(s.lbl)}</div>
            <div className="val mono">{s.val}</div>
            <div className="sub">{t(s.sub)}</div>
          </div>
        ))}
      </div>

      {/* Budget table */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Approved budget vs. expenditure — object code wise')}</h2>
          <div className="panel-actions">
            <label className="note">
              <div className="field" style={{marginBottom: 0}}>
                <select
                  value={fiscalYear}
                  disabled={saving || pendingEdits.size > 0}
                  onChange={event => setFiscalYear(event.target.value)}
                >
                  {(budget.fiscalYears || [fiscalYear]).map((year: string) => (
                      <option key={year} value={year}>{year}</option>
                ))}
              </select></div>
            </label>
            {pendingEdits.size > 0 && (
              <>
                <button className="btn" onClick={handleUndo} disabled={saving}>↩ {t('Undo')}</button>
                <button className="btn primary" onClick={handleSave} disabled={saving}>
                  {saving ? t('Saving…') : `✓ ${t('Save')} (${pendingEdits.size})`}
                </button>
              </>
            )}
            <ExportActions getRows={getExportRows} filename={`budget-${fiscalYear}`} />
          </div>
        </div>
        {saveError && <p className="admin-error" role="alert">{saveError} {t('Your edits are still pending; correct the issue and retry.')}</p>}
        <p className="budget-table-help">
          {t('Use a funding-head control to switch between its four detail columns and a utilization summary. Utilization is expenditure divided by release.')}
        </p>
        <div className="budget-mobile-group-controls" aria-label={t('Budget column groups')}>
          {budgetGroups.map(group => {
            const collapsed = collapsedGroups.has(group.key);
            return (
              <button
                key={group.key}
                type="button"
                className="budget-mobile-group-toggle"
                onClick={() => toggleBudgetGroup(group.key)}
                aria-expanded={!collapsed}
              >
                <span>{t(group.label)}</span>
                <span>{collapsed ? t('Summary view') : t('Detail view')}</span>
              </button>
            );
          })}
        </div>
        <div className="table-scroll budget-table-scroll">
          <table
            className="budget-responsive-table budget-sticky-table"
            style={{
              minWidth: `${342 + budgetGroups.reduce(
                (width, group) => width + (collapsedGroups.has(group.key) ? 220 : 420),
                0,
              )}px`,
            }}
          >
            <thead>
              <tr>
                <th rowSpan={2} className="budget-code-heading">{t('Code')}</th>
                <th rowSpan={2} className="budget-object-heading">{t('Object head')}</th>
                {budgetGroups.map(group => {
                  const collapsed = collapsedGroups.has(group.key);
                  return (
                    <th
                      key={group.key}
                      colSpan={collapsed ? 1 : 4}
                      className={`budget-group-heading${group.key === 'total' ? ' budget-total-group' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBudgetGroup(group.key)}
                        aria-expanded={!collapsed}
                        aria-label={`${collapsed ? t('Expand') : t('Collapse')} ${t(group.label)}`}
                      >
                        <span className="budget-group-text">
                          <span className="budget-group-label">{t(group.label)}</span>
                          <span className="budget-group-state">
                            {collapsed ? t('Summary view') : t('4 detail columns')}
                          </span>
                        </span>
                        <span className="budget-group-toggle" aria-hidden="true">
                          {collapsed ? '+' : '−'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
              <tr>
                {budgetGroups.flatMap(group => {
                  const collapsed = collapsedGroups.has(group.key);
                  const labels = collapsed ? ['Utilization'] : ['Provision', 'Release', 'Expenditure', 'Balance'];
                  return labels.map((label, index) => (
                    <th
                      key={`${group.key}-${label}`}
                      data-budget-group={group.key}
                      className={`budget-sub-heading${index === 0 ? ' budget-group-start' : ''}${group.key === 'total' ? ' budget-total-sub-heading' : ''}`}
                    >
                      {t(label)}
                    </th>
                  ));
                })}
              </tr>
            </thead>

            <tbody>
              {BUDGET_CODE_ORDER.map(code => {
                const r = rowsByCode.get(code);
                if (!r) return null;
                const bal215 = (r.rel215 || 0) - (r.exp215 || 0);
                const bal224 = (r.rel224 || 0) - (r.exp224 || 0);
                const bal233 = (r.rel233 || 0) - (r.exp233 || 0);
                const totProv = (r.prov215 || 0) + (r.prov224 || 0) + (r.prov233 || 0);
                const totRel = (r.rel215 || 0) + (r.rel224 || 0) + (r.rel233 || 0);
                const totExp = (r.exp215 || 0) + (r.exp224 || 0) + (r.exp233 || 0);
                const rowBalance = totRel - totExp;
                return (
                  <tr key={r.code}>
                    <td className="mono" data-label={t('Code')}>{r.code}</td>
                    <td data-label={t('Object head')}>{r.objectHead.name}<br /><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{r.objectHead.nameMr}</span></td>
                    {collapsedGroups.has('215')
                      ? collapsedSummary('215', r.exp215 || 0, r.rel215 || 0, bal215, 'A215 utilization')
                      : <>{cell(r, 'prov215', true)}{cell(r, 'rel215')}{cell(r, 'exp215')}<td data-budget-group="215" className="num mono" data-label={t('A215 Balance')}>{fmtIN(bal215)}</td></>}
                    {collapsedGroups.has('224')
                      ? collapsedSummary('224', r.exp224 || 0, r.rel224 || 0, bal224, 'A224 utilization')
                      : <>{cell(r, 'prov224', true)}{cell(r, 'rel224')}{cell(r, 'exp224')}<td data-budget-group="224" className="num mono" data-label={t('A224 Balance')}>{fmtIN(bal224)}</td></>}
                    {collapsedGroups.has('233')
                      ? collapsedSummary('233', r.exp233 || 0, r.rel233 || 0, bal233, 'A233 utilization')
                      : <>{cell(r, 'prov233', true)}{cell(r, 'rel233')}{cell(r, 'exp233')}<td data-budget-group="233" className="num mono" data-label={t('A233 Balance')}>{fmtIN(bal233)}</td></>}
                    {collapsedGroups.has('total')
                      ? collapsedSummary('total', totExp, totRel, rowBalance, 'Total utilization')
                      : <>
                        <td data-budget-group="total" className="num amt-cell mono budget-group-start" data-label={t('Total provision')}>{fmtIN(totProv)}</td>
                        <td data-budget-group="total" className="num amt-cell mono" data-label={t('Total release')}>{fmtIN(totRel)}</td>
                        <td data-budget-group="total" className="num amt-cell mono" data-label={t('Total expenditure')}>{fmtIN(totExp)}</td>
                        <td data-budget-group="total" className="num amt-cell mono" data-label={t('Total balance')}>{fmtIN(rowBalance)}</td>
                      </>}
                  </tr>
                );
              })}
              <tr className="tot-row budget-total-row">
                <td data-label={t('Code')}></td><td data-label={t('Object head')}>{t('Total')}</td>
                {collapsedGroups.has('215')
                  ? collapsedSummary('215', totals.exp215, totals.rel215, totals.rel215 - totals.exp215, 'A215 utilization')
                  : <>
                    <td data-budget-group="215" className="num mono budget-group-start" data-label={t('A215 Provision')}>{fmtIN(totals.prov215)}</td>
                    <td data-budget-group="215" className="num mono" data-label={t('A215 Release')}>{fmtIN(totals.rel215)}</td>
                    <td data-budget-group="215" className="num mono" data-label={t('A215 Expenditure')}>{fmtIN(totals.exp215)}</td>
                    <td data-budget-group="215" className="num mono" data-label={t('A215 Balance')}>{fmtIN(totals.rel215 - totals.exp215)}</td>
                  </>}
                {collapsedGroups.has('224')
                  ? collapsedSummary('224', totals.exp224, totals.rel224, totals.rel224 - totals.exp224, 'A224 utilization')
                  : <>
                    <td data-budget-group="224" className="num mono budget-group-start" data-label={t('A224 Provision')}>{fmtIN(totals.prov224)}</td>
                    <td data-budget-group="224" className="num mono" data-label={t('A224 Release')}>{fmtIN(totals.rel224)}</td>
                    <td data-budget-group="224" className="num mono" data-label={t('A224 Expenditure')}>{fmtIN(totals.exp224)}</td>
                    <td data-budget-group="224" className="num mono" data-label={t('A224 Balance')}>{fmtIN(totals.rel224 - totals.exp224)}</td>
                  </>}
                {collapsedGroups.has('233')
                  ? collapsedSummary('233', totals.exp233, totals.rel233, totals.rel233 - totals.exp233, 'A233 utilization')
                  : <>
                    <td data-budget-group="233" className="num mono budget-group-start" data-label={t('A233 Provision')}>{fmtIN(totals.prov233)}</td>
                    <td data-budget-group="233" className="num mono" data-label={t('A233 Release')}>{fmtIN(totals.rel233)}</td>
                    <td data-budget-group="233" className="num mono" data-label={t('A233 Expenditure')}>{fmtIN(totals.exp233)}</td>
                    <td data-budget-group="233" className="num mono" data-label={t('A233 Balance')}>{fmtIN(totals.rel233 - totals.exp233)}</td>
                  </>}
                {collapsedGroups.has('total')
                  ? collapsedSummary('total', grandExp, grandRelease, grandBal, 'Total utilization')
                  : <>
                    <td data-budget-group="total" className="num mono budget-group-start" data-label={t('Total provision')}>{fmtIN(grandProv)}</td>
                    <td data-budget-group="total" className="num mono" data-label={t('Total release')}>{fmtIN(grandRelease)}</td>
                    <td data-budget-group="total" className="num mono" data-label={t('Total expenditure')}>{fmtIN(grandExp)}</td>
                    <td data-budget-group="total" className="num mono" data-label={t('Total balance')}>{fmtIN(grandBal)}</td>
                  </>}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>{t('3451A215 = PMU establishment · A224 = IPF (World Bank) · A233 = PforR (state share) — per the GoM Budget Head Creation GRs')}</span>
        </p>
      </div>

      {/* Cross-check */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Cross-check against bill register')}</h2>
          <span className="note">
            {fiscalYear === 'FY Total'
              ? t('Totals combine provisions, expenditures, and cleared bills across all fiscal years')
              : <>{t('only bills cleared')} <b>{t('in')} {fiscalYear}</b> {t("count toward this year's expenditure")}</>}
          </span>
        </div>
        <div className="stats n4">
          {[
            { lbl: fiscalYear === 'FY Total' ? t('Cleared across fiscal years') : `${t('Cleared in')} ${fiscalYear}`, val: fmtShort(budget.fyCrossCheck?.clearedFYAmt || 0), sub: `${budget.fyCrossCheck?.clearedFYCount || 0} ${t('bills')} ${t('from register')}`, cls: 'good' },
            { lbl: 'vs. EXPEND-sheet expenditure', val: fmtShort(grandExp), sub: 'from the object-code table above' },
            { lbl: 'Cleared in other FYs (excluded)', val: fmtShort(budget.fyCrossCheck?.otherFYAmt || 0), sub: budget.fyCrossCheck?.otherFYCount ? `${budget.fyCrossCheck.otherFYCount} ${t('bills')}` : 'none so far' },
            { lbl: 'Not yet cleared', val: budget.fyCrossCheck?.notCleared || 0, sub: 'still in the pipeline' },
          ].map((s, i) => (
            <div key={i} className="stat">
              <div className="lbl">{t(s.lbl)}</div>
              <div className="val mono">{s.val}</div>
              <div className={`sub ${s.cls || ''}`}>{t(s.sub)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
