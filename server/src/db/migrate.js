import { testConnection } from './pool.js';
import { runMigrations } from './migrations.js';

const ok = await testConnection();
if (!ok) {
  console.error('[migrate] Cannot connect to database. Check DATABASE_URL.');
  process.exit(1);
}

try {
  await runMigrations();
  console.log('[migrate] Done.');
  process.exit(0);
} catch (err) {
  console.error('[migrate] Migration failed:', err.message);
  process.exit(1);
}
