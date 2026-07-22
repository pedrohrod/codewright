---
name: codewright-architecture
description: Design or update a Codewright architecture spine and architecture decision records from an approved specification. Use for "$codewright-architecture", "codewright architecture", legacy "codewright:architecture", architecture planning, ADRs, system boundaries, or quality-attribute trade-offs. Do not use for implementation-only refactors.
---

# Codewright Architecture

1. Load the selected `SPEC.md`, applicable `AGENTS.md`, `.codewright/rules/*.md`, project context, and architecture customization.
2. Confirm the spec has a clear goal, capabilities, constraints, non-goals, and measurable success signal. Stop and report gaps that would materially change the design.
3. Inspect the existing codebase and architecture artifacts before proposing new structure.
4. Identify architecturally significant requirements, system boundaries, external dependencies, data ownership, security boundaries, failure modes, and operational constraints.
5. Record one decision per ADR with status, context, decision drivers, considered options, decision, consequences, and superseded decisions. Read [references/adr.md](references/adr.md) when creating or revising ADRs.
6. Keep reversible or low-impact choices out of ADRs. Mark unresolved choices as explicit questions instead of guessing.
7. Write `.codewright-output/specs/spec-<name>/architecture.md` with a system overview, component/data-flow description, ADR index, risks, and traceability back to capabilities.
8. Validate that every architectural claim is supported by the spec or repository evidence and report remaining risks.
