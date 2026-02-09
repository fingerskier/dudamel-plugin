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

/** Return the raw adapter (must call initDb first). */
export function getDb() {
  return adapter;
}

/** @returns {{ id: number, name: string }} */
export function getCurrentProject() {
  return adapter.currentProject
    ? { id: adapter.currentProject.id, name: adapter.currentProject.name }
    : null;
}

export function listProjects() {
  return adapter.db.prepare('SELECT id, name, created_at, updated_at FROM project ORDER BY name').all();
}

export function getRecord(id) {
  const row = adapter.db.prepare(`
    SELECT r.*, p.name AS project
    FROM record r JOIN project p ON r.project_id = p.id
    WHERE r.id = ?
  `).get(id);
  return row ?? null;
}

export function listRecords({ kind, status, project } = {}) {
  let projectId;
  if (!project || project === 'current') {
    projectId = adapter.currentProject?.id;
  } else if (project !== '*') {
    const p = adapter.db.prepare('SELECT id FROM project WHERE name = ?').get(project);
    projectId = p?.id;
  }

  let sql = `
    SELECT r.id, r.kind, r.title, r.status, r.updated_at, p.name AS project
    FROM record r JOIN project p ON r.project_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (projectId) {
    sql += ' AND r.project_id = ?';
    params.push(projectId);
  }
  if (kind && kind !== 'all') {
    sql += ' AND r.kind = ?';
    params.push(kind);
  }
  if (status && status !== 'all') {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY r.updated_at DESC';

  return adapter.db.prepare(sql).all(...params);
}

export function deleteRecord(id) {
  const tx = adapter.db.transaction(() => {
    adapter.db.prepare('DELETE FROM record_embedding WHERE record_id = ?').run(id);
    const result = adapter.db.prepare('DELETE FROM record WHERE id = ?').run(id);
    return result.changes > 0;
  });
  return tx();
}

function embeddingBuffer(emb) {
  return Buffer.from(emb.buffer, emb.byteOffset, emb.byteLength);
}

export function searchRecords(embedding, { kind, limit = 5 } = {}) {
  const curProject = adapter.currentProject;

  let sql = `
    SELECT
      re.record_id, re.distance,
      r.id, r.kind, r.title, r.body, r.status,
      r.created_at, r.updated_at,
      p.name AS project
    FROM record_embedding re
    JOIN record r ON r.id = re.record_id
    JOIN project p ON r.project_id = p.id
    WHERE re.embedding MATCH ? AND k = ?
  `;
  const params = [embeddingBuffer(new Float32Array(embedding)), limit * 3];

  if (kind && kind !== 'all') {
    sql += ' AND r.kind = ?';
    params.push(kind);
  }
  sql += ' ORDER BY re.distance';

  let rows = adapter.db.prepare(sql).all(...params);

  rows = rows.map(row => {
    let similarity = 1 - row.distance;
    if (curProject && row.project === curProject.name) {
      similarity = Math.min(1.0, similarity + 0.1);
    }
    return { ...row, similarity };
  });

  return rows
    .filter(r => r.similarity >= 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ record_id, distance, ...rest }) => rest);
}

export function upsertRecord({ id, projectId, kind, title, body = '', status = 'open' }, embedding) {
  const proj = projectId ?? adapter.currentProject?.id;
  const now = new Date().toISOString();

  const tx = adapter.db.transaction(() => {
    if (id) {
      adapter.db.prepare(`
        UPDATE record SET kind = ?, title = ?, body = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(kind, title, body, status, now, id);

      adapter.db.prepare('DELETE FROM record_embedding WHERE record_id = ?').run(id);
      adapter.db.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)').run(BigInt(id), embeddingBuffer(embedding));

      return getRecord(id);
    }

    // Dedup check
    const candidates = adapter.db.prepare(`
      SELECT re.record_id, re.distance
      FROM record_embedding re
      JOIN record r ON r.id = re.record_id
      WHERE re.embedding MATCH ? AND k = 5
        AND r.project_id = ? AND r.kind = ?
      ORDER BY re.distance
      LIMIT 1
    `).all(embeddingBuffer(embedding), proj, kind);

    if (candidates.length > 0 && candidates[0].distance <= 0.15) {
      const existingId = candidates[0].record_id;
      adapter.db.prepare(`
        UPDATE record SET title = ?, body = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(title, body, status, now, existingId);

      adapter.db.prepare('DELETE FROM record_embedding WHERE record_id = ?').run(existingId);
      adapter.db.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)').run(BigInt(existingId), embeddingBuffer(embedding));

      return getRecord(existingId);
    }

    // Insert new record
    const result = adapter.db.prepare(`
      INSERT INTO record (project_id, kind, title, body, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(proj, kind, title, body, status, now, now);

    const newId = result.lastInsertRowid;
    adapter.db.prepare('INSERT INTO record_embedding (record_id, embedding) VALUES (?, ?)').run(BigInt(newId), embeddingBuffer(embedding));

    return getRecord(Number(newId));
  });

  return tx();
}

export function getRecentRecords(projectId, hours = 1) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return adapter.db.prepare(`
    SELECT r.id, r.kind, r.title, r.status, r.updated_at, p.name AS project
    FROM record r JOIN project p ON r.project_id = p.id
    WHERE r.project_id = ? AND r.updated_at > ?
    ORDER BY r.updated_at DESC
    LIMIT 10
  `).all(projectId, cutoff);
}
