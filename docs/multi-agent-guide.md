# Multi-agent Setup and Management

## Overview

Codewright supports running multiple AI agents simultaneously, allowing you to leverage the strengths of different agents for different parts of your workflow. This guide explains how to set up, manage, and use multiple agents.

## Supported Agents

Codewright currently supports the following AI agents:

| Agent | Installation | Invocation |
|-------|--------------|------------|
| Claude Code | `.claude/skills` adapter | `/codewright-spec` |
| Codex | Universal core | `$codewright-spec` |
| Gemini CLI | Universal core | Natural request |
| GitHub Copilot | Universal core | `/codewright-spec` |
| OpenCode | Universal core | Automatic |
| Windsurf | Universal core | `@codewright-spec` |
| Cline | `.cline/skills` adapter | Automatic |
| Cursor | `.cursor/commands` adapter | `/codewright-spec` |

## Installation

### Initial Setup

```bash
# Install all supported agents
codewright init --agents all

# Install specific agents
codewright init --agents claude,cursor

# Install only the universal core (works with any agent)
codewright init --agents core
```

### Adding Agents to Existing Projects

```bash
# Add a new agent to your project
codewright agents add claude
codewright agents add cursor
```

## Management Commands

### Listing Installed Agents

```bash
codewright agents list
```

Output example:
```
Installed Agents:
  ✓ claude (active)
  ✓ cursor
  ✓ codex
  ✗ gemini (not installed)
```

### Setting the Default Agent

```bash
codewright agents set claude
```

### Removing an Agent

```bash
codewright agents remove cursor
```

### Repairing Agent Configuration

```bash
codewright agents repair
codewright agents repair claude
```

### Health Check

```bash
codewright agents doctor
```

Output example:
```
Agent Health Check:
  claude: ✓ Healthy
  cursor: ✓ Healthy
  codex: ✓ Healthy
  gemini: ✗ Not installed
```

## How Multi-agent Works

### Canonical Skill Location

All skills are stored in `.agents/skills/` in the universal Agent Skills format. Agent-specific adapters (`.claude/skills/`, `.cursor/commands/`, etc.) are small generated pointers that reference the canonical files.

This ensures:
1. **Single Source of Truth**: Skills are maintained in one place
2. **No Drift**: Agent-specific copies cannot become outdated
3. **Universal Compatibility**: Any agent can use the same skills

### Agent Selection

When you run a Codewright command, the system:

1. Checks if you've specified an agent with `--agent <name>`
2. Falls back to the default agent set via `codewright agents set`
3. Uses the first available agent if no default is set

## Workflow Examples

### Using Different Agents for Different Tasks

```bash
# Use Claude for architecture decisions
codewright architecture my-feature --agent claude

# Use Cursor for code review
codewright review my-feature S001 --agent cursor

# Use Codex for implementation
codewright dev my-feature S001 --agent codex
```

### Parallel Agent Execution

When running `codewright develop`, different agents can handle different stages:

- **Claude**: Architecture and planning
- **Cursor**: Code implementation
- **Codex**: Testing and validation
- **Copilot**: Documentation generation

## Configuration

### Per-Agent Configuration

You can configure each agent individually in `.codewright/agents.yaml`:

```yaml
agents:
  claude:
    enabled: true
    default: true
    config:
      model: claude-3-opus
      max_tokens: 4096
  
  cursor:
    enabled: true
    config:
      inline_suggestions: true
  
  codex:
    enabled: true
    config:
      model: gpt-4
```

### Global Agent Settings

```yaml
# .codewright/config.yaml
agent_settings:
  timeout: 300000  # 5 minutes
  retry_count: 3
  parallel_execution: true
```

## Troubleshooting

### Agent Not Found

```bash
# Check what's installed
codewright agents list

# Reinstall the agent
codewright agents remove <agent>
codewright agents add <agent>
```

### Adapter Not Generated

```bash
# Regenerate adapters
codewright agents repair
```

### Conflicting Agents

If agents are conflicting, check your configuration:

```bash
codewright agents doctor --verbose
```

## Best Practices

1. **Start with Core**: Begin with `codewright init --agents core` and add agents as needed
2. **Set Default**: Set your primary agent with `codewright agents set`
3. **Regular Health Checks**: Run `codewright agents doctor` periodically
4. **Keep Adapters Updated**: Run `codewright agents repair` after updating agents

## Advanced: Custom Agent Adapters

You can create custom adapters for agents not natively supported:

1. Create the adapter directory: `.custom-agent/skills/`
2. Add adapter files that point to `.agents/skills/`
3. Register the adapter in `.codewright/agents.yaml`
