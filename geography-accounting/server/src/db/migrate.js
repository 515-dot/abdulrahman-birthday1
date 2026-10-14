import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
const done = new Set((await pool.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
for (const f of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
  if (done.has(f)) continue;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(await readFile(path.join(dir, f), 'utf8'));
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    await client.query('COMMIT');
    console.log('applied', f);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('failed', f, e.message);
    process.exitCode = 1;
    break;
  } finally {
    client.release();
  }
}
await pool.end();
