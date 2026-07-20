---
name: codewright:spec
description: "Create or update specifications using memlog"
---

# Codewright Spec

## Activation
When the user says: "codewright spec", "create spec", "specification", "spec"

## Operation
<workflow>
  <step n="1" goal="Understand the idea">
    <action>Ask the user about the idea, problem to solve, and business context</action>
    <action>Extract: system goal, expected capabilities, known constraints</action>
  </step>
  <step n="2" goal="Initialize memlog">
    <action>Run `npx codewright spec <name>`</action>
  </step>
  <step n="3" goal="Populate memlog with entries">
    <action>Add entries to memlog based on the conversation:
      - (capability) CAP-1: capability description
      - (constraint) non-negotiable rule
      - (decision) architectural decision
      - (question) open point
    </action>
  </step>
  <step n="4" goal="Derive SPEC.md">
    <action>Run `npx codewright spec <name> --update` to re-derive SPEC.md from memlog</action>
  </step>
  <step n="5" goal="Self-validation">
    <action>Validate that SPEC.md contains:
      - Why (business problem)
      - Capabilities (at least 1)
      - Constraints
      - Non-goals
      - Success signal
    </action>
    <action>If something is missing, ask the user</action>
  </step>
</workflow>

## Finalization
Spec created and validated. Ask if the user wants to generate architecture (`codewright:architecture`) or stories (`codewright:story`).
