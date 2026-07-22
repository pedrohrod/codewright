---
name: codewright-context
description: Generate or refresh Codewright project context and llms.txt without exposing secrets. Use for "$codewright-context", "codewright context", legacy "codewright:context", project onboarding context, AI-readable repository summaries, or stale generated context. Do not copy private environment values into generated files.
---

# Codewright Context

1. Read applicable `AGENTS.md`, `.codewright/rules/*.md`, project manifests, lockfiles, tool configuration, source layout, and `.env.example`.
2. Run `npx codewright context` for `.codewright-output/project-context.md` and `npx codewright context --llms` only when `llms.txt` is requested.
3. Include verified stack versions, real build/test/lint commands, important directories, configuration paths, environment-variable names, and durable project rules.
4. Exclude `.env` values, credentials, tokens, generated/build directories, and irrelevant file inventories.
5. Keep summaries concise and link to source-of-truth files rather than duplicating large instructions.
6. Review the generated diff for secrets and incorrect commands, then report changed files and any information that could not be derived.
