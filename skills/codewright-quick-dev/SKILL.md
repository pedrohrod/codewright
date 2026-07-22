---
name: codewright-quick-dev
description: Diagnose and implement a small, well-bounded bug fix or hotfix without the full Codewright specification cycle. Use for "$codewright-quick-dev", "codewright quick-dev", legacy "codewright:quick-dev", quick fix, hotfix, or a reproducible localized bug. Do not use for ambiguous, cross-cutting, or architectural features.
---

# Codewright Quick Development

1. Capture expected behavior, actual behavior, reproduction steps, impact, and rollback constraints.
2. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, relevant code, tests, recent changes, and quick-development customization.
3. Reproduce the bug or establish a failing regression test before editing. If reproduction is impossible, state the uncertainty.
4. Make the smallest change that fixes the root cause and follows existing patterns.
5. Add a regression test and run focused plus required repository checks.
6. Review the diff for unintended scope, security impact, and compatibility.
7. Report root cause, changed behavior, tests, risks, and rollback. Do not commit or push without separate authorization.
