---
name: projects
description: "Manage development projects using the dude MCP server. List, create, update projects. Get full project context with issues and specifications. Search for projects. Use when working with project organization, project hierarchies, starting work on a codebase, or needing project-level context."
---

# Dude Projects - Project Management

Manage development projects via the `dude:` MCP tools.

## Quick Start

```
dude:list_projects              - List all projects
dude:get_project_context        - Full project with issues/specs
dude:search { "entityTypes": ["project"] }  - Find projects
```

## Project Operations

### Listing Projects
| Tool | Description |
|------|-------------|
| `dude:list_projects` | List all projects or filter by parent |

**Parameters:**
- `parentUuid` (optional): Filter to children of parent project

### Getting Project Details
| Tool | Description |
|------|-------------|
| `dude:get_project` | Get single project details |
| `dude:get_project_context` | Get project with ALL issues and specs |

**get_project Parameters:**
- `uuid` (required): Project UUID

**get_project_context Parameters:**
- `uuid` (required): Project UUID
- `includeSubprojects` (optional): Include child projects (default: false)

### Creating Projects
| Tool | Description |
|------|-------------|
| `dude:create_project` | Create new project |

**Parameters:**
- `name` (required): Project name
- `directory` (optional): Project directory path
- `parent_project_uuid` (optional): Parent project for nesting

### Updating Projects
| Tool | Description |
|------|-------------|
| `dude:update_project` | Update existing project |

**Parameters:**
- `uuid` (required): Project UUID
- `name` (optional): New name
- `directory` (optional): New directory path
- `parent_project_uuid` (optional, nullable): New parent (null for top-level)
- `active` (optional): Set active status (1 = active, 0 = inactive)

### Archiving Projects
To archive a project (soft delete), set the `active` flag to 0:
```
dude:update_project { "uuid": "...", "active": 0 }
```

To reactivate:
```
dude:update_project { "uuid": "...", "active": 1 }
```

## Search for Projects

### Semantic Search
```
dude:search {
  "query": "authentication service",
  "entityTypes": ["project"],
  "limit": 5
}
```

**Parameters:**
- `query` (required): Natural language search query
- `limit` (optional): Max results (default: 10)
- `threshold` (optional): Min similarity 0-1 (default: 0.3)
- `entityTypes` (optional): Filter to `["project"]`
- `projectUuid` (optional): Scope to specific project

### Keyword Search
```
dude:search_text { "query": "auth" }
```

**Parameters:**
- `query` (required): Text to search for

## Common Workflows

### Starting Work on a Codebase
1. `dude:list_projects` - Find the project UUID
2. `dude:get_project_context` - Load full context
3. Begin coding with awareness of existing issues/specs

### Organizing Projects
```
dude:create_project { "name": "Frontend", "parent_project_uuid": "parent-uuid" }
```

## Related Skills

- **dude:issues**: Create and manage issues within projects
- **dude:specifications**: Create and manage specifications within projects
