import { SqliteVecAdapter } from './db-sqlite-vec.js';

let adapter = null;

/**
 * Initialise the database and return a DbAdapter instance.
 * Subsequent calls return the same instance.
 * @returns {Promise<import('./db-adapter.js').DbAdapter>}
 */
export async function initDb() {
  if (adapter) return adapter;
  adapter = new SqliteVecAdapter();
  await adapter.init();
  return adapter;
}
