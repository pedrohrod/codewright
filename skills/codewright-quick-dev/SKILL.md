---
name: codewright:quick-dev
description: "Rapid implementation for bugs and hotfixes — skip full spec cycle"
phase: implementation
---

# Codewright Quick Dev

## Activation
When the user says: "codewright quick-dev", "quick fix", "hotfix", "bug fix", "rapid implementation", "fix this bug"

## Operation
<workflow>
  <step n="1" goal="Understand the problem">
    <action>Ask the user to describe the bug or feature briefly</action>
    <action>Identify: what should happen, what happens instead, steps to reproduce</action>
  </step>
  <step n="2" goal="Locate relevant code">
    <action>Search the codebase for the relevant files</action>
    <action>Read the surrounding context to understand the pattern</action>
  </step>
  <step n="3" goal="Implement fix">
    <action>Write the minimum code change</action>
    <action>Follow existing code patterns (no new abstractions)</action>
    <action>Add inline comments explaining non-obvious logic</action>
  </step>
  <step n="4" goal="Write minimal tests">
    <action>Add test case for the bug scenario</action>
    <action>Verify existing tests still pass</action>
  </step>
  <step n="5" goal="Prepare for review">
    <action>Generate summary of what changed and why</action>
    <action>Suggest running `codewright:review`</action>
  </step>
</workflow>

## Finalization
Fix implemented. User should run `codewright review <name> <id>` for formal review.
