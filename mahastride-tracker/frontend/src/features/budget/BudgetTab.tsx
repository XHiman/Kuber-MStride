import { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';
import type { BudgetRow } from '../../types';
import { fmtIN, fmtShort, pct } from '../bills/utils';

const BUDGET_CODE_ORDER = ['01', '06', '10', '11', '13', '14', '16', '17', '21', '24', '26', '27', '28', '31'];

export default function BudgetTab() {
  const [budget, setBudget] = useState<any>(null);
  const [rows, setRows] = useState<BudgetRow[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await apiClient.budget.get();
    setBudget(data);
    setRows(data.rows || []);
  }

  if (!budget) return <div className="panel"><p>Loading budget data…</p></div>;

  const totals = budget.totals;
  const grandProv = budget.grandProv;
  const grandExp = budget.grandExp;

  type EditableBudgetField =
  | 'prov215'
  | 'exp215'
  | 'prov224'
  | 'exp224'
  | 'prov233'
  | 'exp233';

async function handleEdit(
  code: string,
  field: EditableBudgetField,
  value: number,
) {
  await apiClient.budget.update(code, { [field]: value });
  load();
}

function cell(row: BudgetRow, field: EditableBudgetField) {
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
      {fmtIN(row[field] || 0)}
    </td>
  );
}

  return (
    <div className="tab-panel" id="tab-budget">
      {/* Budget stats */}
      <div className="stats">
        {[
          { lbl: 'Total approved budget (FY26-27)', val: fmtShort(grandProv), sub: '3451-A215 + A224 + A233' },
          { lbl: 'Total expenditure to date', val: fmtShort(grandExp), sub: `${pct(grandExp, grandProv)}% utilized` },
          { lbl: '3451-A215 (PMU establishment)', val: fmtShort(totals.prov215), sub: `${fmtShort(totals.exp215)} spent · ${pct(totals.exp215, totals.prov215)}%` },
          { lbl: '3451-A224 (IPF)', val: fmtShort(totals.prov224), sub: `${fmtShort(totals.exp224)} spent · ${pct(totals.exp224, totals.prov224)}%` },
          { lbl: '3451-A233 (PforR)', val: fmtShort(totals.prov233), sub: `${fmtShort(totals.exp233)} spent · ${pct(totals.exp233, totals.prov233)}%` },
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
          <span className="note">FY 2026-27 · budget heads 3451-A215 / A224 / A233 · figures in ₹ · click a number to edit</span>
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
                const r = rows.find(b => b.code === code);
                if (!r) return null;
                const bal215 = (r.prov215 || 0) - (r.exp215 || 0);
                const bal224 = (r.prov224 || 0) - (r.exp224 || 0);
                const bal233 = (r.prov233 || 0) - (r.exp233 || 0);
                const totProv = (r.prov215 || 0) + (r.prov224 || 0) + (r.prov233 || 0);
                const totExp = (r.exp215 || 0) + (r.exp224 || 0) + (r.exp233 || 0);
                return (
                  <tr key={r.code}>
                    <td className="mono">{r.code}</td>
                    <td>{r.name}<br /><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{r.nameMr}</span></td>
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
          <span className="note">only bills cleared <b>in FY 2026-27</b> count toward this year's expenditure — FY 2025-26 clearances are tracked but excluded</span>
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
