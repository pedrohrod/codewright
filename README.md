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

It works with **Verboo Code**, **Claude Code**, or any AI agent that loads skills from `.agents/skills/`.

## Installation

```bash
npm install -g codewright
```

Or use directly with npx:

```bash
npx codewright init
```

## Quick Start

### 1. Initialize your project

```bash
npx codewright init
```

This creates:

```
your-project/
├── .codewright/
│   ├── config.yaml          # Auto-detected stack & settings
│   ├── config.user.yaml     # Your personal overrides (gitignored)
│   ├── AGENTS.md            # Rules for AI agents
│   └── custom/              # Per-skill customization
├── .agents/skills/          # 13 AI agent skills
│   ├── codewright-spec/
│   ├── codewright-story/
│   ├── codewright-dev/
│   └── ... (10 more)
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
| `codewright context` | Regenerate project context |

## Skills

16 AI-powered skills installed automatically:

### Core Workflow
| Skill | Description |
|-------|-------------|
| `codewright:spec` | Create specifications from ideas |
| `codewright:architecture` | Design architecture decisions |
| `codewright:epic` | Break spec into epics and stories (faster spec-to-implementation) |
| `codewright:story` | Break capabilities into stories |
| `codewright:develop` | **Orchestrate full workflow** — readiness → dev → quality → test → review |
| `codewright:dev` | Implement a single story (TDD) |
| `codewright:review` | Parallel code review (3 reviewers) |
| `codewright:readiness` | Check if story is ready to implement |

### Development Support
| Skill | Description |
|-------|-------------|
| `codewright:quality` | Analyze code quality (SOLID, DRY, naming) |
| `codewright:test` | Generate tests (unit, integration, fixtures) |
| `codewright:refactor` | Apply design patterns (Strategy, Factory, etc.) |
| `codewright:quick-dev` | Rapid bug fixes and hotfixes |
| `codewright:document` | Generate JSDoc, README, API docs |
| `codewright:retrospective` | Sprint review and lessons learned |
| `codewright:rules` | Manage project rules (add, list, review) |
| `codewright:init` | Project setup and initialization |

### How Skills Work

Skills are `.agents/skills/<name>/SKILL.md` files that guide AI agents through workflows. When you say "codewright spec" to an agent, it loads the skill and follows the defined steps.

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
