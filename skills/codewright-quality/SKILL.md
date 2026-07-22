---
name: codewright-quality
description: Perform an evidence-based Codewright maintainability and code-quality review of a requested change or scope. Use for "$codewright-quality", "codewright quality", legacy "codewright:quality", code smells, complexity, naming, duplication, or SOLID analysis. Do not treat style preferences as correctness defects.
---

# Codewright Quality

1. Resolve the review scope from the user, story Code Map, or baseline diff; never silently review the entire repository.
2. Read applicable guidance, tests, types, callers, and quality customization before judging the code.
3. Check duplication, cohesion, coupling, naming, control-flow complexity, error handling, dead code, and unnecessary abstraction.
4. Report only evidence-backed findings with severity, `file:line`, impact, and the smallest reasonable remediation.
5. Distinguish correctness or maintainability risk from optional style preferences. Avoid arbitrary time estimates.
6. Run existing static-analysis tools when configured and preserve their exact results.
7. Summarize findings by severity, note clean areas, and recommend refactoring only when benefits exceed added complexity.
