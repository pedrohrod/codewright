---
name: codewright:dev
description: "Implement a story following TDD"
phase: implementation
---

# Codewright Dev

## Activation
When the user says: "codewright dev", "implement story", "start story", "dev start"

## Operation
<workflow>
  <step n="1" goal="Load the story">
    <action>Read the story file (`.codewright-output/specs/spec-<name>/stories/<id>-<title>.md`)</action>
    <action>Confirm understanding: Intent, I/O Matrix, Code Map, Tasks</action>
  </step>
  <step n="2" goal="Start the story">
    <action>Run: `npx codewright dev <name> <id>`</action>
    <action>This marks the story as in-progress and records the baseline_commit</action>
  </step>
  <step n="3" goal="Implement RED phase">
    <action>Write tests first (unit + edge cases from I/O Matrix)</action>
    <action>Verify tests fail (RED)</action>
  </step>
  <step n="4" goal="Implement GREEN phase">
    <action>Write minimum code to pass tests</action>
    <action>Only implement what is in the Code Map</action>
    <action>Verify tests pass (GREEN)</action>
  </step>
  <step n="5" goal="REFACTOR phase">
    <action>Refactor code keeping tests green</action>
    <action>Improve names, extract functions, remove duplication</action>
  </step>
  <step n="6" goal="Mark tasks complete">
    <action>Update the story file: mark tasks as completed</action>
    <action>Add entry to Change Log</action>
  </step>
</workflow>

## Finalization
Story implemented. Status remains "in-progress". User should run `codewright review <name> <id>` for review.
