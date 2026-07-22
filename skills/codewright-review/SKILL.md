---
name: codewright-review
description: Review a Codewright story implementation against its baseline diff, acceptance criteria, tests, and project rules. Use for "$codewright-review", "codewright review", legacy "codewright:review", review this story, review a baseline diff, or assess merge readiness. Do not modify code unless the user asks to address findings.
---

# Codewright Review

1. Run `npx codewright review <spec> <id>` and load the full baseline diff, story, spec, tests, architecture, and applicable guidance.
2. Review independently across correctness and regressions, edge cases and failure modes, and acceptance traceability.
3. Check security-sensitive boundaries and dependency changes when present.
4. Report only actionable findings with severity, `file:line`, triggering scenario, impact, and remediation direction.
5. Use High for merge-blocking correctness, security, data-loss, or acceptance failures; Medium for credible non-blocking risk; Low for optional improvement.
6. Do not report pre-existing issues outside the diff unless the change makes them materially worse.
7. Update the review artifact with findings and evidence. Mark review-ready only when required checks pass and no High finding remains.
