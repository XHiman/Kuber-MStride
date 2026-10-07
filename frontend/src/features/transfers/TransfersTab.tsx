import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../lib/api';
import { FISCAL_YEARS, type Transfer, type District, type UserProfile } from '../../types';
import { fmtIN, fmtShort } from '../bills/utils';
import { useAppSettings } from '../../lib/appSettings';
import ExportActions from '../../components/ExportActions';
import ProgramDistrictField, { type ProgramDistrictType } from '../../components/ProgramDistrictField';

type DistrictFund = NonNullable<Transfer['districtFund']>;

const DISTRICT_BUDGET_MAPPING: Record<DistrictFund, { budgetCode: string; objectCode: string }> = {
  incentive_funds: { budgetCode: 'A233', objectCode: '10' },
  consultants_grant: { budgetCode: 'A233', objectCode: '10' },
};

export default function TransfersTab({ globalQuery = '', readOnly = false }: { globalQuery?: string; readOnly?: boolean }) {
  const { t } = useAppSettings();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transferStats, setTransferStats] = useState<any>(null);
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtStats, setDistrictStats] = useState<any>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [programBudgetSelection, setProgramBudgetSelection] = useState<{ budgetCode: string; objectCode: string } | null>(null);
  const [utilizationTransfer, setUtilizationTransfer] = useState<Transfer | null>(null);
  const [utilizationDraft, setUtilizationDraft] = useState({ amount: 0, utilizedAt: localToday(), remarks: '' });
  const [showDistrictForm, setShowDistrictForm] = useState(false);
  const [districtForm, setDistrictForm] = useState({ district: '', division: '', amount: 0, releaseDate: '', remarks: '' });

  const visibleTransfers = useMemo(() => {
    const terms = globalQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return transfers.filter(transfer => {
      const value = `${transfer.recipient} ${transfer.scopeType || ''} ${transfer.districtFund || ''} ${transfer.purpose} ${transfer.objectCode} ${transfer.fiscalYear} ${transfer.budgetCode || ''} ${transfer.status} ${transfer.remarks || ''} ${transfer.amount} ${transfer.orderDate || ''}`.toLowerCase();
      return terms.every(term => value.includes(term));
    });
  }, [transfers, globalQuery]);

  const programOptions = useMemo(() => [...new Set([
    ...users.flatMap(user => user.programs),
    ...transfers.filter(transfer => transfer.scopeType === 'program').map(transfer => transfer.recipient),
  ])].sort((left, right) => left.localeCompare(right)), [transfers, users]);
  const districtOptions = useMemo(() => [...new Set([
    ...districts.map(district => district.district),
    ...users.flatMap(user => user.districts),
    ...transfers.filter(transfer => transfer.scopeType === 'district').map(transfer => transfer.recipient),
  ])].sort((left, right) => left.localeCompare(right)), [districts, transfers, users]);

  const [transferForm, setTransferForm] = useState({
    recipient: '',
    scopeType: 'program' as ProgramDistrictType,
    districtFund: null as DistrictFund | null,
    purpose: '',
    objectCode: '01',
    fiscalYear: 'FY 2026-27',
    budgetCode: 'A215',
    amount: 0,
    orderDate: localToday(),
    status: 'transferred',
    utilized: 0,
    utilizationDate: localToday(),
    remarks: '',
  });

  useEffect(() => { load(); }, []);

  async function load(): Promise<Transfer[]> {
    const [stats, records, dStats, dRecords, people] = await Promise.all([
      apiClient.transfers.stats(),
      apiClient.transfers.records(),
      apiClient.districts.stats(),
      apiClient.districts.records(),
      apiClient.users.list(),
    ]);
    setTransferStats(stats);
    setTransfers(records);
    setDistrictStats(dStats);
    setDistricts(dRecords);
    setUsers(people);
    return records;
  }

  async function handleUtilizationEdit(
    transfer: Transfer,
    utilization: Transfer['utilizations'][number],
    data: { amount: number; utilizedAt: string; remarks: string | null },
  ) {
    try {
      await apiClient.transfers.updateUtilization(transfer.id, utilization.id, data);
      const records = await load();
      setUtilizationTransfer(records.find(record => record.id === transfer.id) || null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('Could not update utilization.'));
    }
  }

  async function addUtilization() {
    if (!utilizationTransfer || utilizationDraft.amount <= 0 || !utilizationDraft.utilizedAt) {
      window.alert(t('Enter a utilization amount and date.'));
      return;
    }
    try {
      await apiClient.transfers.addUtilization(utilizationTransfer.id, {
        ...utilizationDraft,
        remarks: utilizationDraft.remarks.trim() || null,
      });
      const records = await load();
      setUtilizationTransfer(records.find(record => record.id === utilizationTransfer.id) || null);
      setUtilizationDraft({ amount: 0, utilizedAt: localToday(), remarks: '' });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('Could not add utilization.'));
    }
  }

  async function deleteUtilization(transfer: Transfer, utilizationId: string) {
    if (!window.confirm(t('Delete this utilization entry?'))) return;
    try {
      await apiClient.transfers.removeUtilization(transfer.id, utilizationId);
      const records = await load();
      setUtilizationTransfer(records.find(record => record.id === transfer.id) || null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('Could not delete utilization.'));
    }
  }

  function openAddTransfer() {
    setEditingTransfer(null);
    setProgramBudgetSelection(null);
    setTransferForm({
      recipient: '',
      scopeType: 'program',
      districtFund: null,
      purpose: '',
      objectCode: '01',
      fiscalYear: 'FY 2026-27',
      budgetCode: 'A215',
      amount: 0,
      orderDate: localToday(),
      status: 'transferred',
      utilized: 0,
      utilizationDate: localToday(),
      remarks: '',
    });
    setShowModal(true);
  }

  function openEditTransfer(t: Transfer) {
    setEditingTransfer(t);
    setProgramBudgetSelection(t.scopeType === 'program' ? { budgetCode: t.budgetCode || 'A215', objectCode: t.objectCode || '01' } : null);
    setTransferForm({
      recipient: t.recipient || '',
      scopeType: t.scopeType || 'program',
      districtFund: t.districtFund,
      purpose: t.purpose || '',
      objectCode: t.objectCode || '01',
      fiscalYear: t.fiscalYear || 'FY 2026-27',
      budgetCode: t.budgetCode || 'A215',
      amount: t.amount || 0,
      orderDate: t.orderDate || localToday(),
      status: t.status || 'transferred',
      utilized: 0,
      utilizationDate: localToday(),
      remarks: t.remarks || '',
    });
    setShowModal(true);
  }

  function selectRecipient(recipient: string, scopeType: ProgramDistrictType) {
    if (scopeType === 'district' && transferForm.scopeType === 'program') {
      setProgramBudgetSelection({ budgetCode: transferForm.budgetCode, objectCode: transferForm.objectCode });
    }
    const preferences = transfers.filter(transfer => transfer.recipient === recipient && transfer.scopeType === scopeType);
    const counts = new Map<string, { count: number; purpose: string; objectCode: string }>();
    for (const transfer of preferences) {
      const key = `${transfer.purpose}\u0000${transfer.objectCode}`;
      const existing = counts.get(key);
      counts.set(key, {
        count: (existing?.count || 0) + 1,
        purpose: transfer.purpose,
        objectCode: transfer.objectCode,
      });
    }
    const frequent = [...counts.values()].sort((left, right) => right.count - left.count)[0];
    const restoreProgramBudget = scopeType === 'program' && transferForm.scopeType === 'district'
      ? programBudgetSelection
      : null;
    setTransferForm(previous => ({
      ...previous,
      recipient,
      scopeType,
      districtFund: scopeType === 'district'
        ? (previous.scopeType === 'district' ? previous.districtFund : null)
        : null,
      purpose: frequent?.purpose || '',
      objectCode: restoreProgramBudget?.objectCode
        ?? (scopeType === 'district' && previous.districtFund
          ? DISTRICT_BUDGET_MAPPING[previous.districtFund].objectCode
          : frequent?.objectCode || '01'),
      budgetCode: restoreProgramBudget?.budgetCode
        ?? (scopeType === 'district' && previous.districtFund
          ? DISTRICT_BUDGET_MAPPING[previous.districtFund].budgetCode
          : scopeType === 'program' && previous.scopeType === 'district'
            ? 'A215'
            : previous.budgetCode),
    }));
  }

