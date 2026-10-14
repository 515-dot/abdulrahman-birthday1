// Decimal-safe money utilities. Amounts are BigInt minor units (e.g. piastres for EGP, scale 2).
// No floating point is ever used for financial values.

const SCALE = 2;
const FACTOR = 10n ** BigInt(SCALE);

export class MoneyError extends Error {}

/** Parse a decimal string like "1234.50" into minor units. Rejects >2 decimals and malformed input. */
export function parseMoney(input) {
  if (typeof input === 'bigint') return input;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new MoneyError('Invalid amount');
    input = String(input);
  }
  if (typeof input !== 'string') throw new MoneyError('Invalid amount');
  const s = input.trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) throw new MoneyError(`Invalid amount: "${input}"`);
  const frac = (m[3] ?? '').padEnd(SCALE, '0');
  const v = BigInt(m[2]) * FACTOR + BigInt(frac);
  return m[1] ? -v : v;
}

export function formatMoney(minor) {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const whole = abs / FACTOR;
  const frac = (abs % FACTOR).toString().padStart(SCALE, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

export const add = (a, b) => a + b;
export const sub = (a, b) => a - b;
export const sum = (list) => list.reduce((t, v) => t + v, 0n);

/**
 * Percentage of an amount using basis points (1% = 100 bp), rounded half away from zero.
 * Rate is given as a decimal string, e.g. "2.5" for 2.5%; up to 4 decimals of a percent.
 */
export function percentOf(amount, ratePercent) {
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(String(ratePercent).trim());
  if (!m) throw new MoneyError(`Invalid rate: "${ratePercent}"`);
  const frac = (m[2] ?? '').padEnd(4, '0');
  const rate = BigInt(m[1]) * 10000n + BigInt(frac); // percent * 10^4
  const denom = 1000000n; // 100 * 10^4
  const num = amount * rate;
  const neg = num < 0n;
  const abs = neg ? -num : num;
  const q = (abs * 2n + denom) / (denom * 2n); // half-up
  return neg ? -q : q;
}

/**
 * Split an amount by integer weights without losing or creating a piastre
 * (largest-remainder method). Used for split commissions between brokers.
 */
export function allocate(amount, weights) {
  if (!weights.length) throw new MoneyError('No weights');
  const w = weights.map((x) => BigInt(x));
  if (w.some((x) => x < 0n)) throw new MoneyError('Negative weight');
  const total = w.reduce((a, b) => a + b, 0n);
  if (total === 0n) throw new MoneyError('Weights sum to zero');
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const shares = w.map((x) => (abs * x) / total);
  let remainder = abs - shares.reduce((a, b) => a + b, 0n);
  const order = w
    .map((x, i) => ({ i, r: (abs * x) % total }))
    .sort((a, b) => (b.r === a.r ? a.i - b.i : b.r > a.r ? 1 : -1));
  for (let k = 0; remainder > 0n; k++, remainder--) shares[order[k].i] += 1n;
  return shares.map((s) => (neg ? -s : s));
}
