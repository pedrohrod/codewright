---
name: codewright-rules
description: Inspect, add, revise, or validate project-specific Codewright agent rules. Use for "$codewright-rules", "codewright rules", legacy "codewright:rules", manage project guidance, codify recurring review feedback, or check rules against the repository. Do not add vague preferences or duplicate enforced tooling.
---

# Codewright Rules

1. Read root and nested `AGENTS.md` plus every applicable `.codewright/rules/*.md` file in precedence order.
2. Identify whether the requested behavior belongs in a prompt, project rule, nested rule, tool configuration, hook, or test.
3. Write rules that are scoped, imperative, verifiable, and paired with the correct commands or examples.
4. Put guidance in the narrowest applicable location and avoid repeating content already enforced by formatters, linters, or tests.
5. Present rule changes and affected scopes before writing when they materially change team workflow.
6. Validate that updated rules do not conflict and that every referenced command exists.
7. Report the precedence chain, changes, enforcement mechanism, and any unresolved conflict.
