#!/usr/bin/env node

/**
 * Stop hook — auto-persist records from conversation classification.
 * Reads classification JSON from stdin, upserts records as needed.
 * On malformed JSON or action=none, exits silently.
 */

import { embed } from '../src/embed.js';
import { initDb, upsertRecord, getCurrentProject } from '../src/db.js';

try {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString().trim();

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.stdout.write('Auto-persist skipped: malformed JSON from classification prompt\n');
    process.exit(0);
  }

  if (!input.action || input.action === 'none') {
    process.exit(0);
  }

  if (input.action === 'upsert') {
    const kind = input.kind || 'issue';
    const title = input.title || 'Untitled';
    const body = input.body || '';
    const status = input.status || 'open';

    await initDb();
    const text = `${title} ${body}`.trim();
    const embedding = await embed(text);

    const record = upsertRecord(
      {
        projectId: getCurrentProject().id,
        kind,
        title,
        body,
        status,
      },
      embedding,
    );

    process.stdout.write(`Auto-persisted ${kind}: "${record.title}" (id=${record.id})\n`);
  }
} catch (err) {
  // Non-blocking: exit cleanly on any error
  console.error(`[dude] auto-persist error: ${err.message}`);
  process.stdout.write(`Auto-persist skipped: ${err.message}\n`);
  process.exit(0);
}
