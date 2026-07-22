---
name: codewright-readiness
description: Determine whether a Codewright story is implementation-ready using artifact, dependency, acceptance, and repository checks. Use for "$codewright-readiness", "codewright readiness", legacy "codewright:readiness", is this story ready, or validate a story before development. Do not implement the story.
---

# Codewright Readiness

1. Load the story, parent spec, architecture, companion stories, applicable guidance, project context, and readiness customization.
2. Validate unique ID, valid status, existing spec reference, clear problem and approach, explicit boundaries, and actionable tasks.
3. Require testable I/O Matrix scenarios covering success, relevant boundaries, and failures; use the configured minimum only as a floor.
4. Confirm every planned file is represented in the Code Map and every dependency exists in an acceptable state.
5. Trace acceptance behavior to spec capabilities and flag scope not justified by the spec.
6. Return `PASS` only when implementation can start without a product or architecture decision. Use `PARTIAL` for bounded gaps and `FAIL` for blockers.
7. Report each gap with evidence, required owner or action, and the shortest path to PASS.
