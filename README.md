# Dude Claude Plugin
A context multiplier plug-in for Claude CLI

## Install

### npx (recommended)

Add MCP server config to Claude CLI settings (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "dude": {
      "command": "npx",
      "args": ["dude-claude-plugin", "mcp"]
    }
  }
}
```

### From source

1. Clone the repo
2. `npm install`
3. Add MCP server config:
   ```json
   {
     "mcpServers": {
       "dude": {
         "command": "node",
         "args": ["/path/to/dude-claude-plugin/bin/dude-claude.js", "mcp"]
       }
     }
   }
   ```
4. (Optional) Start the web UI: `npm run serve`

## Features

* Local sqlite database~ auto-create
* Save records for each project
  * by repo name (for Git)
  * by path (for non-Git)
* Each record gets a vector embedding
* Prior to a think
  * retrieve relevant records from db via semantic search
* After each think
  * If it's a fix upsert associated `issue`record(s)
  * if it's an improvement upsert associated `specification` record(s)
* Tools for Claude
  * search ~ semantic vector search
  * CRUD project
  * CRUD issue ~ per project
  * CRID specification ~ per project
  * 
* Local webserver to do manual CRUD

