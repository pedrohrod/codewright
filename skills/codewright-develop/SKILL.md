---
name: codewright-develop
description: 'Orchestrate the complete Codewright workflow across multiple stories: readiness, TDD implementation, quality, testing, refactoring, review, and optional approved commits. Use for "$codewright-develop", "codewright develop", legacy "codewright:develop", develop a spec, or implement all ready stories. Do not silently skip failed gates or auto-push.'
---

# Codewright Develop

1. Load the spec, architecture, stories, dependencies, applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, project context, Git state, and orchestration customization.
2. Show stories by status and dependency order. Confirm the starting story when more than one path is valid.
3. For each selected story:
   - Run readiness and stop or skip with a recorded reason on failure.
   - Run the single-story development workflow using RED, GREEN, and REFACTOR evidence.
   - Run quality and test checks; fix Critical findings and failing required tests.
   - Refactor only when findings justify it and keep checks green.
   - Review the baseline diff and resolve all High findings.
4. After each story, show completed gates, changed files, checks, findings, and remaining stories.
5. Before any commit, show the commit dry-run and obtain explicit approval. Push only when explicitly requested.
6. Stop on the configured critical gate; never convert an unknown or skipped check into success.
7. Finish with a retrospective summary of delivered capabilities, deferred work, risks, and evidence.
