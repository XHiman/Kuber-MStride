import { describe, expect, it } from 'vitest';
import { fmtIN, fmtShort, formatDate, formatDateTime, pct } from './format';

describe('money', () => {
  it('uses Cr, L and full figures below ₹1 L', () => {
    expect(fmtShort(240700553.73)).toBe('₹24.07 Cr');
    expect(fmtShort(3537097)).toBe('₹35.4 L');
    expect(fmtShort(53880)).toBe('₹53,880');
    expect(fmtShort(99999)).toBe('₹99,999');
    expect(fmtShort(100000)).toBe('₹1.0 L');
    expect(fmtShort(10000000)).toBe('₹1.00 Cr');
    expect(fmtShort(0)).toBe('₹0');
    expect(fmtShort(-3537097)).toBe('-₹35.4 L');
  });
  it('groups exact rupees the Indian way', () => {
    expect(fmtIN(110201400)).toBe('₹11,02,01,400');
    expect(fmtIN(500)).toBe('₹500');
    expect(fmtIN(1000)).toBe('₹1,000');
    expect(fmtIN(962891.6)).toBe('₹9,62,892');
    expect(fmtIN(-25146)).toBe('-₹25,146');
  });
  it('rounds percentages', () => {
    expect(pct(98889242.05, 240700553.73)).toBe(41);
    expect(pct(1, 0)).toBe(0);
  });
});

describe('dates', () => {
  it('formats calendar dates as dd MMM yyyy without time-zone drift', () => {
    expect(formatDate('2026-10-19')).toBe('19 Oct 2026');
    expect(formatDate('2026-06-05')).toBe('05 Jun 2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not a date')).toBe('not a date');
  });
  it('formats timestamps with local time', () => {
    const local = new Date(2026, 9, 19, 14, 5);
    expect(formatDateTime(local)).toBe('19 Oct 2026, 14:05');
    expect(formatDate(local)).toBe('19 Oct 2026');
  });
});
