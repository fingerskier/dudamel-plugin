---
name: review-issues
description: "Interactive issue review and grooming session. Pulls all issues for the current project and walks through them with the user to triage, update, resolve, or archive. Use when grooming a backlog, reviewing open issues, or cleaning up stale tasks."
---

# Dude Review Issues - Interactive Grooming

Walk through all issues for the current project with the user.

## Workflow

When this skill is invoked, follow these steps **in order**:

### Step 1: Fetch Issues

Call these in parallel:

```
dude:list_records { "kind": "issue", "status": "open" }
dude:list_records { "kind": "issue", "status": "resolved" }
```

### Step 2: Present Summary

Show the user a summary of what exists:
- Total open issues
- Total resolved issues
- Group open issues by prefix: **BUG**, **TASK**, **BLOCKER**, **QUESTION**, **Other**
- List each open issue with its ID and title

### Step 3: Walk Through Open Issues

For each open issue, present it and ask the user:

1. **Still relevant?** — If not, mark as archived
2. **Needs update?** — If yes, ask for the new description
3. **Resolved?** — If yes, mark as resolved
4. **Keep as-is?** — Move on

Apply changes immediately using:

```
dude:upsert_record { "id": <issue_id>, "kind": "issue", "title": "<updated_title>", "status": "<new_status>" }
```

### Step 4: Review Resolved Issues (Optional)

Ask the user if they want to review recently resolved issues. If yes, walk through them and ask:
- Should this be archived (cleaned up)?
- Should this be reopened?

### Step 5: New Issues

Ask the user if there are any new issues to capture. If yes, create them:

```
dude:upsert_record { "kind": "issue", "title": "TASK: <description>", "body": "<details>" }
```

### Step 6: Summary

Present a final summary of all changes made during the session:
- Issues resolved
- Issues archived
- Issues updated
- New issues created

## Tools Used

| Tool | Purpose |
|------|---------|
| `dude:list_records` | Fetch issues by kind and status |
| `dude:upsert_record` | Update or create issues |
| `dude:search` | Find related issues if needed |

## Related Skills

- **dude:review-spec**: Review and update specifications
- **dude:issues**: CRUD reference for issue operations
