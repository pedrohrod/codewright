---
name: codewright-deps
description: Audit Codewright project dependencies for outdated versions and known vulnerabilities across Node.js, Python, or Go. Use for "$codewright-deps", "codewright deps", legacy "codewright:deps", dependency health, vulnerable packages, or update planning. Do not upgrade packages automatically.
---

# Codewright Dependencies

1. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, manifests, lockfiles, workspace configuration, and the detected ecosystem.
2. Run `npx codewright deps` and distinguish outdated-package data, known vulnerabilities, unsupported runtimes, and unavailable audit tooling.
3. Treat registry or network failures as unknown results, never as "all up to date."
4. Rank findings by exploitability, production reachability, severity, available remediation, and breaking-change risk.
5. For each proposed upgrade, inspect release notes and migration guidance before recommending a version.
6. Never run an install, lockfile rewrite, or forced audit fix without explicit approval.
7. Report exact commands run, ecosystem coverage, unresolved uncertainty, and a staged remediation plan. Read [references/supply-chain.md](references/supply-chain.md) for the security baseline.
