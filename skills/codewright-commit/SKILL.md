---
name: codewright:commit
description: "Commit story changes to a feature branch and merge to main"
phase: implementation
---

# Codewright Commit

## Activation
When the user says: "codewright commit", "commit story", "create branch", "commit changes", "merge story", "story done"

## Operation
<workflow>
  <step n="1" goal="Verify the story is ready for commit">
    <action>Confirm the story has been implemented and all tests pass</action>
    <action>Verify the story status is "review" or "done"</action>
  </step>
  <step n="2" goal="Run the commit command">
    <action>Run: `npx codewright commit <spec> <id>`</action>
    <action>This creates a feature branch, stages all changes, commits, and pushes the branch</action>
    <action>The branch is pushed to origin for PR creation — merge is done by the user</action>
  </step>
  <step n="3" goal="Handle options (if applicable)">
    <action>Use `--branch <name>` for a custom branch name (default: `story/<id>-<slug>`)</action>
    <action>Use `--amend` to amend the last commit instead of creating a new one</action>
  </step>
  <step n="4" goal="Confirm result">
    <action>Show the commit hash, branch name, files changed, and merge result</action>
    <action>Story status is automatically updated to "done"</action>
  </step>
</workflow>

## Conventional Commit Format
The commit message follows conventional commits:
`feat(<slug>): <title> (#<id>)`

Examples:
- `feat(login-form): Create user login form (#S001)`
- `fix(validation): Fix edge case in email validation (#S002)`
- `refactor(auth): Extract auth middleware (#S003)`

## Branch Naming Convention
Branches are named `story/<id>-<title-slug>` by default.
Example: Story "Create login form" with ID S001 → branch `story/S001-create-login-form`

## Finalization
Story committed to feature branch and pushed to origin. Status updated to "done". User can now open a PR or merge locally.
