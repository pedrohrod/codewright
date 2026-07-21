---
name: codewright:retrospective
description: "Post-implementation review — lessons learned, improvements for next cycle"
phase: retrospective
---

# Codewright Retrospective

## Activation
When the user says: "codewright retrospective", "retro", "sprint review", "post-mortem", "lessons learned"

## Operation
<workflow>
  <step n="1" goal="Gather sprint data">
    <action>List all stories for the current spec with their statuses</action>
    <action>Count: completed, in-progress, not started</action>
    <action>If git is available, check commit history for the sprint period</action>
  </step>
  <step n="2" goal="Ask the user">
    <action>Ask structured questions:
      - What went well this sprint?
      - What could be improved?
      - What was unexpected or blocked us?
      - Are there any unresolved issues?
    </action>
  </step>
  <step n="3" goal="Analyze patterns">
    <action>Look for recurring themes:
      - Specs that were incomplete → caused rework
      - Missing I/O Matrix scenarios → late bug discovery
      - Stories too large → estimation issues
      - Good test coverage → fewer regressions
    </action>
  </step>
  <step n="4" goal="Generate improvement suggestions">
    <action>For each pattern found, suggest a concrete change</action>
    <action>Prioritize: High impact, Low effort first</action>
    <action>Update the project's checklist/templates if applicable</action>
  </step>
</workflow>

## Finalization
Retrospective complete. Document key takeaways and action items. Suggest running `codewright:spec` for any improvement initiatives.
