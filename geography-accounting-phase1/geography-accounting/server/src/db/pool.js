import 'dotenv/config';
import pg from 'pg';

// Return BIGINT columns as BigInt so money never passes through floating point.
pg.types.setTypeParser(20, (v) => BigInt(v));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
