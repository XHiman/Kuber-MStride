import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskAccountNumbers } from './privacy';

describe('maskAccountNumbers', () => {
  it('masks 9–18 digit runs, keeping the last four', () => {
    expect(maskAccountNumbers('Paid to A/c 123456789012 via NEFT')).toBe('Paid to A/c XXXX XXXX 9012 via NEFT');
    expect(maskAccountNumbers('acct 1234 5678 9012 3456')).toBe('acct XXXX XXXX 3456');
    expect(maskAccountNumbers('call 9876543210')).toBe('call XXXX XXXX 3210');
  });
  it('leaves dates, amounts, short numbers and reference codes alone', () => {
    const text = 'Bill PASSED on 04.08.2026 for ₹1,10,20,140; file 12345678; invoice IN91HR7L004147';
    expect(maskAccountNumbers(text)).toBe(text);
  });
  it('passes through empty values', () => {
    expect(maskAccountNumbers(null)).toBeNull();
    expect(maskAccountNumbers('')).toBe('');
  });
});

const snapshot = resolve(__dirname, '../../../backend/test/fixtures/bills.prod-2026-10-19.local.json');
describe.skipIf(!existsSync(snapshot))('production snapshot', () => {
  it('free-text fields currently contain no account-like numbers (masking changes nothing today)', () => {
    const bills: Record<string, string | null>[] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : [];
    for (const bill of bills) for (const field of ['status', 'attribute', 'note', 'holdReason']) {
      expect(maskAccountNumbers(bill[field])).toBe(bill[field]);
    }
  });
});
