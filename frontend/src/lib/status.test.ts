import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Bill } from '../types';
import { deriveReasons, isPlaceholder, placeholderRemainder, plural, stageLabel } from './status';

const base = {
  invoice: 'INV-1', date: '2026-05-01', efileNumber: null, status: 'Received tax invoice',
  bucket: 'Invoice Raised', cat: 'in_progress' as const, holdReason: null,
};

describe('placeholder detection', () => {
  it('matches "Please Check" variants only at the start', () => {
    expect(isPlaceholder('Please Check')).toBe(true);
    expect(isPlaceholder('please check From Apr 26')).toBe(true);
    expect(isPlaceholder('Bill PASSED, please check later')).toBe(false);
    expect(isPlaceholder(null)).toBe(false);
  });
  it('keeps the useful remainder', () => {
    expect(placeholderRemainder('Please Check From Apr 26')).toBe('From Apr 26');
    expect(placeholderRemainder('Please Check')).toBe('');
  });
});

describe('deriveReasons', () => {
  it('returns nothing for a complete bill', () => {
    expect(deriveReasons(base)).toEqual([]);
  });
  it('flags placeholder status with no other gap as "Reason not recorded"', () => {
    expect(deriveReasons({ ...base, status: 'Please Check' })).toEqual(['not_recorded']);
  });
  it('flags missing invoice number and date instead of a generic reason', () => {
    expect(deriveReasons({ ...base, invoice: 'Please Check', date: null, status: 'Please Check', bucket: 'Cleared by Treasury', cat: 'cleared' }))
      .toEqual(['missing_invoice_no', 'missing_invoice_date']);
  });
  it('only flags a missing e-file no. at file approval / treasury', () => {
    expect(deriveReasons({ ...base, bucket: 'TFC Committee Approval' })).toEqual([]);
    expect(deriveReasons({ ...base, bucket: 'File Approval Pending' })).toEqual(['missing_efile_no']);
    expect(deriveReasons({ ...base, bucket: 'Sent to Treasury' })).toEqual(['missing_efile_no']);
    expect(deriveReasons({ ...base, bucket: 'Cleared by Treasury', cat: 'cleared' })).toEqual([]);
  });
  it('classifies hold remarks', () => {
    const held = { ...base, cat: 'on_hold' as const };
    expect(deriveReasons({ ...held, holdReason: 'They Did not Share the Handover Data to us' })[0]).toBe('handover_awaited');
    expect(deriveReasons({ ...held, holdReason: 'Awaiting DC approval' })[0]).toBe('needs_approval');
    expect(deriveReasons({ ...held, holdReason: 'Objection on GST' })[0]).toBe('under_query');
    expect(deriveReasons({ ...held, holdReason: null })).toEqual(['not_recorded']);
  });
});

describe('labels', () => {
  it('pluralises', () => {
    expect(`1 ${plural(1, 'bill')}`).toBe('1 bill');
    expect(`0 ${plural(0, 'bill')}`).toBe('0 bills');
  });
  it('uses glossary stage labels', () => {
    expect(stageLabel('File Approval Pending')).toBe('File approval pending');
    expect(stageLabel('Unknown')).toBe('Unknown');
  });
});

// Real-data snapshot (gitignored); skipped when absent.
const snapshot = resolve(__dirname, '../../../backend/test/fixtures/bills.prod-2026-10-19.local.json');
describe.skipIf(!existsSync(snapshot))('production snapshot', () => {
  const bills: Bill[] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : [];
  it('gives every "Please Check" bill a specific reason (none left silent)', () => {
    const flagged = bills.filter(bill => [bill.status, bill.attribute, bill.invoice].some(isPlaceholder));
    expect(flagged).toHaveLength(13);
    for (const bill of flagged) expect(deriveReasons(bill).length).toBeGreaterThan(0);
    const counts: Record<string, number> = {};
    for (const bill of flagged) for (const reason of deriveReasons(bill)) counts[reason] = (counts[reason] ?? 0) + 1;
    expect(counts).toEqual({ missing_invoice_no: 8, missing_invoice_date: 6, not_recorded: 5 });
  });
});
