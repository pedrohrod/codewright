---
name: codewright-refactor
description: Safely improve existing code structure while preserving observable behavior. Use for "$codewright-refactor", "codewright refactor", legacy "codewright:refactor", reduce duplication or complexity, extract responsibilities, or apply a justified design pattern. Do not force patterns onto simple code or mix feature behavior into a refactor.
---

# Codewright Refactor

1. Define the exact smell, desired improvement, behavioral boundary, and success measure.
2. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, callers, tests, types, quality findings, and refactor customization.
3. Establish a passing safety net for current behavior. Add characterization tests when coverage is insufficient.
4. Propose the smallest structural change and explain alternatives only when the trade-off is material.
5. Apply one coherent transformation at a time and run focused tests after each step.
6. Prefer extraction, simplification, and dependency-boundary improvements over introducing a named pattern.
7. Run required full checks and compare public behavior, performance-sensitive paths, and serialized interfaces.
8. Report the smell removed, structural changes, verification, and any intentionally deferred cleanup.
