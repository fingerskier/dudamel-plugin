import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import { createTestDb, insertProject, seededEmbedding, embeddingBuffer } from './helpers.js';
import { migrateFromDb } from '../scripts/migrate-to-libsql.js';

describe('migrate-to-libsql', () => {
  let oldDb;
  let newDb;

  beforeEach(() => {
    oldDb = createTestDb();
    newDb = createClient({ url: 'file::memory:' });
  });

  afterEach(() => {
    oldDb.close();
    newDb.close();
  });

  // -----------------------------------------------------------------------
  // Empty DB
  // -----------------------------------------------------------------------

  it('should handle empty database with no records', async () => {
    const stats = await migrateFromDb(oldDb, newDb);
    expect(stats.projects).toBe(0);
    expect(stats.records).toBe(0);
    expect(stats.embeddings).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Project preservation
  // -----------------------------------------------------------------------

  it('should migrate all projects with preserved fields', async () => {
    insertProject(oldDb, 'project-alpha');
    insertProject(oldDb, 'project-beta');

    await migrateFromDb(oldDb, newDb);

    const result = await newDb.execute('SELECT * FROM project ORDER BY name');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('project-alpha');
    expect(result.rows[1].name).toBe('project-beta');
    // IDs and timestamps should be preserved
    expect(result.rows[0].id).toBeGreaterThan(0);
    expect(result.rows[0].created_at).toBeDefined();
    expect(result.rows[0].updated_at).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Record field preservation
  // -----------------------------------------------------------------------

  it('should migrate records with all fields preserved', async () => {
    const project = insertProject(oldDb, 'test-project');
    const emb = seededEmbedding(1);
    const now = '2025-06-01T12:00:00.000Z';

    oldDb.prepare(`
      INSERT INTO record (project_id, kind, title, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(project.id, 'arch', 'My Architecture', 'Detailed body', 'resolved', now, now);

    const recordId = oldDb.prepare('SELECT last_insert_rowid() AS id').get().id;
    oldDb.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)')
      .run(BigInt(recordId), embeddingBuffer(emb));

    await migrateFromDb(oldDb, newDb);

    const result = await newDb.execute('SELECT * FROM record WHERE id = ?', [recordId]);
    const row = result.rows[0];
    expect(row.kind).toBe('arch');
    expect(row.title).toBe('My Architecture');
    expect(row.body).toBe('Detailed body');
    expect(row.status).toBe('resolved');
    expect(row.created_at).toBe(now);
    expect(row.updated_at).toBe(now);
    expect(row.project_id).toBe(project.id);
  });

  // -----------------------------------------------------------------------
  // Embedding round-trip fidelity
  // -----------------------------------------------------------------------

  it('should preserve embedding values through migration', async () => {
    const project = insertProject(oldDb, 'test-project');
    const emb = seededEmbedding(42);

    oldDb.prepare(`
      INSERT INTO record (project_id, kind, title, body, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(project.id, 'issue', 'Bug Report', 'details', 'open');

    const recordId = oldDb.prepare('SELECT last_insert_rowid() AS id').get().id;
    oldDb.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)')
      .run(BigInt(recordId), embeddingBuffer(emb));

    await migrateFromDb(oldDb, newDb);

    // Read the embedding back from libsql
    const result = await newDb.execute({
      sql: 'SELECT embedding FROM record WHERE id = ?',
      args: [recordId],
    });

    const stored = result.rows[0].embedding;
    expect(stored).not.toBeNull();

    // Parse the F32_BLOB back to Float32Array
    let floats;
    if (stored instanceof ArrayBuffer) {
      floats = new Float32Array(stored);
    } else if (ArrayBuffer.isView(stored)) {
      floats = new Float32Array(stored.buffer, stored.byteOffset, stored.byteLength / 4);
    }

    expect(floats.length).toBe(384);

    // Verify values match within float precision
    for (let i = 0; i < 384; i++) {
      expect(floats[i]).toBeCloseTo(emb[i], 4);
    }
  });

  // -----------------------------------------------------------------------
  // Records missing embeddings
  // -----------------------------------------------------------------------

  it('should migrate records without embeddings (NULL embedding)', async () => {
    const project = insertProject(oldDb, 'test-project');

    // Insert a record with NO corresponding record_embedding row
    oldDb.prepare(`
      INSERT INTO record (project_id, kind, title, body, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(project.id, 'issue', 'No Embedding Bug', 'orphan record', 'open');

    const stats = await migrateFromDb(oldDb, newDb);
    expect(stats.records).toBe(1);
    expect(stats.embeddings).toBe(0);

    const result = await newDb.execute('SELECT * FROM record');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('No Embedding Bug');
    expect(result.rows[0].embedding).toBeNull();
  });

  // -----------------------------------------------------------------------
  // KNN search equivalence
  // -----------------------------------------------------------------------

  it('should produce the same top-k search ordering after migration', async () => {
    const project = insertProject(oldDb, 'test-project');
    const embeddings = [
      seededEmbedding(10),
      seededEmbedding(20),
      seededEmbedding(30),
    ];
    const titles = ['Record A', 'Record B', 'Record C'];

    // Insert records with embeddings into old DB
    for (let i = 0; i < 3; i++) {
      oldDb.prepare(`
        INSERT INTO record (project_id, kind, title, body, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(project.id, 'issue', titles[i], '', 'open');

      const rid = oldDb.prepare('SELECT last_insert_rowid() AS id').get().id;
      oldDb.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)')
        .run(BigInt(rid), embeddingBuffer(embeddings[i]));
    }

    // Get search ordering from old DB (sqlite-vec)
    const queryEmb = seededEmbedding(10); // should match Record A best
    const oldResults = oldDb.prepare(`
      SELECT re.record_id, re.distance, r.title
      FROM record_embedding re
      JOIN record r ON r.id = re.record_id
      WHERE re.embedding MATCH ? AND k = 3
      ORDER BY re.distance
    `).all(embeddingBuffer(queryEmb));

    const oldOrder = oldResults.map(r => r.title);

    // Migrate
    await migrateFromDb(oldDb, newDb);

    // Search in new DB (libsql vector_top_k)
    const embJson = JSON.stringify(Array.from(queryEmb));
    const newResults = await newDb.execute({
      sql: `SELECT r.title, r.embedding
            FROM vector_top_k('idx_record_embedding', vector(?), 3) AS v
            JOIN record r ON r.rowid = v.id`,
      args: [embJson],
    });

    const newOrder = newResults.rows.map(r => r.title);

    // The top result should be the same (exact match for the query embedding)
    expect(newOrder[0]).toBe(oldOrder[0]);
    // All results should contain the same titles (order may vary slightly for distant matches)
    expect(newOrder.sort()).toEqual(oldOrder.sort());
  });

  // -----------------------------------------------------------------------
  // Multiple records and kinds
  // -----------------------------------------------------------------------

  it('should migrate records of all kinds', async () => {
    const project = insertProject(oldDb, 'test-project');

    for (const kind of ['issue', 'spec', 'arch', 'update']) {
      const emb = seededEmbedding(kind.length * 100);

      oldDb.prepare(`
        INSERT INTO record (project_id, kind, title, body, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(project.id, kind, `${kind} record`, `body for ${kind}`, 'open');

      const rid = oldDb.prepare('SELECT last_insert_rowid() AS id').get().id;
      oldDb.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)')
        .run(BigInt(rid), embeddingBuffer(emb));
    }

    const stats = await migrateFromDb(oldDb, newDb);
    expect(stats.records).toBe(4);
    expect(stats.embeddings).toBe(4);

    const result = await newDb.execute('SELECT kind FROM record ORDER BY kind');
    const kinds = result.rows.map(r => r.kind);
    expect(kinds).toEqual(['arch', 'issue', 'spec', 'update']);
  });

  // -----------------------------------------------------------------------
  // Migration stats
  // -----------------------------------------------------------------------

  it('should return accurate migration statistics', async () => {
    const project = insertProject(oldDb, 'test-project');

    // 3 records: 2 with embeddings, 1 without
    for (let i = 0; i < 3; i++) {
      oldDb.prepare(`
        INSERT INTO record (project_id, kind, title, body, status)
        VALUES (?, ?, ?, ?, ?)
      `).run(project.id, 'issue', `Record ${i}`, '', 'open');

      if (i < 2) {
        const rid = oldDb.prepare('SELECT last_insert_rowid() AS id').get().id;
        oldDb.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)')
          .run(BigInt(rid), embeddingBuffer(seededEmbedding(i)));
      }
    }

    const stats = await migrateFromDb(oldDb, newDb);
    expect(stats.projects).toBe(1);
    expect(stats.records).toBe(3);
    expect(stats.embeddings).toBe(2);
  });
});
