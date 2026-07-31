# CLI Command Reference

## Global Options

| Option | Description |
|--------|-------------|
| `--help` | Show help message |
| `--version` | Show version number |
| `--verbose` | Enable verbose logging |
| `--json` | Output in JSON format |
| `--dry-run` | Preview changes without executing |
| `--yes` | Skip confirmation prompts |

## Core Commands

### codewright init

Initialize a new Codewright project.

```bash
codewright init [options]
```

**Options:**
- `--agents <list>`: Specify agents (e.g., `claude,cursor` or `all`)
- `--graphify-mode <mode>`: Set Graphify mode (`off`, `advisory`, `required`)
- `--dry-run`: Preview initialization without making changes
- `--yes`: Skip confirmation prompts

**Examples:**
```bash
codewright init --agents claude,cursor
codewright init --agents all --graphify-mode required
codewright init --dry-run
codewright init --agents all --graphify-mode required --yes
```

### codewright doctor

Check system health and dependencies.

```bash
codewright doctor [options]
```

**Options:**
- `--json`: Output in JSON format
- `--fix`: Attempt to fix issues automatically
- `--dry-run`: Preview fixes without applying them

**Examples:**
```bash
codewright doctor
codewright doctor --json
codewright doctor --fix
codewright doctor --verbose
```

## Specification Commands

### codewright spec

Create and manage specifications.

```bash
codewright spec <slug> [options]
```

**Options:**
- `--update`: Re-derive SPEC.md from memlog
- `--input <file>`: Seed spec from existing document
- `--history`: View spec version history
- `--snapshot`: Create a version snapshot
- `--diff [from]`: Diff between spec versions
- `--sync`: Sync spec with code

**Examples:**
```bash
codewright spec my-feature
codewright spec my-feature --update
codewright spec my-feature --input requirements.md
codewright spec my-feature --history
codewright spec my-feature --snapshot
codewright spec my-feature --diff v1.0
codewright spec my-feature --sync
```

## Story Commands

### codewright story

Create and manage stories.

```bash
codewright story <spec> [options]
```

**Options:**
- `<id> "<title>"`: Create a new story
- `--list`: List all stories for a spec

**Examples:**
```bash
codewright story my-feature
codewright story my-feature S001 "Create user form"
```

## Development Commands

### codewright dev

Start implementing a story.

```bash
codewright dev <spec> <id> [options]
```

**Options:**
- `--agent <name>`: Use specific agent
- `--tdd`: Enable TDD mode

**Examples:**
```bash
codewright dev my-feature S001
codewright dev my-feature S001 --agent claude
```

### codewright develop

Orchestrate gated multi-story development.

```bash
codewright develop <spec> [options]
```

**Options:**
- `--agent <name>`: Use specific agent
- `--parallel`: Enable parallel execution

### codewright quick-dev

Fix small reproducible bugs.

```bash
codewright quick-dev <spec> <id> [options]
```

### codewright refactor

Improve structure while preserving behavior.

```bash
codewright refactor <spec> <id> [options]
```

## Review Commands

### codewright review

Prepare code review.

```bash
codewright review <spec> <id> [options]
```

**Options:**
- `--agent <name>`: Use specific agent

## Commit Commands

### codewright commit

Create a story-scoped commit.

```bash
codewright commit <spec> <id> [options]
```

**Options:**
- `--dry-run`: Preview commit without creating it
- `--yes`: Skip confirmation
- `--push`: Push to remote after commit

**Examples:**
```bash
codewright commit my-feature S001 --dry-run
codewright commit my-feature S001 --yes
codewright commit my-feature S001 --yes --push
```

## Graph Commands

### codewright graph

Manage the project knowledge graph.

```bash
codewright graph <command> [options]
```

**Subcommands:**
- `status`: Check graph health
- `update`: Rebuild the graph
- `query <question>`: Query the graph
- `explain <file>`: Explain file relationships
- `affected --since <ref>`: Find affected files
- `path <file1> <file2>`: Find path between files

**Examples:**
```bash
codewright graph status
codewright graph update
codewright graph query "What is affected by changing AuthContext?"
codewright graph explain src/auth/AuthContext.tsx
codewright graph affected --since last-commit
codewright graph path src/auth/login.tsx src/payment/checkout.tsx
```

## Agent Commands

### codewright agents

Manage agent configurations.

```bash
codewright agents <command> [options]
```

**Subcommands:**
- `list`: List installed agents
- `add <agent>`: Add a new agent
- `remove <agent>`: Remove an agent
- `set <agent>`: Set default agent
- `repair`: Repair agent configuration
- `doctor`: Check agent health

**Examples:**
```bash
codewright agents list
codewright agents add claude
codewright agents remove cursor
codewright agents set claude
codewright agents repair
codewright agents doctor
```

## Development Support Commands

### codewright quality

Analyze maintainability with evidence.

```bash
codewright quality <spec> <id> [options]
```

### codewright test

Design and implement meaningful tests.

```bash
codewright test <spec> <id> [options]
```

### codewright testgen

Scaffold TODO tests from I/O Matrix rows.

```bash
codewright testgen <spec> <id> [options]
```

### codewright document

Generate verified code and API documentation.

```bash
codewright document <spec> [options]
```

### codewright perf

Design, run, and analyze approved load tests.

```bash
codewright perf [setup|run] [k6|artillery] [options]
```

## Operations Commands

### codewright context

Refresh safe AI-readable project context.

```bash
codewright context [options]
```

### codewright ci

Generate and harden GitHub Actions CI.

```bash
codewright ci [options]
```

### codewright deps

Audit dependency freshness and vulnerabilities.

```bash
codewright deps [options]
```

### codewright env

Validate environment setup without revealing values.

```bash
codewright env [options]
```

### codewright deploy

Generate secure Docker configuration.

```bash
codewright deploy [options]
```

### codewright hook

Install, inspect, or remove Git hooks safely.

```bash
codewright hook [install|remove|list] [options]
```

### codewright rules

Manage scoped project rules.

```bash
codewright rules [list|add|remove] [options]
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid usage or missing arguments |
| 3 | Configuration error |
| 4 | Agent or tool not found |
| 5 | Permission denied |

## Examples

```bash
# Initialize with all agents and Graphify
codewright init --agents all --graphify-mode required --dry-run
codewright init --agents all --graphify-mode required --yes

# Check system health
codewright doctor

# Check graph status
codewright graph status

# Query the graph
codewright graph query "What is affected by changing AuthContext?"

# Check agent health
codewright agents doctor

# Create a specification
codewright spec my-feature

# Create a story
codewright story my-feature S001 "Create user form"

# Implement a story
codewright dev my-feature S001

# Review a story
codewright review my-feature S001

# Commit changes
codewright commit my-feature S001 --dry-run
codewright commit my-feature S001 --yes
```
