import { useState, useEffect, useMemo, useRef } from 'react';
import { apiClient } from '../../lib/api';
import { STAGES, type Bill } from '../../types';
import { fmtShort, pct } from '../../lib/format';
import { AsOf, Money } from '../../components/Money';
import { useAppSettings } from '../../lib/appSettings';
import ProgramDistrictField, { type ProgramDistrictType } from '../../components/ProgramDistrictField';
import { GlossaryButton, StageIcon, StageTerm } from '../../components/StatusGlossary';
import { STAGE_GLOSSARY, STAGE_SLUGS, movesInMonth, plural, stageFromSlug, stageLabel } from '../../lib/status';
import { DEFAULT_OVERDUE_DAYS, parseThreshold } from '../../lib/aging';
import AgingPanel from './AgingPanel';
import NeedsActionPanel from './NeedsActionPanel';
import Register from './Register';
import ChangeNoteDialog from '../../components/ChangeNoteDialog';
import { LoadError, Skeleton } from '../../components/LoadState';
import { useToast } from '../../components/Toast';
import { research } from '../../lib/research';
import { billRef } from './shared';
import VendorChart from './VendorChart';

export default function BillsTab({ globalQuery = '', readOnly = false, currentUserId = null, refreshKey = 0, onLoaded }: {
  globalQuery?: string;
  readOnly?: boolean;
  currentUserId?: string | null;
  refreshKey?: number;
  /** Reports data freshness to the page header. */
  onLoaded?: (status: { lastChange: Date | null; loadedAt: Date }) => void;
}) {
  const { t } = useAppSettings();
  const toast = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [users, setUsers] = useState<import('../../types').UserProfile[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  // ?stage=tfc deep-links the register to one stage; kept in sync below.
  const [stageFilter, setStageFilter] = useState(() => stageFromSlug(new URLSearchParams(window.location.search).get('stage')));
  const registerRef = useRef<HTMLHeadingElement>(null);
  const [monthMoves, setMonthMoves] = useState(0);
  const [overdueDays, setOverdueDays] = useState(() => {
    try { return parseThreshold(localStorage.getItem('mitra-overdue-days') ?? DEFAULT_OVERDUE_DAYS); } catch { return DEFAULT_OVERDUE_DAYS; }
  });
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [pendingChange, setPendingChange] = useState<{ kind: 'next'; bill: Bill; to: string } | { kind: 'release'; bill: Bill } | null>(null);

  useEffect(() => { load(); }, [refreshKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (stageFilter) url.searchParams.set('stage', STAGE_SLUGS[stageFilter]);
    else url.searchParams.delete('stage');
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
  }, [stageFilter]);

  function showStage(stage: string) {
    setStageFilter(stage);
    if (!stage) return;
    registerRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    registerRef.current?.focus({ preventScroll: true });
  }

  async function load() {
    setLoadState('loading');
    let billsData: Bill[], dash: any, people: import('../../types').UserProfile[];
    try {
      [billsData, dash, people] = await Promise.all([apiClient.bills.list(), apiClient.bills.dashboard(), apiClient.users.list()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load the data';
      setLoadError(message);
      setLoadState('error');
      research.track('error', 'bills', { kind: 'load' });
      // With data already on screen, keep it and report the failed refresh instead of blanking the page.
      if (dashboard) toast(`${t('Could not refresh bills')}: ${t(message)}`, { kind: 'error', action: { label: t('Retry'), onAction: load } });
      return;
    }
    setLoadState('ready');
    setBills(billsData);
    setMonthMoves(Object.values(movesInMonth(billsData)).reduce((sum, n) => sum + n, 0));
    setDashboard(dash);
    const now = new Date();
    setLoadedAt(now);
    setUsers(people);
    onLoaded?.({ lastChange: latestChange(billsData), loadedAt: now });
  }

  function changeOverdueDays(days: number) {
    setOverdueDays(days);
    try { localStorage.setItem('mitra-overdue-days', String(days)); } catch { /* storage unavailable; keep in memory */ }
  }

  /** Runs a change, reloads, and offers a 10-second Undo that restores the previous values (history keeps both). */
  async function changeWithUndo(bill: Bill, change: Partial<Bill> & { changeNote?: string }, undo: Partial<Bill>, message: string) {
    await apiClient.bills.update(bill.id, change);
    await load();
    toast(message, {
      action: {
        label: t('Undo'),
        onAction: async () => {
          try {
            await apiClient.bills.update(bill.id, { ...undo, changeNote: t('Undo of previous change') });
            await load();
            toast(t('Change undone'), { kind: 'info' });
          } catch (error) {
            research.track('error', 'bills', { kind: 'undo' });
            toast(error instanceof Error ? t(error.message) : t('Could not undo the change.'), { kind: 'error' });
          }
        },
      },
    });
  }

  async function handleAssign(bill: Bill, assignedUserId: string | null) {
    try {
      const name = users.find(user => user.id === assignedUserId)?.name;
      await changeWithUndo(bill, { assignedUserId }, { assignedUserId: bill.assignedUserId },
        name ? `${billRef(bill)} ${t('assigned to')} ${name}` : `${billRef(bill)} ${t('unassigned')}`);
    } catch (error) {
      research.track('error', 'bills', { kind: 'assign' });
      toast(error instanceof Error ? t(error.message) : t('Could not assign the bill.'), { kind: 'error' });
    }
  }

  // Stage moves and hold releases are confirmed in a dialog that asks why (recorded in the audit trail).
  function handleNextStage(bill: Bill) {
    const currentIndex = STAGES.indexOf(bill.bucket);
    if (currentIndex < 0 || currentIndex >= STAGES.length - 1) return;
    setPendingChange({ kind: 'next', bill, to: STAGES[currentIndex + 1] });
  }

  function handleHoldToggle(bill: Bill) {
    if (bill.cat !== 'on_hold') {
      setEditingBill({ ...bill, onHold: true, holdReason: '' });
      setShowModal(true);
      return;
    }
    setPendingChange({ kind: 'release', bill });
  }

  async function confirmChange(note: string) {
    if (!pendingChange) return;
    const { bill } = pendingChange;
    const changeNote = note || undefined;
    if (pendingChange.kind === 'next') {
      await changeWithUndo(bill, { bucket: pendingChange.to, changeNote }, { bucket: bill.bucket },
        `${billRef(bill)} ${t('moved to')} ${t(stageLabel(pendingChange.to))}`);
    } else {
      await changeWithUndo(bill, { onHold: false, holdReason: null, changeNote }, { onHold: true, holdReason: bill.holdReason },
        `${t('Hold released on')} ${billRef(bill)}`);
    }
    setPendingChange(null);
  }

  async function handleSave(data: Partial<Bill> & { changeNote?: string }) {
    if (editingBill?.id && editingBill.cat !== 'on_hold' && data.onHold) {
      // Putting a bill on hold is a status change: offer Undo like the other quick actions.
      await changeWithUndo(editingBill, data, { onHold: false, holdReason: null }, `${billRef(editingBill)} ${t('put on hold')}`);
    } else if (editingBill?.id) {
      await apiClient.bills.update(editingBill.id, data);
      await load();
      toast(`${t('Saved changes to')} ${billRef(editingBill)}`);
    } else {
      await apiClient.bills.create(data);
      await load();
      toast(t('Bill added to the register'));
    }
    setShowModal(false);
  }

  if (!dashboard && loadState === 'loading') return <Skeleton />;
  if (!dashboard && loadState === 'error') return <LoadError message={loadError} onRetry={() => void load()} />;

  return (
    <div className="tab-panel" id="tab-bills" aria-busy={loadState === 'loading'}>
      {/* Process strip */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Bill clearance process')}</h2>
          <span className="note">{t('six checkpoints tracked below, in order')} · <GlossaryButton /></span>
        </div>
        <ProcessStrip />
      </div>

      {/* Stats */}
      {dashboard?.stages && <StatStrip dashboard={dashboard} asOf={loadedAt} />}

      {/* Pipeline stages */}
      <div className="panel">
        <div className="panel-head">
          <h2>{t('Bills by pipeline stage')}</h2>
          <span className="note">
            {t('value currently at each stage, not cumulative')} · {monthMoves
              ? `${monthMoves} ${t(plural(monthMoves, 'bill'))} ${t('moved stage this month')}`
              : t('no stage moves recorded this month')} · <AsOf at={loadedAt} />
          </span>
        </div>
        <StageRow dashboard={dashboard} bills={bills} activeStage={stageFilter} onSelect={showStage} />
      </div>

      {/* Vendor + Exceptions */}
      <div className="grid-2">
        <VendorChart bills={bills} asOf={loadedAt} />
        <NeedsActionPanel
          bills={bills}
          users={users}
          asOf={loadedAt}
          threshold={overdueDays}
          readOnly={readOnly}
          onEdit={bill => { setEditingBill(bill); setShowModal(true); }}
          onAssign={handleAssign}
          onResolveHold={handleHoldToggle}
        />
      </div>

      {/* Aging */}
      <AgingPanel
        bills={bills}
        asOf={loadedAt}
        threshold={overdueDays}
        onThresholdChange={changeOverdueDays}
        onOpen={bill => { setEditingBill(bill); setShowModal(true); }}
        readOnly={readOnly}
      />

      {/* Full register */}
      <Register
        ref={registerRef}
        bills={bills}
        users={users}
        currentUserId={currentUserId}
        readOnly={readOnly}
        overdueDays={overdueDays}
        globalQuery={globalQuery}
        stage={stageFilter}
        onStageChange={setStageFilter}
        onAdd={() => { setEditingBill(null); setShowModal(true); }}
        onEdit={bill => { setEditingBill(bill); setShowModal(true); }}
        onNextStage={bill => void handleNextStage(bill)}
        onToggleHold={bill => void handleHoldToggle(bill)}
      />

      {pendingChange && (
        <ChangeNoteDialog
          title={t(pendingChange.kind === 'next' ? 'Move to next stage' : 'Release hold')}
          description={pendingChange.kind === 'next'
            ? `${billRef(pendingChange.bill)}: ${t(stageLabel(pendingChange.bill.bucket))} → ${t(stageLabel(pendingChange.to))}`
            : `${billRef(pendingChange.bill)}: ${t('the bill returns to normal processing at')} ${t(stageLabel(pendingChange.bill.bucket))}`}
          confirmLabel={t(pendingChange.kind === 'next' ? 'Move bill' : 'Release hold')}
          onConfirm={confirmChange}
          onCancel={() => setPendingChange(null)}
        />
      )}
      {showModal && <BillModal key={editingBill?.id ?? 'new'} bill={editingBill} onSave={handleSave} onClose={() => setShowModal(false)} />}
    </div>
  );
}

/** Most recent change to any bill record (its updatedAt, or its latest history entry). */
function latestChange(bills: Bill[]): Date | null {
  let latest = 0;
  for (const bill of bills) {
    for (const value of [bill.updatedAt, ...(bill.stageHistory ?? []).map(entry => entry.enteredAt)]) {
      const time = value ? Date.parse(value) : NaN;
      if (!Number.isNaN(time) && time > latest) latest = time;
    }
  }
  return latest ? new Date(latest) : null;
}

function ProcessStrip() {
  return (
    <div className="process-strip">
      {STAGE_GLOSSARY.map((entry, i) => (
        <span key={entry.stage} className="p-step">
          <span className="dot" style={{ background: `var(--stage-${i + 1})` }} aria-hidden="true" />
          <StageTerm stage={entry.stage} index={i} />
        </span>
      ))}
    </div>
  );
}

function StatStrip({ dashboard, asOf }: { dashboard: any; asOf: Date | null }) {
  const { t } = useAppSettings();
  const total = dashboard.total;
  const clearedAmt = dashboard.cleared.amount;
  const inProgAmt = dashboard.inProgress.amount;
  const onHoldAmt = dashboard.onHold.amount;
  const sgs = dashboard?.stages ?? {};
  const midPipeline = (sgs['TFC Committee Approval']?.amount || 0) + (sgs['File Approval Pending']?.amount || 0);
  const billCount = dashboard.cleared.count + dashboard.inProgress.count + dashboard.onHold.count;
  const bills = (n: number) => `${n} ${t(plural(n, 'bill'))}`;
  const oldest = dashboard.oldestPending;

  return (
    <section className="stats-group" aria-label={t('Bill totals')}>
    <div className="stats">
      {[
        { lbl: 'Total invoice value', val: <Money value={total} />, sub: bills(billCount) },
        { lbl: 'Cleared by treasury', val: <Money value={clearedAmt} />, sub: `${pct(clearedAmt, total)}% ${t('of total')} · ${bills(dashboard.cleared.count)}`, cls: 'good' },
        { lbl: 'In pipeline', val: <Money value={inProgAmt} />, sub: `${pct(inProgAmt, total)}% ${t('of total')} · ${bills(dashboard.inProgress.count)}` },
        { lbl: 'On hold / exception', val: <Money value={onHoldAmt} />, sub: `${bills(dashboard.onHold.count)} ${t('on hold')}`, cls: dashboard.onHold.count ? 'crit' : '' },
        { lbl: 'Committee-approved, awaiting next step', val: <Money value={midPipeline} />, sub: t('TFC approval + file approval pending; not yet at treasury') },
        { lbl: 'Oldest open bill', val: oldest ? `${oldest.days} ${t(plural(oldest.days, 'day'))}` : '—', sub: oldest ? `${oldest.vendor} · ${fmtShort(oldest.amount)} · ${t('excludes on-hold bills')}` : '' },
      ].map((s, i) => (
        <div key={i} className="stat">
          <div className="lbl">{t(s.lbl)}</div>
          <div className="val mono">{s.val}</div>
          <div className={`sub ${s.cls || ''}`}>{s.sub}</div>
        </div>
      ))}
    </div>
    <p className="as-of-row"><AsOf at={asOf} /> · {t('percentages are of total invoice value')}</p>
    </section>
  );
}

function StageRow({ dashboard, bills, activeStage, onSelect }: { dashboard: any; bills: Bill[]; activeStage: string; onSelect: (stage: string) => void }) {
  const { t } = useAppSettings();
  const sgs = dashboard?.stages ?? {};
  const maxAmt = Math.max(...STAGE_GLOSSARY.map(s => sgs[s.stage]?.amount || 0), 1);
  const moves = useMemo(() => movesInMonth(bills), [bills]);

  return (
    <ol className="stage-row stage-flow">
      {STAGE_GLOSSARY.map((s, i) => {
        const a = sgs[s.stage] ?? { amount: 0, count: 0, onHold: 0 };
        const pctW = Math.max(a.amount ? 4 : 0, Math.round(a.amount / maxAmt * 100));
        const active = activeStage === s.stage;
        const moved = moves[s.stage] ?? 0;
        return (
          <li key={s.stage} className="stage-step">
            <a
              href={`?stage=${STAGE_SLUGS[s.stage]}`}
              className={`stage-card${a.count ? '' : ' is-empty'}${active ? ' is-active' : ''}`}
              aria-current={active ? 'true' : undefined}
              onClick={event => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                onSelect(active ? '' : s.stage);
              }}
            >
              <span className="stop-row">
                <span className="snum" style={{ color: `var(--stage-${i + 1}-text)` }}><StageIcon stage={s.stage} /> {t('STAGE')} {i + 1}</span>
                {a.onHold > 0 && <span className="flag"><span aria-hidden="true">⚠ </span>{t('needs attention')}</span>}
              </span>
              <span className="sname">{t(s.label)}</span>
              {a.count > 0
                ? <>
                  <span className="samt mono"><Money value={a.amount} /></span>
                  <span className="scount">{a.count} {t(plural(a.count, 'bill'))} {t('currently here')}{a.onHold ? ` · ${a.onHold} ${t('on hold')}` : ''}</span>
                </>
                : <span className="scount">0 {t('bills')}, ₹0</span>}
              {moved > 0 && <span className="smoved">↗ {moved} {t('moved in this month')}</span>}
              <div className="stage-bar-track" aria-hidden="true">
                <div className="stage-bar-fill" style={{ width: `${pctW}%`, background: `var(--stage-${i + 1})` }} />
              </div>
              <span className="stage-card-cta">{t(active ? 'Showing in register · clear' : 'Show in register')} <span aria-hidden="true">→</span></span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}











function BillModal({ bill, onSave, onClose }: { bill: Bill | null; onSave: (data: Partial<Bill> & { changeNote?: string }) => Promise<void>; onClose: () => void }) {
  const { t } = useAppSettings();
  const dialogRef = useRef<HTMLFormElement>(null);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [users, setUsers] = useState<import('../../types').UserProfile[]>([]);
  const [districts, setDistricts] = useState<import('../../types').District[]>([]);
  const [entityType, setEntityType] = useState<ProgramDistrictType>(bill?.district ? 'district' : 'program');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [changeNote, setChangeNote] = useState('');
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
        changeNote: changeNote.trim() || undefined,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? t(error.message) : t('Failed to save bill. Please try again.'));
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
          <div className="field bill-field-wide">
            <label htmlFor="bill-change-note">{t('Reason for change')} <span className="note">({t('optional, saved in the bill history when the stage or hold changes')})</span></label>
            <textarea id="bill-change-note" maxLength={500} value={changeNote} onChange={event => setChangeNote(event.target.value)} />
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




