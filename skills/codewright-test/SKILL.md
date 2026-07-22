---
name: codewright-test
description: Design, implement, and verify tests for existing code or a Codewright story using the project's actual framework. Use for "$codewright-test", "codewright test workflow", legacy "codewright:test", write tests, improve test coverage, integration tests, or regression tests. Do not use merely to scaffold tests from story matrices; use codewright-testgen for that.
---

# Codewright Test

1. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, source behavior, public interfaces, callers, existing tests, story I/O Matrix, and test customization.
2. Choose the lowest test level that proves the behavior: unit for isolated logic, integration for boundaries, and end-to-end for critical journeys.
3. Cover observable success, meaningful boundaries, errors, state transitions, and the regression being prevented.
4. Follow the repository's framework, fixtures, naming, and setup patterns. Avoid mocks that only verify implementation details.
5. Make each test deterministic, isolated, and capable of failing for the intended reason.
6. Run focused tests first, then required broader checks. Diagnose failures rather than weakening assertions.
7. Measure coverage only as supporting evidence; do not treat a percentage as proof of behavioral completeness.
8. Report scenarios covered, commands, results, limitations, and remaining risks.
