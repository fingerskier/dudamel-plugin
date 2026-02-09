import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

describe('migration 001-initial', () => {
  it('should create project, record, and record_embedding tables', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);

    const migration = await import('../src/migrations/001-initial.js');
    expect(migration.version).toBe(1);

    migration.up(db);

    // Verify project table
    const projectInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'project'").get();
    expect(projectInfo).toBeDefined();
    expect(projectInfo.sql).toContain('name');
    expect(projectInfo.sql).toContain('UNIQUE');

    // Verify record table
    const recordInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'record'").get();
    expect(recordInfo).toBeDefined();
    expect(recordInfo.sql).toContain('project_id');
    expect(recordInfo.sql).toContain('kind');
    expect(recordInfo.sql).toContain('title');
    expect(recordInfo.sql).toContain("IN ('issue', 'spec')");

    // Verify index
    const indexInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_record_project_kind'").get();
    expect(indexInfo).toBeDefined();

    // Verify record_embedding virtual table
    const embInfo = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'record_embedding'").get();
    expect(embInfo).toBeDefined();
    expect(embInfo.sql).toContain('vec0');
    expect(embInfo.sql).toContain('FLOAT[384]');
    expect(embInfo.sql).toContain('cosine');

    db.close();
  });

  it('should allow inserting a project', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);
    const migration = await import('../src/migrations/001-initial.js');
    migration.up(db);

    db.prepare('INSERT INTO project (name) VALUES (?)').run('my-project');
    const p = db.prepare('SELECT * FROM project WHERE name = ?').get('my-project');
    expect(p.name).toBe('my-project');

    db.close();
  });

  it('should allow inserting a record with embedding', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);
    const migration = await import('../src/migrations/001-initial.js');
    migration.up(db);

    db.prepare('INSERT INTO project (name) VALUES (?)').run('my-project');
    const project = db.prepare('SELECT * FROM project WHERE name = ?').get('my-project');

    db.prepare(`
      INSERT INTO record (project_id, kind, title, body, status, created_at, updated_at)
      VALUES (?, 'issue', 'Test', 'body', 'open', datetime('now'), datetime('now'))
    `).run(project.id);

    const record = db.prepare('SELECT * FROM record').get();
    expect(record.kind).toBe('issue');
    expect(record.title).toBe('Test');

    // Insert embedding
    const emb = new Float32Array(384);
    const buf = Buffer.from(emb.buffer, emb.byteOffset, emb.byteLength);
    db.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)').run(
      BigInt(record.id), buf,
    );

    db.close();
  });

  it('should reject invalid kinds in v1 schema', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);
    const migration = await import('../src/migrations/001-initial.js');
    migration.up(db);

    db.prepare('INSERT INTO project (name) VALUES (?)').run('p');

    expect(() => {
      db.prepare(`
        INSERT INTO record (project_id, kind, title, created_at, updated_at)
        VALUES (1, 'arch', 'test', datetime('now'), datetime('now'))
      `).run();
    }).toThrow(); // 'arch' is not in v1's CHECK constraint

    db.close();
  });
});

describe('migration 002-expand-kinds', () => {
  it('should expand kind CHECK to include arch and update', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);

    // Run v1 first
    const m1 = await import('../src/migrations/001-initial.js');
    m1.up(db);

    // Insert data before migration
    db.prepare('INSERT INTO project (name) VALUES (?)').run('test-project');
    db.prepare(`
      INSERT INTO record (project_id, kind, title, created_at, updated_at)
      VALUES (1, 'issue', 'Pre-migration', datetime('now'), datetime('now'))
    `).run();

    // Run v2
    const m2 = await import('../src/migrations/002-expand-kinds.js');
    expect(m2.version).toBe(2);
    m2.up(db);

    // Verify pre-existing data survived migration
    const existing = db.prepare("SELECT * FROM record WHERE title = 'Pre-migration'").get();
    expect(existing).toBeDefined();
    expect(existing.kind).toBe('issue');

    // Verify new kinds are now allowed
    db.prepare(`
      INSERT INTO record (project_id, kind, title, created_at, updated_at)
      VALUES (1, 'arch', 'Architecture Decision', datetime('now'), datetime('now'))
    `).run();

    db.prepare(`
      INSERT INTO record (project_id, kind, title, created_at, updated_at)
      VALUES (1, 'update', 'Feature Update', datetime('now'), datetime('now'))
    `).run();

    const all = db.prepare('SELECT * FROM record ORDER BY id').all();
    expect(all).toHaveLength(3);
    expect(all.map(r => r.kind)).toEqual(['issue', 'arch', 'update']);

    db.close();
  });

  it('should still enforce valid kinds after v2', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);

    const m1 = await import('../src/migrations/001-initial.js');
    m1.up(db);
    const m2 = await import('../src/migrations/002-expand-kinds.js');
    m2.up(db);

    db.prepare('INSERT INTO project (name) VALUES (?)').run('p');

    expect(() => {
      db.prepare(`
        INSERT INTO record (project_id, kind, title, created_at, updated_at)
        VALUES (1, 'invalid', 'Bad Kind', datetime('now'), datetime('now'))
      `).run();
    }).toThrow();

    db.close();
  });

  it('should preserve the index after migration', async () => {
    const db = new Database(':memory:');
    sqliteVec.load(db);

    const m1 = await import('../src/migrations/001-initial.js');
    m1.up(db);
    const m2 = await import('../src/migrations/002-expand-kinds.js');
    m2.up(db);

    const idx = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'idx_record_project_kind'").get();
    expect(idx).toBeDefined();
    expect(idx.sql).toContain('project_id');
    expect(idx.sql).toContain('kind');

    db.close();
  });
});

describe('migration sequencing', () => {
  it('should have sequential version numbers', async () => {
    const m1 = await import('../src/migrations/001-initial.js');
    const m2 = await import('../src/migrations/002-expand-kinds.js');

    expect(m1.version).toBe(1);
    expect(m2.version).toBe(2);
    expect(m2.version).toBe(m1.version + 1);
  });
});
