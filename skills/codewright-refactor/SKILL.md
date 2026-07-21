---
name: codewright:refactor
description: "Apply design patterns and refactoring — Strategy, Factory, Observer, etc."
phase: implementation
---

# Codewright Refactor

## Activation
When the user says: "codewright refactor", "apply pattern", "design pattern", "refactor code", "suggest pattern", "improve design"

## Operation
<workflow>
  <step n="1" goal="Analyze the code">
    <action>Read the target code and identify design problems:
      - **Switch/if-else chains** → suggest Strategy or Command pattern
      - **Complex object construction** → suggest Builder or Factory pattern
      - **Tight coupling** → suggest Dependency Injection
      - **God classes / Long methods** → suggest Extract Class / Extract Method
      - **Observer-like callbacks** → formalize with Observer or Event pattern
      - **Feature Envy** → suggest Move Method
    </action>
  </step>
  <step n="2" goal="Propose pattern options">
    <action>For each problem, present 1-2 pattern options with:
      - Pattern name and intent
      - How it applies to this specific code
      - Before/after code sketches
      - Trade-offs (complexity vs benefit)
    </action>
    <action>Let the user choose before proceeding</action>
  </step>
  <step n="3" goal="Apply refactoring incrementally">
    <action>Apply one refactoring at a time</action>
    <action>After each step: verify tests still pass</action>
    <action>If no tests exist, create a safety net first</action>
  </step>
  <step n="4" goal="Document changes">
    <action>Explain what changed and why</action>
    <action>Update any relevant documentation</action>
  </step>
</workflow>

## Finalization
Refactoring complete. Confirm tests pass and summarize what patterns were applied.
