import { existsSync } from 'node:fs';
import { rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { LibsqlAdapter } from './db-libsql.js';

const DATA_DIR = join(homedir(), '.dude-claude');
const OLD_DB   = join(DATA_DIR, 'dude.db');
const NEW_DB   = join(DATA_DIR, 'dude-libsql.db');

let adapter = null;

/**
 * Initialise the database and return a DbAdapter instance.
 * Detects the DB state on disk:
 *   1. Fresh install (no DB exists)          → LibsqlAdapter directly
 *   2. Already migrated (new DB exists)      → LibsqlAdapter
 *   3. Old DB exists, not migrated           → auto-migrate, rename old to .backup
 *
 * Subsequent calls return the same instance.
 * @param {object} [config] - Optional config passed to LibsqlAdapter
 * @returns {Promise<import('./db-adapter.js').DbAdapter>}
 */
export async function initDb(config = {}) {
  if (adapter) return adapter;

  const hasOldDb = existsSync(OLD_DB);
  const hasNewDb = existsSync(NEW_DB);

  // Old DB exists, not yet migrated → auto-migrate
  if (hasOldDb && !hasNewDb) {
    await _autoMigrate();
  }

  adapter = new LibsqlAdapter({ dbPath: NEW_DB, ...config });
  await adapter.init();
  return adapter;
}

/** Return the raw adapter (must call initDb first). */
export function getDb() {
  return adapter;
}

/** @internal Reset singleton for testing — not for production use. */
export function _resetForTesting() {
  adapter = null;
}

/**
 * Run the one-time auto-migration from old better-sqlite3 DB to libsql.
 * @private
 */
async function _autoMigrate() {
  console.error('[dude] Old database detected. Migrating to libsql format...');

  let migrate;
  try {
    const mod = await import('../scripts/migrate-to-libsql.js');
    migrate = mod.migrate;
  } catch (err) {
    throw new Error(
      'Database migration requires better-sqlite3 and sqlite-vec packages.\n' +
      '       Install them with: npm install better-sqlite3 sqlite-vec\n' +
      '       Then restart. Your old data in dude.db will be migrated.\n' +
      `       Error: ${err.message}`
    );
  }

  try {
    const stats = await migrate(OLD_DB, `file:${NEW_DB}`);
    console.error(
      `[dude] Migration complete: ${stats.projects} projects, ` +
      `${stats.records} records, ${stats.embeddings} embeddings.`
    );
  } catch (err) {
    // Clean up partial migration so next startup can retry
    if (existsSync(NEW_DB)) {
      try { await unlink(NEW_DB); } catch { /* ignore cleanup errors */ }
    }
    throw new Error(
      `Database migration failed. Old database preserved at ${OLD_DB}. Error: ${err.message}`
    );
  }

  // Rename old DB to .backup
  try {
    await rename(OLD_DB, `${OLD_DB}.backup`);
    console.error(`[dude] Old database backed up to ${OLD_DB}.backup`);
  } catch (err) {
    console.error(
      `[dude] Warning: Could not rename old database to .backup: ${err.message}\n` +
      '       The migration succeeded. You can manually delete dude.db.'
    );
  }
}
