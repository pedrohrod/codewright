# codewright

Open-source AI-assisted specification and implementation system.

**IDEA → spec → architecture → stories → implementation → review**

## Installation

```bash
npm install -g codewright
# or
npx codewright init
```

## Quick Start

```bash
npx codewright init
```

This creates:

| Directory / File | Purpose |
|---|---|
| `.codewright/config.yaml` | Project configuration |
| `.codewright/AGENTS.md` | Agent instructions |
| `.codewright-output/` | Generated artifacts (specs, stories, reviews) |
| `.codewright-output/project-context.md` | Auto-generated project context |
| `.agents/skills/` | Installed agent skills |

## Commands

### `codewright init [--dir .]`
Initialize codewright structure in your project.
Installs all skills into `.agents/skills/` and auto-generates project context.

### `codewright spec create --slug <name> [--input <file>]`
Create a new specification with memlog.
The `--input` flag reads an existing document as seed.

### `codewright spec update --slug <name>`
Re-derive SPEC.md from memlog entries.

### `codewright story create --spec <name> --id <id> --title "<title>" [--phase <n>]`
Create an implementation story with I/O Matrix template.

### `codewright story list --spec <name>`
List all stories of a spec.

### `codewright context generate`
Scan the project and generate `project-context.md`.

### `codewright dev start --spec <name> --story <id>`
Mark a story as in-progress and register baseline commit.

### `codewright review prepare --spec <name> --story <id>`
Generate diff and review checklist for a story.

## Skills

Skills are automatically installed into `.agents/skills/` when you run `codewright init`. Each skill is in its own subdirectory:

```
.agents/skills/
├── codewright-init/SKILL.md
├── codewright-spec/SKILL.md
├── codewright-architecture/SKILL.md
├── codewright-story/SKILL.md
├── codewright-dev/SKILL.md
└── codewright-review/SKILL.md
```

### Flow

1. **codewright:init** — Setup tooling and context
2. **codewright:spec** — Create a specification from an idea
3. **codewright:architecture** — Design architecture from a spec
4. **codewright:story** — Break spec into implementation stories
5. **codewright:dev** — Implement a story (TDD: RED → GREEN → REFACTOR)
6. **codewright:review** — Review implementation with parallel subagents

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
