---
name: codewright:hook
description: "Manage git hooks — install pre-commit checks, commit message validation"
---

# Codewright Hook

## Activation
When the user says: "codewright hook", "install hooks", "git hooks", "setup hooks", "pre-commit"

## Operation
<workflow>
  <step n="1" goal="Install git hooks">
    <action>Run: `npx codewright hook install`</action>
    <action>This installs:
      - **pre-commit**: Check for TODO/FIXME without ticket numbers, debugger statements
      - **commit-msg**: Validate conventional commit format (feat:, fix:, etc.)
    </action>
  </step>
  <step n="2" goal="Explain hooks">
    <action>Tell the user:
      - Hooks are stored in `.codewright/hooks/` and symlinked to `.git/hooks/`
      - To remove hooks, delete the files from `.git/hooks/`
      - Hooks can be customized by editing `.codewright/hooks/<name>`
    </action>
  </step>
  <step n="3" goal="List hooks">
    <action>Run: `npx codewright hook list` to see current hook status</action>
  </step>
</workflow>

## Finalization
Git hooks installed. Remind the user that hooks run automatically on git commit.
