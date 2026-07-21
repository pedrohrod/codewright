---
name: codewright:rules
description: "Manage project rules — add, list, review project-specific guidelines for agents"
phase: operations
---

# Codewright Rules

## Activation
When the user says: "codewright rules", "manage rules", "add rule", "project rules", "update rules"

## Operation
<workflow>
  <step n="1" goal="Read current rules">
    <action>Read all files from `.codewright/rules/`</action>
    <action>List existing rules files with descriptions</action>
  </step>
  <step n="2" goal="Ask what to do">
    <action>Options:
      - Add a new rule
      - Edit an existing rule
      - Review rules against current code
      - Sync with spec requirements
    </action>
  </step>
  <step n="3" goal="Add or edit rules">
    <action>Create or update `.codewright/rules/DEFAULT.md` with the new rule</action>
    <action>Ensure rules are clear, concise, and actionable</action>
  </step>
  <step n="4" goal="Review rules">
    <action>Check each rule applies to the current code</action>
    <action>Suggest code changes to match rules if needed</action>
  </step>
</workflow>

## Finalization
Rules saved. Remind the user that rules are loaded automatically by codewright skills during development.
