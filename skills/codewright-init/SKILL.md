---
name: codewright-init
description: Initialize or safely upgrade Codewright project structure, configuration, rules, and the full skill suite. Use for "$codewright-init", "codewright init", legacy "codewright:init", set up Codewright, install project skills, or refresh bundled skills. Do not overwrite existing project guidance or edited skills without a preview and approval.
---

# Codewright Init

1. Inspect the project root, existing `AGENTS.md`, `.agents/skills`, `.codewright` configuration, manifests, lockfiles, and Git status.
2. For a new setup, run `npx codewright init` and review detected language, framework, test runner, lint tools, and generated paths.
3. Create root `AGENTS.md` only when absent. If it exists, preserve it and rely on each skill to load `.codewright/rules/*.md`.
4. Never expose or commit local configuration secrets. Ensure user overrides and environment files are ignored.
5. For an existing installation, use the explicit upgrade mode, preview every changed managed file, preserve customization, and back up edited installed skills before replacement.
6. Validate all installed skills and report installed, upgraded, preserved, and failed items.
7. Run project context generation only after configuration and skills validate.
