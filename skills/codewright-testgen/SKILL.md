---
name: codewright:testgen
description: "Generate tests from spec stories — uses I/O Matrix to create test files"
---

# Codewright Test Generator

## Activation
When the user says: "codewright testgen", "generate tests from spec", "test from stories", "auto test"

## Operation
<workflow>
  <step n="1" goal="Read spec stories">
    <action>Run: `npx codewright test <spec>` or `npx codewright test <spec> <story-id>`</action>
    <action>Scans all stories (or a specific one) from the spec</action>
  </step>
  <step n="2" goal="Parse I/O Matrix">
    <action>For each story, extract scenarios from the I/O Matrix:
      - Scenario description
      - Input values
      - Expected output
    </action>
    <action>Each scenario becomes an `it()` block in the test file</action>
  </step>
  <step n="3" goal="Generate test files">
    <action>Creates test files in `src/__tests__/<story-id>.test.ts`</action>
    <action>Uses vitest by default (configurable in customize.toml)</action>
    <action>Each test includes the original scenario context as comments</action>
  </step>
  <step n="4" goal="Run generated tests">
    <action>Suggest running `npm test` to verify generated tests pass</action>
    <action>If tests fail, help fix the issues</action>
  </step>
</workflow>

## Finalization
Tests generated from spec stories. Report how many scenarios were converted and where files were created.