async function handleTransferSave() {
  if (!transferForm.recipient.trim() || !transferForm.purpose.trim()) {
    window.alert(t('Enter both recipient and purpose.'));
    return;
  }
  if (transferForm.status === 'transferred' && !transferForm.orderDate) {
    window.alert(t('Enter the transfer date for a transferred amount.'));
    return;
  }

  try {
    if (transferForm.scopeType === 'district' && !transferForm.districtFund) {
      window.alert(t('Choose Incentive Funds or Consultants Grant for a district transfer.'));
      return;
    }
    if (editingTransfer) {
      const { utilized: _utilized, utilizationDate: _utilizationDate, ...data } = transferForm;
      await apiClient.transfers.update(editingTransfer.id, data);
    } else {
      await apiClient.transfers.create(transferForm);
    }
  } catch (error) {
    window.alert(error instanceof Error ? error.message : t('Could not save the transfer.'));
    return;
  }

  window.dispatchEvent(new Event('budget:refresh'));
  setShowModal(false);
  setEditingTransfer(null);
  await load();
}

  async function handleDistrictSave() {
    if (!districtForm.district.trim() || !districtForm.division.trim()) {
      window.alert(t('Enter both a district and division.'));
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

  function getExportRows() {
    return visibleTransfers.flatMap(t => {
      const utilizationUpdates = t.history.filter(entry => entry.field === 'utilized');
      const lastUtilizationUpdate = utilizationUpdates[utilizationUpdates.length - 1]?.changedAt || '';
      const base = {
      Recipient: t.recipient,
      'Recipient type': t.scopeType || '',
      Purpose: t.purpose,
      'Object Code': t.objectCode,
      'Fiscal year': t.fiscalYear,
      'Budget funding head': t.budgetCode || '',
      Amount: t.amount,
      'Order Date': t.orderDate || '',
      Status: t.status,
      Utilized: t.utilized,
      'District fund': t.districtFund || '',
      Balance: t.amount - t.utilized,
      'Utilization entries': t.utilizations.map(entry =>
        `${entry.utilizedAt}: ${fmtIN(entry.amount)}${entry.remarks ? ` (${entry.remarks})` : ''}`,
      ).join(' | '),
      Remarks: t.remarks || '',
      'Created At': t.createdAt,
      'Last Updated At': t.updatedAt,
      'Utilization Updated At': lastUtilizationUpdate,
      };
      if (!t.history.length) {
        return [{ ...base, 'Change Date': '', 'Changed Field': '', 'Previous Value': '', 'New Value': '' }];
      }
      return t.history.map(entry => ({
        ...base,
        'Change Date': entry.changedAt,
        'Changed Field': entry.field,
        'Previous Value': entry.oldValue || '',
        'New Value': entry.newValue || '',
      }));
    });
  }

  const fundTransfers = visibleTransfers.filter(transfer => transfer.scopeType === 'program' || transfer.scopeType === null);
  const districtSections = [
    {
      key: 'incentive',
      title: 'Incentive Funds',
      records: visibleTransfers.filter(transfer => transfer.scopeType === 'district' && transfer.districtFund === 'incentive_funds'),
    },
    {
      key: 'consultants',
      title: 'Consultants Grant',
      records: visibleTransfers.filter(transfer => transfer.scopeType === 'district' && transfer.districtFund === 'consultants_grant'),
    },
    {
      key: 'untagged',
      title: 'Untagged district transfers',
      records: visibleTransfers.filter(transfer => transfer.scopeType === 'district' && !transfer.districtFund),
    },
  ];
  const districtTransferCount = districtSections.reduce((count, section) => count + section.records.length, 0);

  return (
    <div className="tab-panel" id="tab-transfers">
      {/* Transfer stats */}
      {transferStats && (
        <div className="stats n4">
          {[
            { lbl: 'Total transferred', val: fmtShort(transferStats.totalAmt), sub: `${transferStats.count} ${t('releases')}` },
            { lbl: 'Utilized to date', val: fmtShort(transferStats.totalUtil), sub: `${transferStats.utilizationPct}% ${t('of transferred')}` },
            { lbl: 'Unutilized balance', val: fmtShort(transferStats.unutilized), sub: 'awaiting UC' },
            { lbl: 'Awaiting minutes', val: transferStats.pending, sub: transferStats.pending ? 'not yet released' : 'all released' },
          ].map((s, i) => (
            <div key={i} className="stat">
              <div className="lbl">{t(s.lbl)}</div>
              <div className="val mono">{s.val}</div>
              <div className="sub">{t(s.sub)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h2>{t('Transfers')}</h2>
          <div className="panel-actions">
            <span className="note">{fundTransfers.length} {t(fundTransfers.length === 1 ? 'record' : 'records')}</span>
            <ExportActions getRows={getExportRows} filename="transfers" />
            {!readOnly && <button className="btn primary" onClick={openAddTransfer}>+ {t('Add transfer')}</button>}
          </div>
        </div>
        <TransferRecordsSection
          title="Fund Transfers"
          records={fundTransfers}
          readOnly={readOnly}
          onEdit={openEditTransfer}
          onManageUtilization={transfer => {
            setUtilizationTransfer(transfer);
            setUtilizationDraft({ amount: 0, utilizedAt: localToday(), remarks: '' });
          }}
        />
      </div>
        {districtStats && (
          <div className="stats n3 district-transfer-stats">
            {[
              { lbl: 'Districts', val: districtStats.totalDistricts, sub: 'across 6 divisions' },
              { lbl: 'Total released', val: fmtShort(districtStats.totalReleased), sub: `${districtStats.releasedCount} ${t(districtStats.releasedCount === 1 ? 'district' : 'districts')} ${t('recorded')}` },
              { lbl: 'Awaiting release', val: districtStats.awaitingRelease, sub: 'no amount entered yet' },
            ].map((stat, index) => (
              <div key={index} className="stat">
                <div className="lbl">{t(stat.lbl)}</div>
                <div className="val mono">{stat.val}</div>
                <div className="sub">{t(stat.sub)}</div>
              </div>
            ))}
          </div>
        )}
      <div className="panel district-transfer-panel">
        <div className="panel-head">
          <div>
            <h2>{t('District')}</h2>
            <p className="note">{t('District transfers grouped by fund category')}</p>
          </div>
          <span className="note">{districtTransferCount} {t(districtTransferCount === 1 ? 'record' : 'records')}</span>
        </div>
        <div className="district-transfer-sections">
          {districtSections.map(section => (
            <TransferRecordsSection
              key={section.key}
              title={section.title}
              records={section.records}
              readOnly={readOnly}
              onEdit={openEditTransfer}
              onManageUtilization={transfer => {
                setUtilizationTransfer(transfer);
                setUtilizationDraft({ amount: 0, utilizedAt: localToday(), remarks: '' });
              }}
            />
          ))}
        </div>
      </div>

      {!readOnly && utilizationTransfer && (
        <div className="modal-overlay" onClick={event => {
          if (event.target === event.currentTarget) setUtilizationTransfer(null);
        }}>
          <div className="modal-card utilization-modal">
            <h3>{t('Utilization entries')} · {utilizationTransfer.recipient}</h3>
            <p className="note">{fmtIN(utilizationTransfer.utilized)} {t('utilized of')} {fmtIN(utilizationTransfer.amount)}</p>
            <div className="utilization-entry-list">
              {utilizationTransfer.utilizations.map(entry => (
                <div className="utilization-entry" key={entry.id}>
                  <label>{t('Amount (₹)')}</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={entry.amount}
                    disabled={Boolean(entry.billId)}
                    onBlur={event => {
                      const amount = Number(event.currentTarget.value);
                      if (Number.isFinite(amount) && amount > 0 && amount !== entry.amount) {
                        void handleUtilizationEdit(utilizationTransfer, entry, {
                          amount,
                          utilizedAt: entry.utilizedAt,
                          remarks: entry.remarks,
                        });
                      }
                    }}
                  />
                  <label>{t('Utilization date')}</label>
                  <input
                    type="date"
                    defaultValue={entry.utilizedAt}
                    disabled={Boolean(entry.billId)}
                    onBlur={event => {
                      if (event.currentTarget.value && event.currentTarget.value !== entry.utilizedAt) {
                        void handleUtilizationEdit(utilizationTransfer, entry, {
                          amount: entry.amount,
                          utilizedAt: event.currentTarget.value,
                          remarks: entry.remarks,
                        });
                      }
                    }}
                  />
                  <span>{entry.remarks || (entry.billId ? t('Linked cleared bill') : '—')}</span>
                  {!entry.billId && <button className="btn-icon" type="button" title={t('Delete utilization')} onClick={() => void deleteUtilization(utilizationTransfer, entry.id)}>×</button>}
                </div>
              ))}
            </div>
            <div className="utilization-entry new-utilization-entry">
              <label>{t('Amount (₹)')}</label>
              <input type="number" min="0" step="1" value={utilizationDraft.amount || ''} onChange={event => setUtilizationDraft({ ...utilizationDraft, amount: Number(event.target.value) || 0 })} />
              <label>{t('Utilization date')}</label>
              <input type="date" value={utilizationDraft.utilizedAt} onChange={event => setUtilizationDraft({ ...utilizationDraft, utilizedAt: event.target.value })} />
              <label>{t('Remarks')}</label>
              <input value={utilizationDraft.remarks} onChange={event => setUtilizationDraft({ ...utilizationDraft, remarks: event.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={() => setUtilizationTransfer(null)}>{t('Close')}</button>
              <button className="btn primary" type="button" onClick={() => void addUtilization()}>{t('Add utilization')}</button>
            </div>
          </div>
        </div>
      )}
      {!readOnly && showModal && (
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
      <h3>{t(editingTransfer ? 'Edit transfer' : 'Add transfer')}</h3>

      <ProgramDistrictField
          label="Recipient — Program or District"
          type={transferForm.scopeType}
          value={transferForm.recipient}
          programs={[...programOptions, ...(transferForm.scopeType === 'program' && transferForm.recipient ? [transferForm.recipient] : [])]}
          districts={[...districtOptions, ...(transferForm.scopeType === 'district' && transferForm.recipient ? [transferForm.recipient] : [])]}
          onTypeChange={type => selectRecipient(transferForm.recipient, type)}
          onValueChange={recipient => selectRecipient(recipient, transferForm.scopeType)}
      />

      {transferForm.scopeType === 'district' && (
        <div className="field">
          <label>{t('District transfer category')}</label>
          <select
            value={transferForm.districtFund || ''}
            onChange={event => {
              const districtFund = (event.target.value || null) as DistrictFund | null;
              const mapping = districtFund ? DISTRICT_BUDGET_MAPPING[districtFund] : null;
              setTransferForm({
                ...transferForm,
                districtFund,
                ...(mapping && { budgetCode: mapping.budgetCode, objectCode: mapping.objectCode }),
              });
            }}
            required
          >
            <option value="">{t('Choose a category')}</option>
            <option value="incentive_funds">{t('Incentive Funds')}</option>
            <option value="consultants_grant">{t('Consultants Grant')}</option>
          </select>
        </div>
      )}

      <div className="field">
        <label>{t('Purpose')}</label>
        <input
          value={transferForm.purpose}
          onChange={e =>
            setTransferForm({ ...transferForm, purpose: e.target.value })
          }
          placeholder={t('e.g. Contractual Services')}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>{t('Object code')}</label>
          <select
            value={transferForm.objectCode}
            disabled={Boolean(transferForm.districtFund)}
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
          <label>{t('Budget funding head')}</label>
          <select
            value={transferForm.budgetCode}
            disabled={Boolean(transferForm.districtFund)}
            onChange={event => setTransferForm({ ...transferForm, budgetCode: event.target.value })}
          >
            <option value="A215">A215 - {t('IPF 70 % Bank Share')}</option>
            <option value="A224">A224 - {t('IPF 30% State Share')}</option>
            <option value="A233">A233 - {t('70% PforR - Bank Share')}</option>
          </select>
        </div>
        <div className="field">
          <label>{t('Fiscal year')}</label>
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
          <label>{t('Order date')}</label>
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
          <label>{t('Amount transferred (₹)')}</label>
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
          <label>{t('Release status')}</label>
          <select
            value={transferForm.status}
            onChange={e =>
              setTransferForm({
                ...transferForm,
                status: e.target.value,
              })
            }
          >
            <option value="transferred">{t('Transferred')}</option>
            <option value="minutes_awaited">{t('Minutes awaited')}</option>
          </select>
        </div>
      </div>

      <div className="field">
        {editingTransfer ? (
          <p className="note">{fmtIN(editingTransfer.utilized)} {t('utilized; manage dated utilization entries from the transfer row.')}</p>
        ) : (
          <>
            <label>{t('Initial utilization amount (₹)')}</label>
            <input
              type="number"
              min="0"
              step="1"
              value={transferForm.utilized}
              onChange={e => setTransferForm({ ...transferForm, utilized: parseFloat(e.target.value) || 0 })}
            />
            {transferForm.utilized > 0 && (
              <>
                <label>{t('Utilization date')}</label>
                <input
                  type="date"
                  value={transferForm.utilizationDate}
                  onChange={e => setTransferForm({ ...transferForm, utilizationDate: e.target.value })}
                />
              </>
            )}
          </>
        )}
      </div>

      <div className="field">
        <label>{t('Remarks')}</label>
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
          {t('Cancel')}
        </button>

        <button
          className="btn primary"
          onClick={handleTransferSave}
        >
          {t(editingTransfer ? 'Save changes' : 'Save transfer')}
        </button>
      </div>
    </div>
  </div>
)}
    {!readOnly && showDistrictForm && (
      <div className="modal-overlay" onClick={event => {
        if (event.target === event.currentTarget) setShowDistrictForm(false);
      }}>
        <div className="modal-card">
          <h3>{t('Add district record')}</h3>
          <div className="field"><label>{t('District')}</label><input value={districtForm.district} onChange={event => setDistrictForm({ ...districtForm, district: event.target.value })} /></div>
          <div className="field"><label>{t('Division')}</label><input value={districtForm.division} onChange={event => setDistrictForm({ ...districtForm, division: event.target.value })} /></div>
          <div className="field"><label>{t('Amount released (₹)')}</label><input type="number" min="0" step="1" value={districtForm.amount} onChange={event => setDistrictForm({ ...districtForm, amount: Number(event.target.value) || 0 })} /></div>
          <div className="field"><label>{t('Release date')}</label><input type="date" value={districtForm.releaseDate} onChange={event => setDistrictForm({ ...districtForm, releaseDate: event.target.value })} /></div>
          <div className="field"><label>{t('Remarks')}</label><textarea value={districtForm.remarks} onChange={event => setDistrictForm({ ...districtForm, remarks: event.target.value })} /></div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowDistrictForm(false)}>{t('Cancel')}</button>
            <button className="btn primary" onClick={handleDistrictSave}>{t('Save district')}</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

function TransferRecordsSection({
  title,
  records,
  readOnly,
  onEdit,
  onManageUtilization,
}: {
  title: string;
  records: Transfer[];
  readOnly: boolean;
  onEdit: (transfer: Transfer) => void;
  onManageUtilization: (transfer: Transfer) => void;
}) {
  const { t } = useAppSettings();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groupedRecords = useMemo(() => {
    const groups = new Map<string, Transfer[]>();
    for (const transfer of records) {
      const grouped = groups.get(transfer.recipient) || [];
      grouped.push(transfer);
      groups.set(transfer.recipient, grouped);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [records]);

  return (
    <section className="transfer-category-panel">
      {title !== 'Fund Transfers' && 
      <div className="panel-head">
        <h3>{t(title)}</h3>
        <span className="note">{records.length} {t(records.length === 1 ? 'record' : 'records')}</span>
      </div>
}
      {records.length === 0 ? (
        <p className="note">{t('No transfers recorded in this section yet.')}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>{t('Recipient')}</th><th>{t('Purpose / object code')}</th><th className="num">{t('Amount transferred')}</th>
              <th>{t('Order date')}</th><th>{t('Release status')}</th><th className="num">{t('Utilized to date')}</th>
              <th className="num">{t('Balance')}</th><th>{t('Remarks')}</th>{!readOnly && <th></th>}
            </tr></thead>
            {groupedRecords.map(([recipient, recipientTransfers]) => {
              const isCollapsed = collapsed.has(recipient);
              return (
                <tbody key={recipient}>
                  <tr className="tot-row">
                    <td colSpan={readOnly ? 8 : 9}>
                      <button
                        className="recipient-group-toggle"
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() => setCollapsed(previous => {
                          const next = new Set(previous);
                          if (next.has(recipient)) next.delete(recipient);
                          else next.add(recipient);
                          return next;
                        })}
                      >
                        <span className={`recipient-chevron${isCollapsed ? ' collapsed' : ''}`} aria-hidden="true"><svg
                        className={`recipient-chevron ${isCollapsed ? 'collapsed' : ''}`}
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path d="m6 8 4 4 4-4" />
                      </svg></span>
                        <span className="recipient-group-name">{recipient}</span>
                        <span className="note">· {recipientTransfers.length} {t(recipientTransfers.length === 1 ? 'transfer' : 'transfers')} · {fmtIN(recipientTransfers.reduce((sum, transfer) => sum + transfer.amount, 0))} {t('total')}</span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed && recipientTransfers.map(transfer => (
                    <tr key={transfer.id}>
                      <td className="vendor-cell">{transfer.recipient}</td>
                      <td className="status-cell">
                        {transfer.purpose}
                        <br /><span className="mono" style={{ color: 'var(--text-muted)' }}>{transfer.objectCode} · {transfer.fiscalYear} · {transfer.budgetCode || t('Unassigned')}</span>
                      </td>
                      <td className="num amt-cell mono">{fmtIN(transfer.amount)}</td>
                      <td className="mono">{transfer.orderDate ? formatDate(transfer.orderDate) : '—'}</td>
                      <td><span className={`chip ${transfer.status}`}><span className="dot" />{t(transfer.status === 'transferred' ? 'Transferred' : 'Minutes awaited')}</span></td>
                      <td className="num">
                        {readOnly ? fmtIN(transfer.utilized) : (
                          <button className="btn utilization-manage-button" type="button" onClick={() => onManageUtilization(transfer)}>
                            {fmtIN(transfer.utilized)} · {transfer.utilizations.length} {t('entries')}
                          </button>
                        )}
                      </td>
                      <td className="num mono">{fmtIN(transfer.amount - transfer.utilized)}</td>
                      <td className="status-cell">{transfer.remarks || '—'}</td>
                      {!readOnly && <td className="row-actions"><button className="btn-icon" onClick={() => onEdit(transfer)} title={t('Edit')}>✎</button></td>}
                    </tr>
                  ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}
      <p className="reg-foot" style={{ marginTop: 10 }}>
        <span>{t('Linked cleared bills update this transfer’s utilization total; dated utilization entries are stored under their transfer.')}</span>
      </p>
    </section>
  );
}

function formatDate(d: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p = d.split('-');
  if (p.length < 3) return d;
  return `${p[2]} ${months[parseInt(p[1]) - 1]} ${p[0]}`;
}

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
