---
name: codewright-env
description: Safely inspect or initialize Codewright environment-variable files from .env.example. Use for "$codewright-env", "codewright env", legacy "codewright:env", environment setup, missing variables, or env-file validation. Never reveal secret values or commit .env.
---

# Codewright Environment

1. Read applicable root and nested `AGENTS.md` files, `.codewright/rules/*.md`, `.env.example`, `.gitignore`, and existing environment-related configuration.
2. Use `npx codewright env list` to report variable names and set or unset state only.
3. Use `npx codewright env setup` only when the user requests initialization. Preserve an existing `.env` and report missing names without values.
4. Ensure `.env` and local override files are ignored by Git; keep placeholders and safe defaults in `.env.example`.
5. Validate required versus optional variables from repository evidence. Do not invent production secrets or insecure defaults.
6. Report missing variables, ignored-file status, and the next configuration step without printing credentials.
