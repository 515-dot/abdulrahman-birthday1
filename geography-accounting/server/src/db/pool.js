import 'dotenv/config';
import pg from 'pg';

// Return BIGINT columns as BigInt so money never passes through floating point.
pg.types.setTypeParser(20, (v) => BigInt(v));

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// Managed PostgreSQL providers usually require TLS: set DATABASE_SSL=true (certificate verified)
// or DATABASE_SSL=no-verify only if the provider uses a self-signed chain.
const ssl = process.env.DATABASE_SSL === 'true' ? true
  : process.env.DATABASE_SSL === 'no-verify' ? { rejectUnauthorized: false } : undefined;

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl, max: Number(process.env.DB_POOL_MAX ?? 10) });
pool.on('error', (e) => console.error('Idle PostgreSQL client error', e.message));

/** Run fn inside a transaction; rolls back on any error. */
export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function audit(client, { userId, action, entity, entityId, details = {} }) {
  await client.query(
    'INSERT INTO audit_log (user_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)',
    [userId ?? null, action, entity, String(entityId ?? ''), JSON.stringify(details, (_, v) => (typeof v === 'bigint' ? v.toString() : v))],
  );
}
