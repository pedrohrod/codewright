---
name: codewright-hook
description: Inspect, install, or remove Codewright Git hooks while preserving existing hook behavior. Use for "$codewright-hook", "codewright hook", legacy "codewright:hook", pre-commit setup, commit-message validation, or hook diagnostics. Do not overwrite or disable existing hooks silently.
---

# Codewright Hooks

1. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, `.git/hooks`, `.codewright/hooks`, repository scripts, and hook customization.
2. Run `npx codewright hook list` before changing anything.
3. Preview the exact hooks, checks, blocking behavior, and existing-hook chaining.
4. Install only after explicit approval. Back up existing hooks, chain them in a deterministic order, and propagate non-zero exit codes.
5. Validate commit messages against Conventional Commits without rejecting repository-approved additional types.
6. Support `npx codewright hook uninstall` to remove only Codewright-managed wiring and restore preserved hooks.
7. Test installed hooks with passing and failing fixtures, then report paths, backups, and results.
