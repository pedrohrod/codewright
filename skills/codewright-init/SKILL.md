---
name: codewright-init
description: Initialize or safely upgrade Codewright project structure, configuration, rules, and the full skill suite. Use for "$codewright-init", "codewright init", legacy "codewright:init", set up Codewright, install project skills, or refresh bundled skills. Do not overwrite existing project guidance or edited skills without a preview and approval.
---

# Codewright Init

1. Inspect the project root, existing `AGENTS.md`, `.agents/skills`, `.codewright/rules/*.md`, agent-specific directories, configuration, manifests, lockfiles, and Git status.
2. For a new interactive setup, run `npx codewright init` and select one or more supported agents or all agents. For automation, pass `--agents <comma-separated-targets>`, `--agents all`, or `--agents core`.
3. Create root `AGENTS.md` only when absent. If it exists, preserve it and rely on each skill to load `.codewright/rules/*.md`.
4. Never expose or commit local configuration secrets. Ensure user overrides and environment files are ignored.
5. Keep `.agents/skills` canonical. Generate native adapters only for selected agents, preserve user-authored collisions, and record selections in `.codewright/agents.yaml`.
6. For an existing installation, use the explicit upgrade mode, preview every changed managed file, preserve customization, and back up edited installed skills and adapters before replacement.
7. Validate all installed skills and report installed, upgraded, preserved, and failed items.
8. Run project context generation only after configuration, canonical skills, and adapters validate.
