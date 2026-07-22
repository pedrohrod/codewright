---
name: codewright-testgen
description: Scaffold test cases from Codewright story I/O Matrix rows for later implementation. Use for "$codewright-testgen", "codewright testgen", legacy "codewright:testgen", generate test skeletons from a spec, or convert story scenarios into tests. Do not claim generated TODO tests verify behavior; use codewright-test to implement them.
---

# Codewright Test Generator

1. Load the selected stories, I/O Matrix rows, Code Map, applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, project test framework, and generation customization.
2. Run `npx codewright test <spec> [story-id]`.
3. Map each valid scenario to a clearly named test skeleton and retain source story/scenario traceability.
4. Generate executable assertions only when imports, invocation, input, and expected output can be derived unambiguously.
5. Otherwise generate the framework's explicit TODO or skipped marker; never use an always-passing placeholder assertion.
6. Preserve existing test files unless overwrite is explicitly requested and previewed.
7. Report created files, implemented versus TODO scenarios, parse failures, and the command needed to complete and run the tests.
