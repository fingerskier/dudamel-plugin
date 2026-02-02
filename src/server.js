import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { embed } from './embed.js';
import {
  initDb,
  getCurrentProject,
  searchRecords,
  upsertRecord,
  getRecord,
  listRecords,
  listProjects,
  deleteRecord,
} from './db.js';

export async function startServer() {
  await initDb();

  const server = new McpServer({
    name: 'dude',
    version: '1.0.0',
  });

  // ---- search ----
  server.tool(
    'search',
    'Semantic search across records (issues & specs). Returns cross-project results ranked by similarity.',
    {
      query: z.string().describe('Natural language search query'),
      kind: z.enum(['issue', 'spec', 'all']).optional().describe('Filter by record kind'),
      project: z.string().optional().describe('Project name to boost; "*" for equal weight'),
      limit: z.number().int().positive().optional().describe('Max results (default 5)'),
    },
    async ({ query, kind, project, limit }) => {
      const embedding = await embed(query);
      const results = searchRecords(embedding, { kind, limit });
      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // ---- upsert_record ----
  server.tool(
    'upsert_record',
    'Create or update a record. If id is provided, updates that record. Otherwise inserts with dedup.',
    {
      id: z.number().int().optional().describe('Record ID to update (omit for new)'),
      kind: z.enum(['issue', 'spec']).describe('Record kind'),
      title: z.string().describe('Short summary'),
      body: z.string().optional().describe('Full description'),
      status: z.enum(['open', 'resolved', 'archived']).optional().describe('Defaults to open'),
    },
    async ({ id, kind, title, body, status }) => {
      const text = `${title} ${body || ''}`.trim();
      const embedding = await embed(text);
      const record = upsertRecord(
        { id, projectId: getCurrentProject().id, kind, title, body: body || '', status: status || 'open' },
        embedding,
      );
      return {
        content: [{ type: 'text', text: JSON.stringify(record, null, 2) }],
      };
    },
  );

  // ---- get_record ----
  server.tool(
    'get_record',
    'Get a record by ID.',
    {
      id: z.number().int().describe('Record ID'),
    },
    async ({ id }) => {
      const record = getRecord(id);
      if (!record) {
        return { content: [{ type: 'text', text: `Record ${id} not found.` }], isError: true };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(record, null, 2) }],
      };
    },
  );

  // ---- list_records ----
  server.tool(
    'list_records',
    'List records with optional filters.',
    {
      kind: z.enum(['issue', 'spec', 'all']).optional().describe('Filter by kind'),
      status: z.enum(['open', 'resolved', 'archived', 'all']).optional().describe('Filter by status'),
      project: z.string().optional().describe('Project name, or "*" for all'),
    },
    async ({ kind, status, project }) => {
      const records = listRecords({ kind, status, project });
      return {
        content: [{ type: 'text', text: JSON.stringify(records, null, 2) }],
      };
    },
  );

  // ---- delete_record ----
  server.tool(
    'delete_record',
    'Delete a record by ID.',
    {
      id: z.number().int().describe('Record ID to delete'),
    },
    async ({ id }) => {
      const deleted = deleteRecord(id);
      return {
        content: [{ type: 'text', text: deleted ? `Record ${id} deleted.` : `Record ${id} not found.` }],
      };
    },
  );

  // ---- list_projects ----
  server.tool(
    'list_projects',
    'List all known projects.',
    {},
    async () => {
      const projects = listProjects();
      return {
        content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
      };
    },
  );

  // Start transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[dude] MCP server running on stdio');
}
