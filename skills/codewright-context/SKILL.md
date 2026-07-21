---
name: codewright:context
description: "Generate project context and llms.txt for AI agents"
phase: operations
---

# Codewright Context

## Activation
When the user says: "codewright context", "generate context", "update context", "ai context", "llms.txt"

## Operation
<workflow>
  <step n="1" goal="Generate project context">
    <action>Run: `npx codewright context`</action>
    <action>Creates/updates `.codewright-output/project-context.md` with:
      - Technology stack and versions
      - Project structure
      - Configuration and tooling
      - Environment variables
      - Critical rules
    </action>
  </step>
  <step n="2" goal="Generate llms.txt for AI agents">
    <action>Run: `npx codewright context --llms`</action>
    <action>Creates/updates `llms.txt` at project root for AI agent consumption</action>
  </step>
  <step n="3" goal="Explain benefits">
    <action>Tell the user:
      - `project-context.md` is for agents to understand project structure
      - `llms.txt` is used by AI tools (Cursor, Claude, etc.) for quick onboarding
      - Run `codewright context` regularly to keep context in sync
    </action>
  </step>
</workflow>

## Finalization
Context files generated. Remind the user to run `codewright context` after significant project changes.
