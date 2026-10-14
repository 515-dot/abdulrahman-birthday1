// Double-entry journal rules. Pure functions: no database access, fully unit-testable.
import { sum } from './money.js';

export class JournalError extends Error {}

export const STATUS = Object.freeze({ DRAFT: 'draft', POSTED: 'posted', REVERSED: 'reversed' });

/**
 * lines: [{ accountId, debit: bigint, credit: bigint }]
 * Throws JournalError unless the entry is valid and balanced.
 */
export function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) throw new JournalError('An entry needs at least two lines');
  for (const [i, l] of lines.entries()) {
    if (!l.accountId) throw new JournalError(`Line ${i + 1}: account is required`);
    if (typeof l.debit !== 'bigint' || typeof l.credit !== 'bigint') throw new JournalError(`Line ${i + 1}: amounts must be minor units`);
    if (l.debit < 0n || l.credit < 0n) throw new JournalError(`Line ${i + 1}: amounts cannot be negative`);
    if ((l.debit > 0n) === (l.credit > 0n)) throw new JournalError(`Line ${i + 1}: exactly one of debit or credit must be non-zero`);
  }
  const d = sum(lines.map((l) => l.debit));
  const c = sum(lines.map((l) => l.credit));
  if (d !== c) throw new JournalError(`Entry is not balanced (debits ${d} vs credits ${c})`);
  return { totalDebit: d, totalCredit: c };
}

/** Posted entries are immutable; the only allowed change is posting a draft or reversing a posted entry. */
const ALLOWED = { draft: ['posted'], posted: ['reversed'], reversed: [] };
export function assertTransition(from, to) {
  if (!ALLOWED[from]?.includes(to)) throw new JournalError(`Cannot change entry status from ${from} to ${to}`);
}

export function assertEditable(entry) {
  if (entry.status !== STATUS.DRAFT) throw new JournalError('Posted or reversed entries cannot be edited or deleted; create a reversal instead');
}

/** Build the reversing entry: same accounts, debit/credit swapped. Original is marked reversed by the caller. */
export function buildReversal(entry, { date, reason }) {
  if (entry.status !== STATUS.POSTED) throw new JournalError('Only posted entries can be reversed');
  if (!reason || !reason.trim()) throw new JournalError('A reversal reason is required');
  return {
    date,
    description: `Reversal of ${entry.reference}: ${reason.trim()}`,
    reversesEntryId: entry.id,
    lines: entry.lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit })),
  };
}

/** Normal balance side per account type, to turn debit/credit sums into a signed balance. */
const DEBIT_NORMAL = new Set(['asset', 'expense']);
export function balanceOf(type, debit, credit) {
  return DEBIT_NORMAL.has(type) ? debit - credit : credit - debit;
}

/** Trial balance over posted lines only. rows: [{accountId, type, debit, credit}] */
export function trialBalance(rows) {
  const out = rows.map((r) => ({ ...r, balance: balanceOf(r.type, r.debit, r.credit) }));
  const totalDebit = sum(rows.map((r) => r.debit));
  const totalCredit = sum(rows.map((r) => r.credit));
  return { rows: out, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}
