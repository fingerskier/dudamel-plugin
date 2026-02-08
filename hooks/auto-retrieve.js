#!/usr/bin/env node

/**
 * UserPromptSubmit hook — auto-retrieve relevant records.
 * Reads the user prompt from stdin JSON, embeds it, searches the DB,
 * and writes formatted context to stdout for Claude to see.
 */

import { embed } from '../src/embed.js';
import { initDb, searchRecords, getCurrentProject, getRecentRecords } from '../src/db.js';

try {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const prompt = input.prompt || input.tool_input?.prompt || '';

  if (!prompt.trim()) {
    process.exit(0);
  }

  await initDb();
  const embedding = await embed(prompt);
  const limit = Number(process.env.DUDE_CONTEXT_LIMIT) || 5;
  const results = searchRecords(embedding, { limit });

  if (results.length === 0) {
    process.exit(0);
  }

  // Format context for Claude
  const lines = ['[dude] Relevant context from memory:\n'];
  for (const r of results) {
    lines.push(`- [${r.kind}] ${r.title} (project: ${r.project}, status: ${r.status}, similarity: ${r.similarity.toFixed(2)})`);
    if (r.body) {
      lines.push(`  ${r.body.slice(0, 200)}${r.body.length > 200 ? '…' : ''}`);
    }
  }
  process.stdout.write(lines.join('\n') + '\n');
} catch (err) {
  // Non-blocking: exit cleanly on any error
  console.error(`[dude] auto-retrieve error: ${err.message}`);
  process.exit(0);
}
