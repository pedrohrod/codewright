---
name: codewright:epic
description: "Break spec into epics and stories — faster spec-to-implementation"
phase: planning
---

# Codewright Epic

## Activation
When the user says: "codewright epic", "create epics", "break into epics", "epics and stories", "breakdown"

## Operation
<workflow>
  <step n="1" goal="Load the spec">
    <action>Read the SPEC.md from `.codewright-output/specs/spec-<name>/SPEC.md`</action>
    <action>Extract: Why, Capabilities, Constraints, Non-goals</action>
    <action>If user provides a PRD file instead, read that instead</action>
  </step>
  <step n="2" goal="Extract functional requirements">
    <action>From the spec/PRD, extract all functional requirements:</action>
    <action>Format as: FR1: [description], FR2: [description], etc.</action>
    <action>Also extract NFRs (performance, security, etc.) if present</action>
    <action>Present the list to the user and ask: "Are all requirements captured?"</action>
  </step>
  <step n="3" goal="Design epic structure">
    <action>Group FRs into epics organized by USER VALUE (not technical layers):</action>
    <action>Each epic should:
      - Deliver something users can DO
      - Be independently valuable
      - Contain 2-8 stories
    </action>
    <action>Present the epic list:
      - Epic N: [title]
      - What users can accomplish
      - FRs covered
    </action>
    <action>Ask: "Does this epic structure align with your vision?"</action>
  </step>
  <step n="4" goal="Create stories for each epic">
    <action>For each epic, create stories following this format:</action>
    <action>Story N.M: [title]
As a [user type], I want [capability], so that [benefit].

Acceptance Criteria:
- Given [precondition]
- When [action]
- Then [expected outcome]
    </action>
    <action>Rules for good stories:
      - Completable in one dev session
      - No forward dependencies (can't depend on future stories)
      - Each story creates/changes ONLY what it needs
    </action>
    <action>Process epics sequentially, one at a time</action>
  </step>
  <step n="5" goal="Validate coverage">
    <action>Verify every FR is covered by at least one story</action>
    <action>Verify no FR is missed</action>
    <action>Show coverage map: FR N → Epic X, Story Y</action>
  </step>
  <step n="6" goal="Save epics.md">
    <action>Write the complete epics document to:
      `.codewright-output/specs/spec-<name>/epics.md`
    </action>
    <action>Also create individual story files using `codewright story`:
      `npx codewright story <spec> <id> "<title>"`
    </action>
  </step>
</workflow>

## Finalization
Epics and stories created. Show summary:
- N epics created
- N stories created
- All FRs covered: YES/NO

Suggest running `codewright readiness` to check if stories are ready for implementation.
