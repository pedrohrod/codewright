---
name: codewright:quality
description: "Analyze code quality — SOLID, DRY, naming, complexity, code smells"
---

# Codewright Quality

## Activation
When the user says: "codewright quality", "analyze code quality", "code review quality", "check code smells", "SOLID check"

## Operation
<workflow>
  <step n="1" goal="Identify code to analyze">
    <action>Ask the user which file, module, or directory to analyze</action>
    <action>If not specified, scan the most recently changed files</action>
  </step>
  <step n="2" goal="Run quality analysis">
    <action>Check for each principle:
      - **SOLID**: Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
      - **DRY**: Duplicated code blocks, magic numbers, repeated logic
      - **KISS**: Overly complex solutions, unnecessary abstractions
      - **Naming**: Unclear variables, inconsistent casing, misleading names
      - **Complexity**: Deeply nested conditionals, long methods, high cyclomatic complexity
    </action>
    <action>Classify each finding:
      - **Critical**: Bug risk or maintainability blocker
      - **Warning**: Should be fixed, moderate impact
      - **Suggestion**: Nice to have, style preference
    </action>
  </step>
  <step n="3" goal="Present findings">
    <action>Show each finding with:
      - Location (file:line)
      - Current code snippet
      - Problem description
      - Suggested fix with code example
    </action>
  </step>
  <step n="4" goal="Generate improvement plan">
    <action>Summarize findings by severity</action>
    <action>Group related findings into refactoring tasks</action>
    <action>Estimate effort (minutes) for each fix</action>
  </step>
</workflow>

## Finalization
Present the full quality report. Ask if the user wants to fix Critical findings immediately via `codewright:refactor`.
