# codewright

> AI-assisted specification and implementation system for software development.

**IDEA → spec → architecture → stories → implementation → review**

[![npm version](https://img.shields.io/npm/v/codewright.svg)](https://www.npmjs.com/package/codewright)
[![license](https://img.shields.io/npm/l/codewright.svg)](https://github.com/codewright/codewright/blob/main/LICENSE)

---

## What is codewright?

codewright orchestrates the full software development lifecycle through AI agents:

1. **Spec** — Capture your idea, goals, and constraints
2. **Architecture** — Design decisions and system structure
3. **Stories** — Break down capabilities into implementable tasks
4. **Dev** — Implement with TDD (RED → GREEN → REFACTOR)
5. **Review** — Parallel code review with specialized agents

It supports **Codex, Claude Code, Gemini CLI, GitHub Copilot, OpenCode, Windsurf, Cline, and Cursor** from one canonical skill set.

## Installation

```bash
npm install -g codewright
```

Or use directly with npx:

```bash
npx codewright init
```

## Quick Start

### Initialize

```bash
npx codewright init
```

In an interactive terminal, choose one or more agents or select **all**. For automation:

```bash
npx codewright init --agents claude,cursor
npx codewright init --agents all
npx codewright init --agents core
```

Without an interactive terminal or `--agents`, Codewright installs the universal `.agents/skills` core only.

### Using with AI agents

After init, talk to the agent:

| You say | The agent does |
|---------|---------------|
| `$codewright-spec` | Creates a specification from your idea |
| `$codewright-architecture` | Generates architecture decisions |
| `$codewright-epic` | Breaks spec into epics and stories |
| `$codewright-story` | Creates stories with I/O Matrix |
| `$codewright-develop` | Orchestrates readiness → dev → quality → test → review |
| `$codewright-quality` | Analyzes maintainability with evidence |
| `$codewright-review` | Reviews a story against its contract |
| `$codewright-commit` | Previews and creates a scoped local commit |
| `$codewright-test` | Designs and implements meaningful tests |
| `$codewright-testgen` | Scaffolds TODO tests from story scenarios |
| `$codewright-perf` | Designs and analyzes approved performance tests |

| Agent | Native invocation | Installation |
|-------|-------------------|--------------|
| Codex | `$codewright-spec` | Universal core |
| Claude Code | `/codewright-spec` | `.claude/skills` adapter |
| Gemini CLI | Natural request / automatic | Universal core |
| GitHub Copilot | `/codewright-spec` or automatic | Universal core |
| OpenCode | Automatic | Universal core |
| Windsurf | `@codewright-spec` | Universal core |
| Cline | Automatic | `.cline/skills` adapter |
| Cursor | `/codewright-spec` | `.cursor/commands` adapter |

The adapters are small generated pointers. The workflow remains canonical in `.agents/skills`, so agent-specific copies cannot drift.

Skills follow the Agent Skills naming standard. Explicit invocation syntax varies by agent as shown above; legacy phrases such as `codewright:spec` remain recognized by the skill descriptions.

### Or use the CLI directly

```bash
codewright spec my-feature         # create spec
codewright story my-feature S001 "Login"  # create story
codewright dev my-feature S001      # start implementation
codewright review my-feature S001   # prepare review
codewright commit my-feature S001   # commit to feature branch
codewright status                   # project health
codewright help                     # list all skills by phase
```

## What codewright creates

Running `npx codewright init` creates:

```
your-project/
├── AGENTS.md                  # Discoverable project guidance (created only if absent)
├── .codewright/
│   ├── config.yaml          # Auto-detected stack & settings
│   ├── agents.yaml          # Selected agent targets
│   ├── config.user.yaml     # Your personal overrides (gitignored)
│   └── custom/              # Per-skill customization
├── .agents/skills/          # 25 AI agent skills
│   ├── codewright-spec/
│   ├── codewright-story/
│   ├── codewright-dev/
│   └── ... (22 more)
├── .claude/skills/          # Optional generated Claude adapters
├── .cline/skills/           # Optional generated Cline adapters
├── .cursor/commands/        # Optional generated Cursor commands
└── .codewright-output/      # Generated artifacts
    └── project-context.md   # Auto-generated project context
```

**Auto-detection:** The init command detects your framework, test runner, lint tools, and TypeScript strict mode from `package.json` and `tsconfig.json`.

### 2. Create a spec

```bash
npx codewright spec my-feature
```

### 3. Break into stories

```bash
npx codewright story my-feature S001 "Create user form"
```

### 4. Implement

```bash
npx codewright dev my-feature S001
```

### 5. Review

```bash
npx codewright review my-feature S001
```

## Commands

| Command | Description |
|---------|-------------|
| `codewright init` | Initialize project with skills and config |
| `codewright init --agents <list>` | Initialize for selected agents (`all` or comma-separated) |
| `codewright init --agents core` | Install only the universal Agent Skills core |
| `codewright spec <slug>` | Create a new specification |
| `codewright spec <slug> --update` | Re-derive SPEC.md from memlog |
| `codewright spec <slug> --input <file>` | Seed spec from existing document |
| `codewright spec <slug> --history` | View spec version history |
| `codewright spec <slug> --snapshot` | Create a version snapshot |
| `codewright spec <slug> --diff [from]` | Diff between spec versions |
| `codewright spec <slug> --sync` | Sync spec with code (compare requirements vs implementation) |
| `codewright story <spec>` | List stories for a spec |
| `codewright story <spec> <id> "<title>"` | Create a story |
| `codewright dev <spec> <id>` | Start implementing a story |
| `codewright review <spec> <id>` | Prepare code review |
| `codewright commit <spec> <id> --dry-run` | Preview a story-scoped commit |
| `codewright commit <spec> <id> --yes [--push]` | Create a local commit; push only when requested |
| `codewright perf [setup\|run] [k6\|artillery]` | Performance testing with k6 |
| `codewright context` | Regenerate project context |

## Skills

25 AI-powered skills installed automatically:

### Core Workflow
| Skill | Description |
|-------|-------------|
| `$codewright-spec` | Create traceable specifications from ideas |
| `$codewright-architecture` | Design architecture decisions |
| `$codewright-epic` | Break specs into value-oriented epics and stories |
| `$codewright-story` | Create implementation-ready stories |
| `$codewright-develop` | Orchestrate gated multi-story development |
| `$codewright-dev` | Implement a single story with TDD |
| `$codewright-review` | Review a story against its baseline and contract |
| `$codewright-commit` | Create a safe story-scoped commit |
| `$codewright-readiness` | Check if a story is ready to implement |

### Development Support
| Skill | Description |
|-------|-------------|
| `$codewright-quality` | Analyze maintainability with evidence |
| `$codewright-test` | Design and implement meaningful tests |
| `$codewright-testgen` | Scaffold TODO tests from I/O Matrix rows |
| `$codewright-refactor` | Improve structure while preserving behavior |
| `$codewright-quick-dev` | Fix small reproducible bugs |
| `$codewright-document` | Generate verified code and API documentation |
| `$codewright-retrospective` | Turn delivery evidence into actions |
| `$codewright-perf` | Design, run, and analyze approved load tests |
| `$codewright-rules` | Manage scoped project rules |
| `$codewright-init` | Safely initialize or upgrade Codewright |

### Operations
| Skill | Description |
|-------|-------------|
| `$codewright-context` | Refresh safe AI-readable project context |
| `$codewright-ci` | Generate and harden GitHub Actions CI |
| `$codewright-deps` | Audit dependency freshness and vulnerabilities |
| `$codewright-env` | Validate environment setup without revealing values |
| `$codewright-deploy` | Generate secure Docker configuration |
| `$codewright-hook` | Install, inspect, or remove Git hooks safely |

### How Skills Work

Skills are `.agents/skills/<name>/SKILL.md` files following the open Agent Skills format. Agents with native `.agents/skills` support load them directly. Claude, Cline, and Cursor use generated adapters that point back to the same canonical files. When you request "codewright spec", the selected agent loads the workflow and its resources only when needed.

## Living Specs & Rules

### Living Specs
Specs are not static documents — they evolve with your code:

```bash
codewright spec my-feature --history    # View version history
codewright spec my-feature --snapshot   # Create version snapshot
codewright spec my-feature --diff       # Compare versions
codewright spec my-feature --sync       # Check requirements vs implementation
```

### Project Rules
Keep project-specific rules in `.codewright/rules/`. These rules are automatically loaded by codewright skills during development.

```
.codewright/
├── rules/
│   ├── DEFAULT.md        # Main rules file
│   ├── testing.md        # Testing rules
│   └── style.md          # Code style rules
```

## Configuration

### Three-layer config (base → project → user)

```yaml
# .codewright/config.yaml (project settings)
project_name: my-app
stack: node
framework: next
test_runner: vitest
communication_language: en

# .codewright/config.user.yaml (your overrides, gitignored)
# Override any field here
```

### Customize per skill

```toml
# .codewright/custom/codewright-dev.toml
[workflow]
tdd_mode = true
auto_commit = false
```

## Output Structure

```
.codewright-output/
├── project-context.md
└── specs/
    └── spec-my-feature/
        ├── .memlog.md          # Decision log
        ├── SPEC.md             # Specification
        ├── architecture.md     # Architecture decisions
        ├── stories/
        │   ├── S001-create-form.md
        │   └── S002-add-validation.md
        └── reviews/
            └── review-S001.md
```

## Development

```bash
git clone https://github.com/codewright/codewright.git
cd codewright
npm install
npm run build
npm test
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
