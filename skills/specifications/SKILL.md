---
name: specifications
description: "Document specifications using the dude MCP server. List, create, update specifications. Record requirements, architecture decisions, API contracts, design patterns. Search for specs. Use when documenting requirements, recording architecture decisions, writing API specs, capturing design patterns, or managing technical documentation."
---

# Dude Specifications - Technical Documentation

Document requirements and architecture via the `dude:` MCP tools.

## Quick Start

```
dude:list_specifications { "projectUuid": "..." }   - List specs
dude:create_specification { "project_uuid": "...", "text": "..." }
dude:search { "entityTypes": ["specification"] }    - Find specs
```

## Specification Operations

### Listing Specifications
| Tool | Description |
|------|-------------|
| `dude:list_specifications` | List specs for a project |

**Parameters:**
- `projectUuid` (required): Project UUID
- `parentUuid` (optional): Filter to children of parent spec

### Getting Specification Details
| Tool | Description |
|------|-------------|
| `dude:get_specification` | Get single spec details |

**Parameters:**
- `uuid` (required): Specification UUID

### Creating Specifications
| Tool | Description |
|------|-------------|
| `dude:create_specification` | Create new specification |

**Parameters:**
- `project_uuid` (required): Project UUID
- `text` (required): Specification content
- `parent_specification_uuid` (optional): Parent spec for nesting

**Examples:**
```
dude:create_specification {
  "project_uuid": "...",
  "text": "AUTH: JWT tokens with 24h expiry. Refresh handled in authMiddleware.js"
}

dude:create_specification {
  "project_uuid": "...",
  "text": "API: POST /users returns 201 with user object on success"
}
```

### Updating Specifications
| Tool | Description |
|------|-------------|
| `dude:update_specification` | Update existing spec |

**Parameters:**
- `uuid` (required): Specification UUID
- `text` (optional): New content
- `parent_specification_uuid` (optional, nullable): New parent (null for top-level)
- `valid` (optional): Set validity status (1 = valid, 0 = invalid/deprecated)

### Invalidating Specifications
To mark a specification as invalid/deprecated:
```
dude:update_specification { "uuid": "...", "valid": 0 }
```

To restore validity:
```
dude:update_specification { "uuid": "...", "valid": 1 }
```

## Search for Specifications

### Semantic Search
```
dude:search {
  "query": "authentication flow JWT tokens",
  "entityTypes": ["specification"],
  "projectUuid": "optional-project-uuid"
}
```

**Parameters:**
- `query` (required): Natural language search query
- `limit` (optional): Max results (default: 10)
- `threshold` (optional): Min similarity 0-1 (default: 0.3)
- `entityTypes` (optional): Filter to `["specification"]`
- `projectUuid` (optional): Scope to specific project

### Keyword Search
```
dude:search_text { "query": "API" }
```

**Parameters:**
- `query` (required): Text to search for

## Specification Conventions

Use prefixes to categorize:
- `AUTH:` - Authentication/authorization
- `API:` - API contracts
- `ARCH:` - Architecture decisions
- `DATA:` - Data models/schemas
- `UI:` - User interface patterns

## Related Skills

- **dude:projects**: Manage projects and get full project context
- **dude:issues**: Track bugs and tasks

**Tip:** Use `dude:get_project_context` (from dude:projects) to see all specs for a project at once.
