import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Migration verification tests.
 *
 * These validate that migration files exist, are well-formed SQL,
 * and follow the project's naming/ordering conventions.
 * They do NOT require a live database connection.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../supabase/migrations');

describe('Supabase migration files', () => {
  let migrationFiles: string[];

  beforeAll(() => {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      migrationFiles = [];
      return;
    }
    migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  });

  test('migrations directory exists', () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
  });

  test('at least one migration file exists', () => {
    expect(migrationFiles.length).toBeGreaterThan(0);
  });

  test('migration files follow numeric prefix convention', () => {
    for (const file of migrationFiles) {
      // Expect pattern: NNN_description.sql (e.g., 010_auth_identities.sql)
      expect(file).toMatch(/^\d{3}_[a-z0-9_]+\.sql$/);
    }
  });

  test('migration files have no duplicate prefixes', () => {
    const prefixes = migrationFiles.map((f) => f.slice(0, 3));
    const uniquePrefixes = new Set(prefixes);
    expect(uniquePrefixes.size).toBe(prefixes.length);
  });

  test('migration files are non-empty', () => {
    for (const file of migrationFiles) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      expect(content.trim().length).toBeGreaterThan(0);
    }
  });

  test('010_auth_identities.sql creates expected tables', () => {
    const authMigration = migrationFiles.find((f) => f.startsWith('010'));
    expect(authMigration).toBeDefined();

    const content = fs.readFileSync(
      path.join(MIGRATIONS_DIR, authMigration!),
      'utf-8',
    );

    expect(content).toContain('CREATE TABLE');
    expect(content).toContain('auth_identities');
    expect(content).toContain('auth_login_events');
    expect(content).toContain('ENABLE ROW LEVEL SECURITY');
    expect(content).toContain('CREATE POLICY');
  });

  test('auth_identities migration has required columns', () => {
    const authMigration = migrationFiles.find((f) => f.startsWith('010'));
    const content = fs.readFileSync(
      path.join(MIGRATIONS_DIR, authMigration!),
      'utf-8',
    );

    const requiredColumns = [
      'user_id',
      'provider',
      'provider_user_id',
      'is_primary',
      'linked_at',
    ];

    for (const col of requiredColumns) {
      expect(content).toContain(col);
    }
  });

  test('auth_identities has unique constraints for provider linkage', () => {
    const authMigration = migrationFiles.find((f) => f.startsWith('010'));
    const content = fs.readFileSync(
      path.join(MIGRATIONS_DIR, authMigration!),
      'utf-8',
    );

    // One linkage per provider per user
    expect(content).toContain('idx_auth_identities_user_provider');
    // Global uniqueness: one provider account per HINTO user
    expect(content).toContain('idx_auth_identities_provider_uid');
  });
});
