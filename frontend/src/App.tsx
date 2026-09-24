import { useState } from 'react';
import BillsTab from './features/bills/BillsTab';
import BudgetTab from './features/budget/BudgetTab';
import TransfersTab from './features/transfers/TransfersTab';

type Tab = 'bills' | 'budget' | 'transfers';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('bills');

  return (
    <div className="wrap">
      <header>
        <div>
          <p className="eyebrow">
            MahaSTRIDE · MITRA{' '}
            <span className="sync-pill live">
              <span className="sdot" />
              <span>live</span>
            </span>
          </p>
          <h1>Bill & Budget Tracker</h1>
          <p className="header-meta">
            Editable tracker — bill clearance pipeline, FY 2026-27 budget by object code, and agency fund transfers
          </p>
        </div>
      </header>

      <nav className="tabs">
        <button data-tab="bills" className={activeTab === 'bills' ? 'active' : ''} onClick={() => setActiveTab('bills')}>
          Bills pipeline
        </button>
        <button data-tab="budget" className={activeTab === 'budget' ? 'active' : ''} onClick={() => setActiveTab('budget')}>
          Budget FY 2026-27
        </button>
        <button data-tab="transfers" className={activeTab === 'transfers' ? 'active' : ''} onClick={() => setActiveTab('transfers')}>
          Fund transfers
        </button>
      </nav>

      {activeTab === 'bills' && <BillsTab />}
      {activeTab === 'budget' && <BudgetTab />}
      {activeTab === 'transfers' && <TransfersTab />}

      <footer>
        <b>How to read this:</b> bill stage is inferred from free-text status entries (yours or the source tracker's). Editing a bill's status here recomputes its pipeline stage automatically using the same rule the dashboard was built with.
        Budget figures are from the STATUS workbook's EXPEND sheet (FY 2026-27, as on 6 Aug 2026) — edit expenditure cells as fresh BEAMS figures come in. A cleared bill with a budget code and object head automatically adjusts the matching budget expenditure; changing or deleting it reverses that adjustment. A cleared bill linked to a transfer similarly adjusts transfer utilization.
        A bill's "Cleared FY" is read from the clearance date inside its status text (e.g. "Bill Passed 07.07.2026") — only FY 2026-27 clearances are counted in this year's budget cross-check. District Incentive Fund rows list all 36 districts with the fund's design brackets; no disbursement records exist yet, so amounts start blank.
      </footer>
    </div>
  );
}
