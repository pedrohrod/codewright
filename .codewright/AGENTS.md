# Codewright Agent Instructions

This project uses Codewright for assisted development.

## Skill Selection & Explanation Protocol

**Before executing ANY task, you MUST follow this protocol:**

1. **Select** — Determine which codewright skill matches the user's request (match intent against skill names, descriptions, and activation phrases).
2. **Analyze** — Read the skill's SKILL.md file from `.agents/skills/<name>/SKILL.md` or `skills/<name>/SKILL.md`.
3. **Explain** — Present a clear summary to the user before acting:
   - Which skill was selected and why
   - The workflow steps it will follow
   - What it will produce
   - Any configuration or customization applied

Only proceed after presenting this analysis.

## Flow

1. Idea → run `codewright:spec`
2. Spec ready → run `codewright:architecture`
3. Architecture ready → run `codewright:story`
4. Before implementing → run `codewright:readiness`
5. During implementation → run `codewright:quality`, `codewright:test`, `codewright:refactor`
6. For bug fixes → run `codewright:quick-dev`
7. Story ready → run `codewright:dev`
8. Implemented → run `codewright:review`
9. Story complete → run `codewright:commit`
10. After sprint → run `codewright:retrospective`
11. Documentation needed → run `codewright:document`

## Rules

- Every implementation starts with an approved spec
- Every story has an I/O Matrix with edge cases
- Tasks are only complete with passing tests
- Never implement outside the task scope
- Always select, analyze, and explain the skill before executing
