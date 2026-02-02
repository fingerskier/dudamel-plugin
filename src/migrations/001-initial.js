export const version = 1;

export function up(db) {
  db.exec(`
    CREATE TABLE project (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE record (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES project(id) ON DELETE CASCADE,
      kind       TEXT    NOT NULL CHECK (kind IN ('issue', 'spec')),
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL DEFAULT '',
      status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_record_project_kind ON record(project_id, kind);

    CREATE VIRTUAL TABLE record_embedding USING vec0(
      record_id  INTEGER PRIMARY KEY,
      embedding  FLOAT[384] distance_metric=cosine
    );
  `);
}
