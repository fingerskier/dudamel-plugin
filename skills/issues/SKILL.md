---
name: issues
description: "Track and manage issues using the dude MCP server. List, create, update issues. Track bugs, tasks, blockers, and problems within projects. Search for issues. Use when tracking bugs, creating tasks, managing blockers, recording problems, or working with issue hierarchies."
---

# Dude Issues - Issue Tracking

Track bugs, tasks, and blockers via the `dude:` MCP tools.

## Quick Start

```
dude:list_issues { "projectUuid": "..." }   - List project issues
dude:create_issue { "project_uuid": "...", "text": "BUG: ..." }
dude:search { "entityTypes": ["issue"] }    - Find issues
```

## Issue Operations

### Listing Issues
| Tool | Description |
|------|-------------|
| `dude:list_issues` | List issues for a project |

**Parameters:**
- `projectUuid` (required): Project UUID
- `parentUuid` (optional): Filter to children of parent issue

### Getting Issue Details
| Tool | Description |
|------|-------------|
| `dude:get_issue` | Get single issue details |

**Parameters:**
- `uuid` (required): Issue UUID

### Creating Issues
| Tool | Description |
|------|-------------|
| `dude:create_issue` | Create new issue |

**Parameters:**
- `project_uuid` (required): Project UUID
- `text` (required): Issue description
- `parent_issue_uuid` (optional): Parent issue for nesting

**Examples:**
```
dude:create_issue {
  "project_uuid": "...",
  "text": "BUG: Load cell readings drift after 2 hours"
}

dude:create_issue {
  "project_uuid": "...",
  "text": "TASK: Implement user authentication",
  "parent_issue_uuid": "parent-task-uuid"
}
```

### Updating Issues
| Tool | Description |
|------|-------------|
| `dude:update_issue` | Update existing issue |

**Parameters:**
- `uuid` (required): Issue UUID
- `text` (optional): New description
- `parent_issue_uuid` (optional, nullable): New parent (null for top-level)
- `complete` (optional): Set completion status (1 = complete, 0 = incomplete)

### Completing Issues
To mark an issue as complete:
```
dude:update_issue { "uuid": "...", "complete": 1 }
```

To reopen an issue:
```
dude:update_issue { "uuid": "...", "complete": 0 }
```

## Search for Issues

### Semantic Search
```
dude:search {
  "query": "memory leak in worker thread",
  "entityTypes": ["issue"],
  "projectUuid": "optional-project-uuid"
}
```

**Parameters:**
- `query` (required): Natural language search query
- `limit` (optional): Max results (default: 10)
- `threshold` (optional): Min similarity 0-1 (default: 0.3)
- `entityTypes` (optional): Filter to `["issue"]`
- `projectUuid` (optional): Scope to specific project

### Keyword Search
```
dude:search_text { "query": "BUG" }
```

**Parameters:**
- `query` (required): Text to search for

## Issue Conventions

Use prefixes to categorize issues:
- `BUG:` - Defects and errors
- `TASK:` - Work items
- `BLOCKER:` - Critical blockers
- `QUESTION:` - Unknowns needing resolution

## Related Skills

- **dude:projects**: Manage projects and get full project context
- **dude:specifications**: Document requirements and architecture

**Tip:** Use `dude:get_project_context` (from dude:projects) to see all issues for a project at once.
