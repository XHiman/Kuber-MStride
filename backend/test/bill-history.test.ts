import { describe, expect, it } from 'vitest';
import { cleanNote, historyEvents } from '../src/bills/bill-history';

const asha = { id: 'u1', name: 'Asha Patil' };
const state = (bucket: string, onHold = false, holdReason: string | null = null) => ({ bucket, onHold, holdReason });

describe('historyEvents', () => {
  it('records creation with the author', () => {
    expect(historyEvents(null, state('Invoice Raised'), asha)).toEqual([
      { stage: 'Invoice Raised', source: 'created', changedById: 'u1', changedByName: 'Asha Patil', note: null },
    ]);
  });
  it('records a stage move with who and why', () => {
    expect(historyEvents(state('Invoice Raised'), state('PMC Check Pending'), asha, '  PMC accepted report  ')).toEqual([
      { stage: 'PMC Check Pending', source: 'tracked', changedById: 'u1', changedByName: 'Asha Patil', note: 'PMC accepted report' },
    ]);
  });
  it('records hold and release as their own events; hold falls back to the hold remark', () => {
    expect(historyEvents(state('File Approval Pending'), state('File Approval Pending', true, 'Handover data awaited'), asha))
      .toMatchObject([{ source: 'hold', note: 'Handover data awaited' }]);
    expect(historyEvents(state('File Approval Pending', true, 'x'), state('File Approval Pending'), asha, 'Data received'))
      .toMatchObject([{ source: 'release', note: 'Data received' }]);
  });
  it('records nothing for an edit that changes neither stage nor hold', () => {
    expect(historyEvents(state('Invoice Raised'), state('Invoice Raised'), asha, 'typo fix')).toEqual([]);
  });
  it('treats legacy stage spellings as the same stage', () => {
    expect(historyEvents(state('Treasury Clearance'), state('Cleared by Treasury'), asha)).toEqual([]);
  });
  it('keeps notes short and drops blanks', () => {
    expect(cleanNote('   ')).toBeNull();
    expect(cleanNote('x'.repeat(600))).toHaveLength(500);
    expect(cleanNote(42)).toBeNull();
  });
});
