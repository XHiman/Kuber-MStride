import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Bill, UserProfile } from '../types';
import { roleOf, scopeBills, scopeLabel, summariseWork } from './scope';

const user = (over: Partial<UserProfile>): UserProfile => ({ id: 'u1', name: 'Test', programs: [], districts: [], ...over });
const bill = (id: string, over: Partial<Bill>) => ({ id, vendor: 'ICARE', district: null, assignedUserId: null, cat: 'in_progress', _days: 10, amount: 1, ...over } as Bill);

describe('roles', () => {
  it('defaults to finance when the API omits role', () => {
    expect(roleOf(user({}))).toBe('finance');
    expect(roleOf(user({ role: 'dsu' }))).toBe('dsu');
    expect(roleOf(null)).toBe('finance');
  });
  it('labels the scope', () => {
    expect(scopeLabel(user({}))).toBe('All bills (finance)');
    expect(scopeLabel(user({ role: 'dsu', districts: ['Nagpur'] }))).toBe('DSU: Nagpur');
  });
});

describe('scopeBills', () => {
  const bills = [
    bill('a', { vendor: 'Nagpur - E & Y' }),
    bill('b', { vendor: 'DSU Pune - STC' }),
    bill('c', { vendor: 'ICARE', assignedUserId: 'u1' }),
    bill('d', { vendor: 'ICARE', district: 'nagpur' }),
  ];
  it('finance sees everything', () => {
    expect(scopeBills(bills, user({}))).toHaveLength(4);
  });
  it('DSU users see their DSU (via vendor map or district) plus assigned bills', () => {
    expect(scopeBills(bills, user({ role: 'dsu', districts: ['Nagpur'] })).map(b => b.id)).toEqual(['a', 'c', 'd']);
    expect(scopeBills(bills, user({ role: 'dsu', districts: [] })).map(b => b.id)).toEqual(['c']);
  });
});

describe('summariseWork', () => {
  it('counts open items and finds the oldest', () => {
    const s = summariseWork([
      bill('a', { _days: 377 }), bill('b', { cat: 'on_hold', _days: 179, assignedUserId: 'u1' }),
      bill('c', { cat: 'cleared', _days: null }), bill('d', { _days: null }),
    ], 'u1', b => b.amount);
    expect(s).toMatchObject({ inScope: 4, open: 3, openAmount: 3, onHold: 1, assignedOpen: 1 });
    expect(s.oldest?.id).toBe('a');
  });
});

const snapshot = resolve(__dirname, '../../../backend/test/fixtures/bills.prod-2026-10-19.local.json');
describe.skipIf(!existsSync(snapshot))('production snapshot', () => {
  const bills: Bill[] = existsSync(snapshot) ? JSON.parse(readFileSync(snapshot, 'utf8')) : [];
  it('a Nagpur DSU user sees the 16 merged Nagpur bills; finance sees all 76', () => {
    expect(scopeBills(bills, user({ role: 'dsu', districts: ['Nagpur'] }))).toHaveLength(16);
    const all = summariseWork(scopeBills(bills, user({})), 'u1', b => b.effectiveAmount ?? b.amount);
    expect(all).toMatchObject({ inScope: 76, open: 45 });
    expect(all.oldest?.vendor).toBe('IVA -Lochan & Co.');
  });
});
