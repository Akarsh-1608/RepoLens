import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[db] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = getPool();
  const start = Date.now();
  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[db] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return result;
  } catch (err) {
    console.error('[db] Query error:', err.message);
    console.error('[db] Query:', text.substring(0, 200));
    throw err;
  }
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  try {
    const result = await query('SELECT NOW()');
    console.log('[db] Connected to PostgreSQL at', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
    return false;
  }
}
