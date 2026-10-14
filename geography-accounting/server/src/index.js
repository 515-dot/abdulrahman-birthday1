import { createApp } from './app.js';
import { pool } from './db/pool.js';

const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, () => console.log(`Geography accounting listening on :${port}`));

// Finish in-flight requests, then close the pool, so deploys never cut a posting in half.
const shutdown = (sig) => {
  console.log(`${sig} received, shutting down`);
  server.close(async () => { await pool.end().catch(() => {}); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
