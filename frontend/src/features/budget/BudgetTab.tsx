import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import type { BudgetRow } from '../../types';
import { fmtIN, fmtShort, pct } from '../bills/utils';
import { downloadCSV } from '../../lib/export';

const BUDGET_CODE_ORDER = ['01', '06', '10', '11', '13', '14', '16', '17', '21', '24', '26', '27', '28', '31'];

export default function BudgetTab() {
  const [budget, setBudget] = useState<any>(null);
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [fiscalYear, setFiscalYear] = useState('FY 2026-27');
  const [pendingEdits, setPendingEdits] = useState<Map<string, Partial<BudgetRow>>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [fiscalYear]);

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
  const rowsByCode = useMemo(
    () => new Map(effectiveRows.map(row => [row.code, row])),
    [effectiveRows],
  );

  if (!budget) return <div className="panel"><p>Loading budget data…</p></div>;

  const budgetHeads = new Map(
    (budget.budgetHeads || []).map((head: { code: string; name: string }) => [head.code, head.name]),
  );
  const headLabel = (code: string, fallback: string) => budgetHeads.get(code) || fallback;

  function handleExport() {
    const exportRows = effectiveRows.map((r: BudgetRow) => ({
      Code: r.code,
      'Object head': r.name,
      '215_Provision': r.prov215,
      '215_Expenditure': r.exp215,
      '215_Balance': (r.prov215 || 0) - (r.exp215 || 0),
      '224_Provision': r.prov224,
      '224_Expenditure': r.exp224,
      '224_Balance': (r.prov224 || 0) - (r.exp224 || 0),
      '233_Provision': r.prov233,
      '233_Expenditure': r.exp233,
      '233_Balance': (r.prov233 || 0) - (r.exp233 || 0),
      'Total_Provision': (r.prov215 || 0) + (r.prov224 || 0) + (r.prov233 || 0),
      'Total_Expenditure': (r.exp215 || 0) + (r.exp224 || 0) + (r.exp233 || 0),
    }));
    downloadCSV(exportRows, `budget-${fiscalYear}`);
  }

  const totals = effectiveRows.reduce((acc, r) => ({
    prov215: acc.prov215 + (r.prov215 || 0),
    exp215: acc.exp215 + (r.exp215 || 0),
    prov224: acc.prov224 + (r.prov224 || 0),
    exp224: acc.exp224 + (r.exp224 || 0),
    prov233: acc.prov233 + (r.prov233 || 0),
    exp233: acc.exp233 + (r.exp233 || 0),
  }), { prov215: 0, exp215: 0, prov224: 0, exp224: 0, prov233: 0, exp233: 0 });
  const grandProv = totals.prov215 + totals.prov224 + totals.prov233;
  const grandExp = totals.exp215 + totals.exp224 + totals.exp233;

  type EditableBudgetField =
  | 'prov215'
  | 'exp215'
  | 'prov224'
  | 'exp224'
  | 'prov233'
  | 'exp233';

function handleEdit(
  code: string,
  field: EditableBudgetField,
  value: number,
) {
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
  try {
    for (const [code, edits] of pendingEdits) {
      await apiClient.budget.update(fiscalYear, code, edits);
    }
    await load();
    setPendingEdits(new Map());
  } finally {
    setSaving(false);
  }
}

function handleUndo() {
  setPendingEdits(new Map());
}

