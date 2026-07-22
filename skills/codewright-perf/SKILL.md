---
name: codewright-perf
description: Design, generate, run, and analyze Codewright performance tests with k6 or Artillery. Use for "$codewright-perf", "codewright perf", legacy "codewright:perf", load testing, stress testing, soak testing, benchmarks, or performance thresholds. Do not run load against an unapproved target.
---

# Codewright Performance Testing

1. Confirm the target environment, owner approval, traffic budget, test type, duration, virtual users, data safety, and stop conditions.
2. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, performance customization, service contracts, authentication needs, and existing tests.
3. Run `npx codewright perf setup <k6|artillery>` and replace sample URLs and checks with verified scenarios.
4. Define thresholds from explicit SLOs. When none exist, label proposed thresholds as provisional rather than authoritative.
5. Add realistic ramping, request checks, endpoint tags, test-data isolation, and environment-driven secrets.
6. Run `npx codewright perf run <tool>` only against the approved target. Stop on unexpected error rate or target instability.
7. Report tool version, workload, p50/p90/p95/p99, throughput, errors, threshold results, test limitations, and reproducible commands.
8. Read [references/performance.md](references/performance.md) when designing thresholds or interpreting results.
