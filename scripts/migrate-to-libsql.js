/**
 * Migration script: better-sqlite3 + sqlite-vec → libsql
 *
 * Reads all projects and records (with embeddings) from the old sqlite-vec
 * database and writes them into a new libsql database with native F32_BLOB
 * vector columns.
 *
 * Exported functions:
 *   migrate(oldDbPath, newDbUrl) — file-path based, opens/closes connections
 *   migrateFromDb(oldDb, newClient) — accepts pre-opened connections (for tests)
 */

import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { createClient } from '@libsql/client';

/**
 * Create the libsql schema (mirrors LibsqlAdapter._runSchema).
 */
async function createSchema(db) {
  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS project (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE TABLE IF NOT EXISTS record (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
        kind       TEXT NOT NULL CHECK (kind IN ('issue','spec','arch','update')),
        title      TEXT NOT NULL,
        body       TEXT NOT NULL DEFAULT '',
        status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','archived')),
        embedding  F32_BLOB(384),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_record_project_kind
            ON record(project_id, kind)`,
    },
    {
      sql: `CREATE INDEX IF NOT EXISTS idx_record_embedding
            ON record(libsql_vector_idx(embedding, 'metric=cosine'))`,
    },
  ], 'write');
}

/**
 * Migrate data from pre-opened old DB and new libsql client.
 * This is the core logic, testable with in-memory databases.
 *
 * @param {import('better-sqlite3').Database} oldDb — opened better-sqlite3 instance with sqlite-vec loaded
 * @param {import('@libsql/client').Client} newDb — opened libsql client
 * @returns {Promise<{ projects: number, records: number, embeddings: number }>}
 */
export async function migrateFromDb(oldDb, newDb) {
  await createSchema(newDb);

  // 1. Migrate projects
  const projects = oldDb.prepare('SELECT * FROM project').all();
  for (const p of projects) {
    await newDb.execute({
      sql: 'INSERT INTO project (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      args: [p.id, p.name, p.created_at, p.updated_at],
    });
  }

  // 2. Migrate records with embeddings
  const records = oldDb.prepare('SELECT * FROM record').all();
  let embeddingCount = 0;

  for (const r of records) {
    // Look up the embedding from the vec0 virtual table
    const vec = oldDb.prepare(
      'SELECT embedding FROM record_embedding WHERE record_id = ?',
    ).get(r.id);

    let embeddingJson = null;
    if (vec && vec.embedding) {
      const buf = vec.embedding;
      const floats = new Float32Array(
        buf.buffer, buf.byteOffset, buf.byteLength / 4,
      );
      embeddingJson = JSON.stringify(Array.from(floats));
      embeddingCount++;
    }

    if (embeddingJson) {
      await newDb.execute({
        sql: `INSERT INTO record (id, project_id, kind, title, body, status, embedding, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, vector(?), ?, ?)`,
        args: [r.id, r.project_id, r.kind, r.title, r.body, r.status, embeddingJson, r.created_at, r.updated_at],
      });
    } else {
      await newDb.execute({
        sql: `INSERT INTO record (id, project_id, kind, title, body, status, embedding, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
        args: [r.id, r.project_id, r.kind, r.title, r.body, r.status, r.created_at, r.updated_at],
      });
    }
  }

  return { projects: projects.length, records: records.length, embeddings: embeddingCount };
}

/**
 * File-path based migration — opens both databases, migrates, and closes.
 *
 * @param {string} oldDbPath — path to old better-sqlite3 + sqlite-vec DB
 * @param {string} newDbUrl — libsql URL (e.g., 'file:/path/to/new.db')
 * @returns {Promise<{ projects: number, records: number, embeddings: number }>}
 */
export async function migrate(oldDbPath, newDbUrl) {
  const oldDb = new Database(oldDbPath);
  sqliteVec.load(oldDb);

  const newDb = createClient({ url: newDbUrl });

  try {
    const stats = await migrateFromDb(oldDb, newDb);
    return stats;
  } finally {
    oldDb.close();
    newDb.close();
  }
}
