---
name: codewright:init
description: "Initialize Codewright structure on the project"
---

# Codewright Init

## Activation
When the user says: "codewright init", "initialize codewright", "setup codewright"

## Operation
<workflow>
  <step n="1" goal="Initialize codewright in the project">
    <action>Run `npx codewright init` in the current directory</action>
    <output>Show the user the created directories:
  - `.codewright/config.yaml` — project configuration
  - `.codewright/AGENTS.md` — agent instructions
  - `.codewright-output/` — output directory
  - `.agents/skills/` — installed agent skills
    </output>
  </step>
  <step n="2" goal="Explain next steps">
    <action>Tell the user they can now run `codewright:spec` to start a specification</action>
  </step>
</workflow>

## Finalization
Explain to the user the Codewright flow: spec → architecture → story → dev → review.
