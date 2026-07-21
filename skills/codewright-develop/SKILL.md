---
name: codewright:develop
description: "Orchestrate full development workflow — readiness → dev → quality → test → review for each story"
phase: implementation
---

# Codewright Develop (Orchestrator)

## Activation
When the user says: "codewright develop", "develop all stories", "run full workflow", "implement all", "develop spec"

## Operation
<workflow>
  <step n="1" goal="Load spec and list stories">
    <action>Read the SPEC.md from the selected spec</action>
    <action>List all stories with their current status (pending/in-progress/review/done)</action>
    <action>Show summary:
      - N stories total
      - N pending, N in-progress, N done
    </action>
    <action>Ask: "Start from the first pending story, or specify which story?"</action>
  </step>
  <step n="2" goal="Process each story">
    <action>For each pending/in-progress story, execute this sequence:</action>

    <action>**2a. Readiness Check**
      - Run `codewright:readiness` to validate the story
      - If FAIL: report what's missing, skip to next story
      - If PASS: continue to dev
    </action>

    <action>**2b. Dev (Implement)**
      - Run `codewright:dev` to mark story as in-progress
      - Implement following TDD (RED → GREEN → REFACTOR)
      - Keep scope limited to Code Map and I/O Matrix
    </action>

    <action>**2c. Quality Check**
      - Run `codewright:quality` on the implemented code
      - Check: SOLID, DRY, naming, complexity
      - If Critical findings: suggest fixing before continuing
    </action>

    <action>**2d. Test**
      - Run `codewright:test` to generate/verify tests
      - Ensure all tests pass
      - Check coverage of I/O Matrix scenarios
    </action>

    <action>**2e. Refactor (conditional)**
      - If quality found Warning/Critical issues: run `codewright:refactor`
      - Apply patterns incrementally, keep tests green
      - If no issues: skip this step
    </action>

    <action>**2f. Review**
      - Run `codewright:review` to prepare code review
      - Show High/Medium findings
      - If any High findings: fix before moving to next story
    </action>

    <action>After each story, show progress:
      - Story S001: DONE ✓
      - Story S002: IN PROGRESS...
      - Story S003: PENDING
    </action>
  </step>
  <step n="3" goal="Finalization — retrospective">
    <action>After all stories processed, run `codewright:retrospective`</action>
    <action>Show final summary:
      - Stories completed: N
      - Total quality findings: N
      - Tests generated: N
      - Review findings: N High, N Medium, N Low
    </action>
  </step>
</workflow>

## Finalization

Full workflow complete. The spec has been developed through all stories with quality checks, tests, and reviews at each step.

## Customization

This skill can be configured via `.codewright/custom/codewright-develop.toml`:

```toml
[workflow]
skip_refactor_if_clean = true    # Skip refactor if no quality issues
auto_proceed_after_review = false # Ask before moving to next story
stop_on_critical = true          # Stop workflow on Critical findings
```
