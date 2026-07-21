# Codewright Agent Instructions

This project uses Codewright for assisted development.

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
