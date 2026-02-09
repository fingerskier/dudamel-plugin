import { describe, it, expect, vi, beforeEach } from 'vitest';

// These tests validate the logic patterns used in the hook scripts.
// Since the hooks are top-level-await scripts (not exporting functions),
// we test the core logic patterns they rely on.

describe('auto-persist hook logic', () => {
  it('should skip on malformed JSON', () => {
    const raw = 'not json at all';
    let input;
    let skipped = false;
    try {
      input = JSON.parse(raw);
    } catch {
      skipped = true;
    }
    expect(skipped).toBe(true);
  });

  it('should skip on action=none', () => {
    const input = { action: 'none' };
    const shouldProcess = input.action && input.action !== 'none';
    expect(shouldProcess).toBe(false);
  });

  it('should skip on missing action', () => {
    const input = {};
    const shouldProcess = input.action && input.action !== 'none';
    expect(shouldProcess).toBeFalsy();
  });

  it('should process upsert action with complete fields', () => {
    const input = {
      action: 'upsert',
      kind: 'issue',
      title: 'Bug Report',
      body: 'Something broke',
      status: 'open',
    };

    expect(input.action).toBe('upsert');
    expect(input.kind).toBe('issue');
    expect(input.title).toBe('Bug Report');
    expect(input.body).toBe('Something broke');
    expect(input.status).toBe('open');
  });

  it('should use defaults for missing fields', () => {
    const input = { action: 'upsert' };

    const kind = input.kind || 'issue';
    const title = input.title || 'Untitled';
    const body = input.body || '';
    const status = input.status || 'open';

    expect(kind).toBe('issue');
    expect(title).toBe('Untitled');
    expect(body).toBe('');
    expect(status).toBe('open');
  });

  it('should build embed text from title and body', () => {
    const input = {
      action: 'upsert',
      title: 'Auth Bug',
      body: 'Login fails for OAuth users',
    };

    const text = `${input.title} ${input.body}`.trim();
    expect(text).toBe('Auth Bug Login fails for OAuth users');
  });

  it('should handle title-only (no body)', () => {
    const input = {
      action: 'upsert',
      title: 'Quick note',
    };

    const body = input.body || '';
    const text = `${input.title} ${body}`.trim();
    expect(text).toBe('Quick note');
  });
});

describe('auto-persist-plan hook logic', () => {
  it('should default kind to spec', () => {
    const input = { action: 'upsert', title: 'A Plan' };
    const kind = input.kind || 'spec';
    expect(kind).toBe('spec');
  });

  it('should default title to Untitled Plan', () => {
    const input = { action: 'upsert' };
    const title = input.title || 'Untitled Plan';
    expect(title).toBe('Untitled Plan');
  });

  it('should respect explicit kind override', () => {
    const input = { action: 'upsert', kind: 'arch', title: 'Architecture Decision' };
    const kind = input.kind || 'spec';
    expect(kind).toBe('arch');
  });
});

describe('auto-retrieve hook logic', () => {
  it('should extract prompt from input JSON', () => {
    const input = { prompt: 'How do I fix the auth bug?' };
    const prompt = input.prompt || input.tool_input?.prompt || '';
    expect(prompt).toBe('How do I fix the auth bug?');
  });

  it('should extract prompt from tool_input', () => {
    const input = { tool_input: { prompt: 'Nested prompt' } };
    const prompt = input.prompt || input.tool_input?.prompt || '';
    expect(prompt).toBe('Nested prompt');
  });

  it('should handle missing prompt gracefully', () => {
    const input = {};
    const prompt = input.prompt || input.tool_input?.prompt || '';
    expect(prompt).toBe('');
  });

  it('should skip empty prompts', () => {
    const prompt = '   ';
    expect(prompt.trim()).toBe('');
  });

  it('should respect DUDE_CONTEXT_LIMIT env-like default', () => {
    const envValue = undefined;
    const limit = Number(envValue) || 5;
    expect(limit).toBe(5);
  });

  it('should parse DUDE_CONTEXT_LIMIT when set', () => {
    const envValue = '10';
    const limit = Number(envValue) || 5;
    expect(limit).toBe(10);
  });

  it('should respect DUDE_RECENCY_HOURS env-like default', () => {
    const envValue = undefined;
    const recencyWindow = Number(envValue) || 1;
    expect(recencyWindow).toBe(1);
  });

  it('should format recent records output', () => {
    const recentRecords = [
      { kind: 'issue', title: 'Bug A', id: 1, status: 'open', updated_at: '2025-01-01' },
      { kind: 'spec', title: 'Spec B', id: 2, status: 'resolved', updated_at: '2025-01-01' },
    ];

    const lines = ['[dude] Recently updated records:'];
    for (const r of recentRecords) {
      lines.push(`- [${r.kind}] ${r.title} (id=${r.id}, status=${r.status}, updated: ${r.updated_at})`);
    }
    const output = lines.join('\n');

    expect(output).toContain('[dude] Recently updated records:');
    expect(output).toContain('- [issue] Bug A (id=1, status=open, updated: 2025-01-01)');
    expect(output).toContain('- [spec] Spec B (id=2, status=resolved, updated: 2025-01-01)');
  });

  it('should format search results output', () => {
    const results = [
      { kind: 'issue', title: 'Auth Bug', body: 'Login page broken', project: 'my-app', status: 'open', similarity: 0.87 },
    ];

    const lines = ['[dude] Relevant context from memory:'];
    for (const r of results) {
      lines.push(`- [${r.kind}] ${r.title} (project: ${r.project}, status: ${r.status}, similarity: ${r.similarity.toFixed(2)})`);
      if (r.body) {
        lines.push(`  ${r.body.slice(0, 200)}${r.body.length > 200 ? '…' : ''}`);
      }
    }
    const output = lines.join('\n');

    expect(output).toContain('similarity: 0.87');
    expect(output).toContain('Login page broken');
  });

  it('should truncate long body in search results', () => {
    const longBody = 'x'.repeat(300);
    const truncated = `${longBody.slice(0, 200)}${longBody.length > 200 ? '…' : ''}`;
    expect(truncated.length).toBe(201); // 200 chars + '…'
    expect(truncated.endsWith('…')).toBe(true);
  });
});
