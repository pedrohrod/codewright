---
name: codewright-ci
description: Generate, review, or harden Codewright continuous-integration workflows for Node.js, Python, or Go projects. Use for "$codewright-ci", "codewright ci", legacy "codewright:ci", GitHub Actions setup, CI failures caused by generated workflow structure, or CI security hardening. Do not deploy or change repository settings.
---

# Codewright CI

1. Read applicable `AGENTS.md`, `.codewright/rules/*.md`, `.codewright/config.yaml`, lockfiles, manifests, runtime-version files, and existing workflows.
2. Determine the package manager, supported runtime version, build, typecheck, lint, and test commands from repository evidence. Never invent commands.
3. If no workflow exists, preview `npx codewright ci`; if one exists, review it and present a diff before requesting an explicit overwrite.
4. Generate least-privilege `permissions`, full-SHA action pins, timeouts, concurrency cancellation, dependency caching tied to the lockfile, and only verified project commands.
5. Preserve intentional repository-specific jobs and secrets. Never print secret values or run untrusted pull-request code with privileged credentials.
6. Validate the YAML and, when available, run a local syntax/action lint check.
7. Report triggers, jobs, required repository configuration, verification results, and any action pins that should be re-verified. Read [references/github-actions.md](references/github-actions.md) for the security baseline.
