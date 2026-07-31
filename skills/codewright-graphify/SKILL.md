---
name: codewright-graphify
description: "codewright:graphify Use $codewright-graphify for mandatory architectural analysis via Graphify before any code changes."
---

# Graphify Integration Skill

## Purpose

This skill teaches when and how to use Graphify for architectural analysis. Graphify provides a code knowledge graph that enables understanding of dependencies, call paths, and impact analysis WITHOUT reading every file.

## When Graphify is Required

Use Graphify BEFORE drawing conclusions about:
- Architecture and design patterns
- Dependency relationships
- Impact analysis for changes
- Call path tracing
- Symbol relationships across modules

## Commands

### Query - Ask architectural questions
```bash
graphify query "Which services call AppointmentRepository.save during booking creation?" --budget 4000
```

### Explain - Understand a specific symbol
```bash
graphify explain "CreateAppointmentService"
```

### Affected - Impact analysis
```bash
graphify affected "CreateAppointmentService" --depth 3
```

### Path - Find call paths between symbols
```bash
graphify path "AppointmentsController.create" "IAppointmentRepository.save"
```

### Status - Check graph state
```bash
graphify status
```

### Update - Refresh the graph
```bash
graphify update
```

## Query Quality

### Good queries (specific, bounded):
- "Which services call AppointmentRepository.save during booking creation?"
- "What controllers depend on AuthService?"
- "Show the dependency chain from API gateway to database"

### Bad queries (generic, unbounded):
- "Explain the whole project"
- "Find all bugs"
- "What is the architecture?"

## When to Update the Graph

- When graph is missing: run `graphify update`
- When graph is stale: run `graphify update`
- When major refactoring occurs: run `graphify update`

## Validation

Always verify Graphify conclusions against source code and tests. Graphify provides architectural insight, not proof of correctness.

## Unavailability

If Graphify is unavailable:
- In "off" mode: proceed without it
- In "advisory" mode: show warning, proceed with caution
- In "required" mode: STOP and report error before implementing

## Configuration

Configure Graphify in `.codewright/config.yaml`:

```yaml
graphify:
  enabled: true
  mode: advisory  # off, advisory, required
  command: graphify
  graph_path: graphify-out/graph.json
  query_budget: 4000
  update_policy: stale
```

See `AGENTS.md` for managed instructions and `.codewright/rules/*.md` for project-specific rules.
