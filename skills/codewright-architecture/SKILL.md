---
name: codewright:architecture
description: "Generate architecture spine from a SPEC"
---

# Codewright Architecture

## Activation
When the user says: "codewright architecture", "architecture", "architecture spine"

## Operation
<workflow>
  <step n="1" goal="Load the SPEC">
    <action>Read the SPEC.md from the selected spec</action>
    <action>Identify capabilities, constraints, and decisions already made</action>
  </step>
  <step n="2" goal="Decide coaching vs fast path">
    <action>Ask the user:
      - **Coaching path**: guided, step by step (recommended for learning)
      - **Fast path**: generates complete architecture at once
    </action>
  </step>
  <step n="3" goal="Generate Architecture Decisions (ADs)">
    <action>For each AD, document:
      - **AD-N**: title
      - **Status:** proposed | accepted | deprecated
      - **Context:** forces at play
      - **Decision:** the choice
      - **Consequences:** trade-offs
    </action>
    <action>Number ADs sequentially: AD-1, AD-2, etc.</action>
  </step>
  <step n="4" goal="Write architecture artifact">
    <action>Write the artifact to `.codewright-output/specs/spec-<name>/architecture.md`</action>
  </step>
</workflow>

## Finalization
Architecture documented. Ask if they want to generate stories (`codewright:story`).
