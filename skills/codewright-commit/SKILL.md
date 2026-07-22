---
name: codewright-commit
description: Prepare and create a story-scoped Codewright Git commit, optionally pushing its feature branch after explicit approval. Use for "$codewright-commit", "codewright commit", legacy "codewright:commit", commit a story, create a story branch, or finish a reviewed story. Do not stage unrelated changes, merge branches, or push without explicit authorization.
---

# Codewright Commit

1. Load the story, Code Map, review artifact, applicable guidance, Git status, current branch, remotes, and commit customization.
2. Require a readiness/review state, passing required checks, no unresolved High findings, and an exact list of story-owned files.
3. Run `npx codewright commit <spec> <id> --dry-run` and inspect the proposed branch, message, files, story-status update, and unrelated changes.
4. Refuse to proceed when the Code Map is incomplete, unrelated changes are staged, the target branch already exists, or required checks failed.
5. Present the exact commit operation and obtain confirmation. In a non-interactive environment, use `--yes` only when the user already authorized the commit.
6. Create the local commit with Conventional Commits syntax. Include the story status and changelog update in the same commit.
7. Push only when the user explicitly requested it, using `--push`. Never merge automatically.
8. Report the commit hash, branch, committed files, push result, and any remaining worktree changes. Read [references/commits.md](references/commits.md) for message rules.
