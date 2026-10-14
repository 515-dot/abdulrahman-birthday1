import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMoney, percentOf, allocate, sum, MoneyError } from '../src/lib/money.js';
import { validateLines, assertTransition, assertEditable, buildReversal, trialBalance, JournalError } from '../src/lib/journal.js';
import { can, canApprove } from '../src/lib/permissions.js';

test('money: parse/format round trip, no float drift', () => {
  assert.equal(parseMoney('0.10') + parseMoney('0.20'), parseMoney('0.30'));
  assert.equal(formatMoney(parseMoney('1234.5')), '1234.50');
  assert.equal(formatMoney(parseMoney('-0.05')), '-0.05');
  assert.equal(formatMoney(parseMoney('7')), '7.00');
});

test('money: rejects malformed and over-precise input', () => {
  for (const bad of ['', 'abc', '1.234', '1,000', '1e3', '--1', null, NaN]) {
    assert.throws(() => parseMoney(bad), MoneyError);
  }
});

test('money: percentOf rounds half up', () => {
  assert.equal(formatMoney(percentOf(parseMoney('1000000'), '2.5')), '25000.00');
  assert.equal(formatMoney(percentOf(parseMoney('0.50'), '1')), '0.01'); // 0.005 -> 0.01
  assert.equal(formatMoney(percentOf(parseMoney('0.49'), '1')), '0.00');
  assert.equal(formatMoney(percentOf(parseMoney('333.33'), '3')), '10.00'); // 9.9999
});

test('money: allocate never loses or creates a piastre', () => {
  const total = parseMoney('100.00');
  const parts = allocate(total, [1, 1, 1]);
  assert.equal(sum(parts), total);
  assert.deepEqual(parts.map(formatMoney), ['33.34', '33.33', '33.33']);
  const split = allocate(parseMoney('10000.01'), [60, 40]);
  assert.equal(sum(split), parseMoney('10000.01'));
});

const line = (accountId, debit, credit) => ({ accountId, debit: parseMoney(debit), credit: parseMoney(credit) });

test('journal: balanced entry passes, unbalanced fails', () => {
  assert.doesNotThrow(() => validateLines([line(1, '100', '0'), line(2, '0', '100')]));
  assert.throws(() => validateLines([line(1, '100', '0'), line(2, '0', '99.99')]), JournalError);
});

test('journal: rejects single line, two-sided line, zero line, negative', () => {
  assert.throws(() => validateLines([line(1, '100', '0')]), JournalError);
  assert.throws(() => validateLines([line(1, '50', '50'), line(2, '0', '0')]), JournalError);
  assert.throws(() => validateLines([line(1, '0', '0'), line(2, '0', '0')]), JournalError);
  assert.throws(() => validateLines([{ accountId: 1, debit: -5n, credit: 0n }, line(2, '0', '5')]), JournalError);
});

test('journal: posted entries are immutable; only reversal allowed', () => {
  assert.doesNotThrow(() => assertTransition('draft', 'posted'));
  assert.doesNotThrow(() => assertTransition('posted', 'reversed'));
  assert.throws(() => assertTransition('posted', 'draft'), JournalError);
  assert.throws(() => assertTransition('reversed', 'posted'), JournalError);
  assert.throws(() => assertEditable({ status: 'posted' }), JournalError);
  assert.doesNotThrow(() => assertEditable({ status: 'draft' }));
});

test('journal: reversal swaps sides, stays balanced, nets to zero', () => {
  const entry = { id: 7, reference: 'JE-0007', status: 'posted', lines: [line(1, '250', '0'), line(2, '0', '250')] };
  const rev = buildReversal(entry, { date: '2026-10-14', reason: 'wrong account' });
  assert.doesNotThrow(() => validateLines(rev.lines));
  assert.equal(rev.lines[0].credit, entry.lines[0].debit);
  const net = [...entry.lines, ...rev.lines].reduce((m, l) => m + l.debit - l.credit, 0n);
  assert.equal(net, 0n);
  assert.throws(() => buildReversal({ ...entry, status: 'draft' }, { date: 'x', reason: 'r' }), JournalError);
  assert.throws(() => buildReversal(entry, { date: 'x', reason: ' ' }), JournalError);
});

test('journal: trial balance balances and signs by account type', () => {
  const tb = trialBalance([
    { accountId: 1, type: 'asset', debit: parseMoney('500'), credit: parseMoney('0') },
    { accountId: 2, type: 'revenue', debit: parseMoney('0'), credit: parseMoney('500') },
  ]);
  assert.equal(tb.balanced, true);
  assert.equal(tb.rows[0].balance, parseMoney('500'));
  assert.equal(tb.rows[1].balance, parseMoney('500'));
});

test('permissions: roles enforced, broker and auditor restricted', () => {
  assert.equal(can('super_admin', 'anything'), true);
  assert.equal(can('auditor', 'tx:create'), false);
  assert.equal(can('auditor', 'audit:read'), true);
  assert.equal(can('broker', 'deals:read'), false);
  assert.equal(can('broker', 'deals:read:own'), true);
  assert.equal(can('unknown_role', 'tx:read'), false);
});

test('permissions: creator cannot approve own transaction; limits apply', () => {
  const base = { role: 'finance_manager', userId: 1, createdBy: 2, amount: 1000n, approvalLimit: 5000n };
  assert.equal(canApprove(base).ok, true);
  assert.equal(canApprove({ ...base, createdBy: 1 }).ok, false);
  assert.equal(canApprove({ ...base, amount: 5001n }).ok, false);
  assert.equal(canApprove({ ...base, role: 'accountant' }).ok, false);
});
