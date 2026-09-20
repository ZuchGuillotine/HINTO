#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql to the database in DATABASE_URL, in filename
 * order, once each. Progress is tracked in `schema_migrations` so the script
 * is safe to re-run on every deploy.
 *
 *   DATABASE_URL=postgres://... node db/migrate.mjs            # apply pending
 *   DATABASE_URL=postgres://... node db/migrate.mjs --status   # list state
 *   DATABASE_URL=postgres://... node db/migrate.mjs --dry-run  # show pending only
 *
 * Each migration runs inside its own transaction. `sslmode=require` in the
 * URL is honoured the same way services/api/src/db.ts does.
 */
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import pg from 'pg';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const args = new Set(process.argv.slice(2));
const statusOnly = args.has('--status');
const dryRun = args.has('--dry-run');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const url = new URL(databaseUrl);
const usesSsl = url.searchParams.get('sslmode') === 'require';
if (usesSsl) url.searchParams.delete('sslmode');

const pool = new pg.Pool({
  connectionString: url.toString(),
  ssl: usesSsl ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((name) => /^\d{3}_.+\.sql$/u.test(name))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT version, checksum FROM schema_migrations');
    const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));

    let pending = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/u, '');
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');

      if (applied.has(version)) {
        const drifted = applied.get(version) !== checksum;
        console.log(`${drifted ? 'DRIFT  ' : 'applied'} ${version}${drifted ? ' (file changed since it was applied)' : ''}`);
        continue;
      }

      pending += 1;
      if (statusOnly || dryRun) {
        console.log(`pending ${version}`);
        continue;
      }

      process.stdout.write(`apply   ${version} ... `);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [version, checksum]);
        await client.query('COMMIT');
        console.log('ok');
      } catch (error) {
        await client.query('ROLLBACK');
        console.log('FAILED');
        throw error;
      }
    }

    if (pending === 0) console.log('No pending migrations.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
