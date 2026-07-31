# Graphify Integration Guide

## Overview

Graphify is an optional integration for Codewright that builds a comprehensive knowledge graph of your project's codebase, documentation, and structure. This graph provides AI agents with deep context about your project, enabling more accurate and relevant assistance.

## Installation

### During Initialization

The easiest way to enable Graphify is during project initialization:

```bash
codewright init --graphify-mode required
codewright init --graphify-mode advisory
```

### Adding to Existing Projects

If you've already initialized your project, you can enable Graphify later:

```bash
codewright graph enable --mode required
```

## Configuration

### Graphify Modes

Graphify operates in three distinct modes:

#### 1. Off (Default)

Graphify is disabled and does not run. This is the default mode for projects that do not require codebase understanding.

```yaml
# .codewright/config.yaml
graphify:
  mode: off
```

#### 2. Advisory

In advisory mode, Graphify builds and maintains a knowledge graph but does not block workflows if the graph is missing or outdated. AI agents will use the graph when available but can operate without it.

```yaml
# .codewright/config.yaml
graphify:
  mode: advisory
  auto_update: true
```

#### 3. Required

In required mode, Graphify must be built and maintained for all AI workflows. Workflows will fail if the graph is not available or is significantly outdated.

```yaml
# .codewright/config.yaml
graphify:
  mode: required
  auto_update: true
  staleness_threshold: 24h
```

## Usage

### Checking Graph Status

```bash
codewright graph status
```

Output example:
```
Graphify Status: Healthy
Nodes: 1,247
Edges: 3,892
Last Updated: 2026-07-30 14:32:15
Staleness: Fresh
```

### Updating the Graph

```bash
codewright graph update
```

### Querying the Graph

You can query the graph using natural language:

```bash
codewright graph query "What is affected by changing AuthContext?"
codewright graph query "Show me all files related to user authentication"
codewright graph query "What are the dependencies of the UserService?"
```

### Explaining Relationships

```bash
codewright graph explain src/auth/AuthContext.tsx
```

### Finding Affected Files

```bash
codewright graph affected --since last-commit
```

### Path Analysis

```bash
codewright graph path src/auth/login.tsx src/payment/checkout.tsx
```

## Update Policies

### Automatic Updates

When enabled, Graphify automatically updates during:
- `codewright dev` (before implementation starts)
- `codewright review` (before code review)
- `codewright spec --sync` (when syncing specs with code)

### Manual Updates

You can manually trigger updates at any time:

```bash
codewright graph update
```

### Staleness Detection

Graphify tracks when the graph was last updated and compares it against the project's file modification times. If the graph is older than the configured `staleness_threshold`, it is considered stale.

## Integration with AI Agents

When Graphify is enabled, AI agents automatically receive graph context during workflows:

1. **Spec Creation**: Graph context helps agents understand existing codebase structure
2. **Architecture Design**: Agents can see current dependencies and patterns
3. **Implementation**: Agents get precise impact analysis for changes
4. **Review**: Reviewers can verify changes against the full dependency graph

## Troubleshooting

### Graph Not Building

```bash
# Check status for errors
codewright graph status --json

# Force rebuild
codewright graph update --force
```

### Slow Performance

For large codebases, you can optimize Graphify:

```yaml
# .codewright/config.yaml
graphify:
  mode: advisory
  exclude:
    - "node_modules/**"
    - "dist/**"
    - "*.test.ts"
  max_nodes: 10000
```

### Resetting the Graph

To completely reset the graph:

```bash
codewright graph reset
codewright graph update
```

## Configuration Reference

```yaml
graphify:
  mode: off | advisory | required
  auto_update: boolean (default: true)
  staleness_threshold: string (e.g., "24h", "7d")
  exclude:
    - "glob pattern"
  include:
    - "glob pattern"
  max_nodes: number
  output_dir: string (default: ".codewright/graph")
```
