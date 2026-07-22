---
name: codewright-story
description: Create or revise implementation-ready Codewright stories from an approved specification and architecture. Use for "$codewright-story", "codewright story", legacy "codewright:story", create a story, break a capability into tasks, or list stories for a spec. Do not create stories without traceability to user or operator value.
---

# Codewright Story

1. Load the spec, architecture, existing stories, applicable guidance, source patterns, and story customization.
2. Select a capability-sized increment that produces a demonstrable outcome and has no dependency on unfinished future behavior.
3. Run `npx codewright story <spec> <id> "<title>"` and complete the generated artifact.
4. Define problem, approach, Always/Ask First/Never boundaries, dependencies, and requirement IDs.
5. Add I/O Matrix rows for success, boundaries, invalid input, dependency failure, and relevant state transitions.
6. Build a Code Map from repository inspection; label files CREATE, MODIFY, or DELETE and avoid speculative files.
7. Write ordered, verifiable tasks that map to I/O scenarios and Code Map entries.
8. Run readiness and revise until blockers are explicit. Report traceability, dependencies, and remaining questions.
