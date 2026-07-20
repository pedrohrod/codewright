---
name: codewright:readiness
description: "Check if a story is ready for implementation"
---

# Codewright Readiness

## Activation
When the user says: "codewright readiness", "check readiness", "is story ready", "readiness check", "ready to implement"

## Operation
<workflow>
  <step n="1" goal="Load the story">
    <action>Read the story file from `.codewright-output/specs/spec-<name>/stories/<id>-<title>.md`</action>
  </step>
  <step n="2" goal="Validate story completeness">
    <action>Check each field:
      - [ ] `id` is set
      - [ ] `spec` references an existing spec
      - [ ] Intent has both Problem and Approach filled in
      - [ ] Boundaries & Constraints are defined (Always, Ask First, Never)
      - [ ] I/O Matrix has at least 3 scenarios
      - [ ] Code Map lists all files to be changed
      - [ ] Tasks are defined with actionable descriptions
    </action>
    <action>For each missing field, mark as FAIL or PARTIAL</action>
  </step>
  <step n="3" goal="Check dependencies">
    <action>Verify referenced companion specs/stories exist</action>
    <action>Check if dependent stories are done</action>
  </step>
  <step n="4" goal="Generate readiness report">
    <action>Overall verdict: PASS | PARTIAL | FAIL</action>
    <action>List missing/incomplete fields</action>
    <action>Suggest actions to reach PASS</action>
  </step>
</workflow>

## Finalization
Readiness report presented. If PARTIAL or FAIL, suggest running `codewright:story` to fill gaps.
