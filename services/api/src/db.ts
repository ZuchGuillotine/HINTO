import pg from 'pg';

import { AppConfig } from './types.js';

const { Pool } = pg;

type QueryParam = string | number | boolean | null | Date | string[];

const pools = new Map<string, pg.Pool>();

export function shouldUsePostgres(config: AppConfig): boolean {
  return Boolean(config.databaseUrl) && config.nodeEnv !== 'test';
}

function getPool(config: AppConfig): pg.Pool {
  if (!config.databaseUrl) {
    throw new Error('Missing DATABASE_URL. Cannot connect to Postgres.');
  }

  const existing = pools.get(config.databaseUrl);
  if (existing) {
    return existing;
  }

  const url = new URL(config.databaseUrl);
  const usesSsl = url.searchParams.get('sslmode') === 'require';
  if (usesSsl) {
    url.searchParams.delete('sslmode');
  }
  const pool = new Pool({
    connectionString: url.toString(),
    ssl: usesSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pools.set(config.databaseUrl, pool);
  return pool;
}

export async function queryRows<T>(
  config: AppConfig,
  text: string,
  params: QueryParam[] = [],
): Promise<T[]> {
  const result = await getPool(config).query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(
  config: AppConfig,
  text: string,
  params: QueryParam[] = [],
): Promise<T | null> {
  const rows = await queryRows<T>(config, text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  config: AppConfig,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool(config).connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
