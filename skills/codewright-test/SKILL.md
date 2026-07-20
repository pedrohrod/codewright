---
name: codewright:test
description: "Generate test strategy and implementation — unit, integration, fixtures"
---

# Codewright Test

## Activation
When the user says: "codewright test", "write tests", "test strategy", "generate tests", "add test coverage"

## Operation
<workflow>
  <step n="1" goal="Understand the code under test">
    <action>Read the source file(s) the user wants to test</action>
    <action>Identify: public API, input/output types, edge cases, dependencies to mock</action>
  </step>
  <step n="2" goal="Design test strategy">
    <action>Determine appropriate test level:
      - **Unit tests**: Pure functions, isolated logic, small scope
      - **Integration tests**: Database, API calls, file I/O
      - **Fixture factories**: Reusable test data builders
    </action>
    <action>List test scenarios:
      - Happy path (success)
      - Input variations (boundaries, empty, null, invalid)
      - Error states (exceptions, failure codes)
      - State transitions (if applicable)
    </action>
  </step>
  <step n="3" goal="Generate test code">
    <action>Write tests following the project's existing test patterns</action>
    <action>Use the project's test framework (vitest, jest, mocha, playwright)</action>
    <action>Cover: all I/O Matrix scenarios + edge cases</action>
    <action>Include setup/teardown and mock configuration</action>
  </step>
  <step n="4" goal="Verify tests">
    <action>Run the generated tests</action>
    <action>If tests fail, diagnose and fix</action>
    <action>Check for flaky tests (non-deterministic behavior)</action>
  </step>
</workflow>

## Finalization
Tests created and verified. Report coverage achieved and any scenarios that could not be tested.
