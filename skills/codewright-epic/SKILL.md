---
name: codewright-epic
description: Decompose an approved Codewright specification or PRD into user-value epics, implementation-ready stories, and requirement traceability. Use for "$codewright-epic", "codewright epic", legacy "codewright:epic", break down this spec, create epics, or map requirements to stories. Do not organize epics solely by technical layer.
---

# Codewright Epic

1. Load the spec or supplied PRD, architecture, applicable guidance, and epic customization.
2. Extract numbered functional and non-functional requirements, constraints, non-goals, actors, and unresolved questions. Confirm material ambiguities.
3. Group requirements into epics that each deliver an observable user or operator outcome.
4. Create small, independently testable stories in dependency order with actor and value, Given/When/Then acceptance criteria, boundaries, and requirement IDs.
5. Avoid forward dependencies, cross-story partial states, and stories that exist only to create a technical layer.
6. Produce a coverage matrix from every requirement to at least one story and flag duplicates or gaps.
7. Write `epics.md` and create story files through `npx codewright story <spec> <id> "<title>"` when requested.
8. Report epic and story counts, uncovered requirements, dependencies, and readiness blockers.
