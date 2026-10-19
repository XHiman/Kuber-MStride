import { describe, expect, it } from 'vitest';
import { fmtIN, fmtShort } from '../src/common/bill-utils';

describe('backend money formatting (mirrors frontend lib/format)', () => {
  it('does not emit a leading comma below ₹1,000', () => {
    expect(fmtIN(500)).toBe('₹500');
    expect(fmtIN(0)).toBe('₹0');
  });
  it('groups the Indian way', () => {
    expect(fmtIN(110201400)).toBe('₹11,02,01,400');
    expect(fmtIN(53880)).toBe('₹53,880');
  });
  it('uses Cr / L suffixes', () => {
    expect(fmtShort(240700553.73)).toBe('₹24.07 Cr');
    expect(fmtShort(3537097)).toBe('₹35.4 L');
    expect(fmtShort(-3537097)).toBe('-₹35.4 L');
  });
});
