---
name: review-spec
description: "Interactive specification review session. Pulls all specs and architecture decisions for the current project and walks through them with the user to verify accuracy, update, or archive. Use when reviewing technical documentation, validating architecture decisions, or cleaning up outdated specs."
---

# Dude Review Specs - Interactive Spec Review

Walk through all specifications and architecture decisions for the current project with the user.

## Workflow

When this skill is invoked, follow these steps **in order**:

### Step 1: Fetch Specs

Call these in parallel:

```
dude:list_records { "kind": "spec", "status": "open" }
dude:list_records { "kind": "arch", "status": "open" }
dude:list_records { "kind": "spec", "status": "archived" }
```

### Step 2: Present Summary

Show the user a summary of what exists:
- Total active specs
- Total active architecture decisions
- Total archived specs
- Group active records by prefix: **AUTH**, **API**, **ARCH**, **DATA**, **UI**, **Other**
- List each active record with its ID, kind, and title

### Step 3: Walk Through Active Specs

For each active spec, present it (including body if present) and ask the user:

1. **Still accurate?** — If not, ask what changed and update it
2. **Outdated?** — If yes, archive it
3. **Needs refinement?** — If yes, ask for updates
4. **Keep as-is?** — Move on

Apply changes immediately using:

```
dude:upsert_record { "id": <record_id>, "kind": "spec", "title": "<updated_title>", "body": "<updated_body>", "status": "<new_status>" }
```

### Step 4: Walk Through Architecture Decisions

Repeat the same review for `arch` records. Architecture decisions tend to be longer-lived, so focus on:
- Is the decision still valid given current codebase state?
- Has the implementation drifted from the decision?

### Step 5: New Specs

Ask the user if there are any new specifications or architecture decisions to capture based on the current state of the project. If yes, create them:

```
dude:upsert_record { "kind": "spec", "title": "API: <description>", "body": "<details>" }
dude:upsert_record { "kind": "arch", "title": "ARCH: <description>", "body": "<details>" }
```

### Step 6: Summary

Present a final summary of all changes made during the session:
- Specs updated
- Specs archived
- Architecture decisions updated
- New records created

## Tools Used

| Tool | Purpose |
|------|---------|
| `dude:list_records` | Fetch specs/arch records by kind and status |
| `dude:upsert_record` | Update or create records |
| `dude:search` | Find related specs if needed |

## Related Skills

- **dude:review-issues**: Review and groom issues
- **dude:specifications**: CRUD reference for spec operations
