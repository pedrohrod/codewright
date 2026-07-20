---
name: codewright:story
description: "Create implementation stories from a SPEC"
---

# Codewright Story

## Activation
When the user says: "codewright story", "create story", "story", "break into tasks"

## Operation
<workflow>
  <step n="1" goal="Load the SPEC">
    <action>Read the SPEC.md from the selected spec</action>
    <action>List all capabilities</action>
  </step>
  <step n="2" goal="Break capabilities into stories">
    <action>For each capability, identify 1-N stories</action>
    <action>Breakdown criteria:
      - Each story delivers incremental value
      - Story has testable scope
      - Dependencies between stories are clear
    </action>
  </step>
  <step n="3" goal="Create each story">
    <action>For each story, run:
      `npx codewright story create --spec <name> --id <id> --title "<title>"`
    </action>
    <action>Manually fill in the generated file:
      - I/O Matrix with scenarios and edge cases
      - Code Map (files to create/modify/delete)
      - Tasks and subtasks
      - Boundaries & Constraints
    </action>
  </step>
  <step n="4" goal="Define dependencies">
    <action>Identify which story depends on which</action>
    <action>Document in the `companions` field of SPEC.md</action>
  </step>
</workflow>

## Finalization
Stories created. Use `npx codewright story list --spec <name>` to view all stories.
