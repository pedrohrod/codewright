---
name: codewright:env
description: "Manage environment variables — setup .env from .env.example, list current vars"
---

# Codewright Env

## Activation
When the user says: "codewright env", "setup env", "environment variables", "manage env", ".env"

## Operation
<workflow>
  <step n="1" goal="Setup .env from .env.example">
    <action>Run: `npx codewright env setup`</action>
    <action>Creates .env from .env.example if it doesn't exist</action>
    <action>If .env exists, checks for missing variables</action>
  </step>
  <step n="2" goal="List current environment variables">
    <action>Run: `npx codewright env list`</action>
    <action>Shows all variables with values</action>
  </step>
  <step n="3" goal="Verify .env is complete">
    <action>Compare .env against .env.example for missing vars</action>
    <action>Report any gaps that need attention</action>
  </step>
</workflow>

## Finalization
Environment variables configured. Remind the user to never commit .env to git.
