# Codewright Agent Instructions

This project uses Codewright for assisted development.

## Flow

Invocation syntax varies by agent (for example `$name`, `/name`, or `@name`). The canonical skill identifiers are:

1. Idea → use `codewright-spec`
2. Spec ready → use `codewright-architecture`
3. Architecture ready → use `codewright-story`
4. Before implementing → use `codewright-readiness`
5. Story ready → use `codewright-dev`
6. Implemented → use `codewright-review`
7. Reviewed → use `codewright-commit`

## Rules

- Every implementation starts with an approved spec
- Every story has an I/O Matrix with edge cases
- Tasks are only complete with passing tests
- Never implement outside the task scope
- Load all applicable files in `.codewright/rules/` before Codewright work
- Never expose environment-variable values or push without explicit approval
