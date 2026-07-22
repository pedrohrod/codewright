---
name: codewright-spec
description: Create, refine, version, or synchronize a Codewright product specification and memlog. Use for "$codewright-spec", "codewright spec", legacy "codewright:spec", turn an idea into a spec, update requirements, inspect spec history, or compare a spec with implementation. Do not choose unresolved product intent silently.
---

# Codewright Specification

1. Load applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, existing spec artifacts, project context, related source material, and spec customization.
2. Establish the problem, audience, desired outcome, capabilities, constraints, non-goals, success signals, and unresolved questions.
3. Run `npx codewright spec <slug>` for a new spec or `--update` after changing the memlog.
4. Record atomic memlog entries as capabilities, constraints, decisions, questions, or notes with stable identifiers and sources.
5. Make every capability observable and testable without prescribing implementation unless it is a genuine constraint.
6. Preserve conflicting or unresolved input as explicit questions. Confirm decisions that materially change scope.
7. Validate requirement uniqueness, traceability, non-goals, compatibility, and measurable completion.
8. Use history, diff, snapshot, or sync operations only for the requested purpose; obtain confirmation before any Git commit.
9. Report created or changed artifacts, decisions, open questions, and the next readiness step.