function cell(row: BudgetRow, field: EditableBudgetField) {
  const pending = pendingEdits.get(row.code)?.[field];
  const displayValue = pending ?? row[field] ?? 0;
  return (
    <td
      className="num mono edit-cell"
      contentEditable
      suppressContentEditableWarning
      onBlur={e => {
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

  return (
    <div className="tab-panel" id="tab-budget">
      {/* Budget stats */}
      <div className="stats">
        {[
          { lbl: `Total approved budget (${fiscalYear})`, val: fmtShort(grandProv), sub: '3451-A215 + A224 + A233' },
          { lbl: 'Total expenditure to date', val: fmtShort(grandExp), sub: `${pct(grandExp, grandProv)}% utilized` },
          { lbl: `3451-${headLabel('A215', 'PMU establishment')}`, val: fmtShort(totals.prov215), sub: `${fmtShort(totals.exp215)} spent · ${pct(totals.exp215, totals.prov215)}%` },
          { lbl: `3451-${headLabel('A224', 'IPF (World Bank)')}`, val: fmtShort(totals.prov224), sub: `${fmtShort(totals.exp224)} spent · ${pct(totals.exp224, totals.prov224)}%` },
          { lbl: `3451-${headLabel('A233', 'PforR (state share)')}`, val: fmtShort(totals.prov233), sub: `${fmtShort(totals.exp233)} spent · ${pct(totals.exp233, totals.prov233)}%` },
          { lbl: 'Balance remaining', val: fmtShort(grandProv - grandExp), sub: `${pct(grandProv - grandExp, grandProv)}% of budget` },
        ].map((s, i) => (
          <div key={i} className="stat">
            <div className="lbl">{s.lbl}</div>
            <div className="val mono">{s.val}</div>
            <div className="sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Budget table */}
      <div className="panel">
        <div className="panel-head">
          <h2>Approved budget vs. expenditure — object code wise</h2>
          <div className="panel-actions">
            <label className="note">
              Fiscal year{' '}
              <select
                value={fiscalYear}
                disabled={saving || pendingEdits.size > 0}
                onChange={event => setFiscalYear(event.target.value)}
              >
                {(budget.fiscalYears || [fiscalYear]).map((year: string) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
            {pendingEdits.size > 0 && (
              <>
                <button className="btn" onClick={handleUndo} disabled={saving}>↩ Undo</button>
                <button className="btn primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : `✓ Save (${pendingEdits.size})`}
                </button>
              </>
            )}
            <button className="btn export-btn" onClick={handleExport}>↓ Export CSV</button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Object head</th>
                <th className="num">215 Provision</th><th className="num">215 Expenditure</th><th className="num">215 Balance</th>
                <th className="num">224 Provision</th><th className="num">224 Expenditure</th><th className="num">224 Balance</th>
                <th className="num">233 Provision</th><th className="num">233 Expenditure</th><th className="num">233 Balance</th>
                <th className="num">Total provision</th><th className="num">Total expenditure</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_CODE_ORDER.map(code => {
                const r = rowsByCode.get(code);
                if (!r) return null;
                const bal215 = (r.prov215 || 0) - (r.exp215 || 0);
                const bal224 = (r.prov224 || 0) - (r.exp224 || 0);
                const bal233 = (r.prov233 || 0) - (r.exp233 || 0);
                const totProv = (r.prov215 || 0) + (r.prov224 || 0) + (r.prov233 || 0);
                const totExp = (r.exp215 || 0) + (r.exp224 || 0) + (r.exp233 || 0);
                return (
                  <tr key={r.code}>
                    <td className="mono">{r.code}</td>
                    <td>{r.objectHead.name}<br /><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{r.objectHead.nameMr}</span></td>
                    {cell(r, 'prov215')}{cell(r, 'exp215')}<td className="num mono">{fmtIN(bal215)}</td>
                    {cell(r, 'prov224')}{cell(r, 'exp224')}<td className="num mono">{fmtIN(bal224)}</td>
                    {cell(r, 'prov233')}{cell(r, 'exp233')}<td className="num mono">{fmtIN(bal233)}</td>
                    <td className="num amt-cell mono">{fmtIN(totProv)}</td>
                    <td className="num amt-cell mono">{fmtIN(totExp)}</td>
                  </tr>
                );
              })}
              <tr className="tot-row">
                <td></td><td>Total</td>
                <td className="num mono">{fmtIN(totals.prov215)}</td>
                <td className="num mono">{fmtIN(totals.exp215)}</td>
                <td className="num mono">{fmtIN(totals.prov215 - totals.exp215)}</td>
                <td className="num mono">{fmtIN(totals.prov224)}</td>
                <td className="num mono">{fmtIN(totals.exp224)}</td>
                <td className="num mono">{fmtIN(totals.prov224 - totals.exp224)}</td>
                <td className="num mono">{fmtIN(totals.prov233)}</td>
                <td className="num mono">{fmtIN(totals.exp233)}</td>
                <td className="num mono">{fmtIN(totals.prov233 - totals.exp233)}</td>
                <td className="num mono">{fmtIN(grandProv)}</td>
                <td className="num mono">{fmtIN(grandExp)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="reg-foot" style={{ marginTop: 10 }}>
          <span>3451A215 = PMU establishment · A224 = IPF (World Bank) · A233 = PforR (state share) — per the GoM Budget Head Creation GRs</span>
        </p>
      </div>

      {/* Cross-check */}
      <div className="panel">
        <div className="panel-head">
          <h2>Cross-check against bill register</h2>
          <span className="note">only bills cleared <b>in {fiscalYear}</b> count toward this year's expenditure</span>
        </div>
        <div className="stats n4">
          {[
            { lbl: 'Cleared in FY 2026-27 (counted)', val: fmtShort(budget.fyCrossCheck?.clearedFYAmt || 0), sub: `${budget.fyCrossCheck?.clearedFYCount || 0} bills from register`, cls: 'good' },
            { lbl: 'vs. EXPEND-sheet expenditure', val: fmtShort(grandExp), sub: 'from the object-code table above' },
            { lbl: 'Cleared in other FYs (excluded)', val: fmtShort(budget.fyCrossCheck?.otherFYAmt || 0), sub: budget.fyCrossCheck?.otherFYCount ? `${budget.fyCrossCheck.otherFYCount} bills` : 'none so far' },
            { lbl: 'Not yet cleared', val: budget.fyCrossCheck?.notCleared || 0, sub: 'still in the pipeline' },
          ].map((s, i) => (
            <div key={i} className="stat">
              <div className="lbl">{s.lbl}</div>
              <div className="val mono">{s.val}</div>
              <div className={`sub ${s.cls || ''}`}>{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
