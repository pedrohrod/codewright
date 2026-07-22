---
name: codewright-dev
description: Implement one ready Codewright story with evidence-driven TDD and scope control. Use for "$codewright-dev", "codewright dev", legacy "codewright:dev", implement this story, start story development, or continue an in-progress story. Do not use for unscoped feature work or automatic pushing.
---

# Codewright Dev

1. Load the story, spec, architecture, applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, project context, customization, and current Git status.
2. Run the readiness workflow. Stop on missing acceptance behavior, ambiguous boundaries, unresolved dependencies, or an incomplete Code Map.
3. Run `npx codewright dev <spec> <id>` to record the baseline and mark the story in progress.
4. Map every I/O Matrix row to a test. Add a failing test first and capture the expected failure.
5. Implement the smallest change inside the Code Map that makes the test pass. Follow repository patterns and avoid unrelated cleanup.
6. Refactor only with tests green, then run the repository's required focused and full checks.
7. Review the baseline diff for correctness, security, regressions, error handling, and story acceptance. Resolve High findings.
8. Update task checkboxes, Code Map drift, status to `review`, and the changelog with verified evidence.
9. Do not commit or push unless the user separately authorizes the commit workflow.
