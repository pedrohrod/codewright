---
name: codewright:review
description: "Review implementation with parallel subagents"
---

# Codewright Review

## Activation
When the user says: "codewright review", "review", "code review", "review story"

## Operation
<workflow>
  <step n="1" goal="Prepare review">
    <action>Run: `npx codewright review prepare --spec <name> --story <id>`</action>
    <action>Generates diff from baseline_commit to HEAD and creates review file</action>
  </step>
  <step n="2" goal="Run parallel review (3 subagents)">
    <action>Spawn 3 reviewers in parallel:</action>
    <action>**Blind Hunter**: finds bugs, race conditions, null pointers, regressions</action>
    <action>**Edge Case Hunter**: verifies I/O Matrix covers all edge cases</action>
    <action>**Acceptance Auditor**: validates implementation meets story intent</action>
  </step>
  <step n="3" goal="Triage findings">
    <action>Classify each finding as:
      - **High**: blocks merge, must fix
      - **Medium**: should be fixed
      - **Low**: suggestion
    </action>
  </step>
  <step n="4" goal="Generate follow-up tasks">
    <action>Create tasks for each High/Medium finding</action>
    <action>Update the review file with results</action>
  </step>
</workflow>

## Finalization
Review complete. If no High items exist, story can be marked as "done" (update YAML frontmatter).
