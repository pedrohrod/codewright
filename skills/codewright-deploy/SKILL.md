---
name: codewright-deploy
description: Generate or review secure Docker deployment configuration for Codewright-supported Node.js, Python, or Go projects. Use for "$codewright-deploy", "codewright deploy", legacy "codewright:deploy", containerize this project, Dockerfile generation, or dockerignore setup. Do not deploy, publish images, or overwrite existing configuration without approval.
---

# Codewright Deploy

1. Inspect applicable guidance, manifests, lockfiles, runtime declarations, build outputs, start commands, ports, and existing container files.
2. Choose the repository-declared runtime version; use Codewright's maintained fallback only when the project declares none.
3. Preview `npx codewright deploy dockerfile` and `npx codewright deploy dockerignore`. If targets exist, review them and require explicit overwrite approval.
4. Generate deterministic dependency installation, separate build/runtime stages where useful, minimal runtime contents, a non-root user, and no embedded secrets.
5. Add a health check only when the repository exposes a verified health endpoint or command.
6. Build the image locally when Docker is available and run the project's safe smoke check. Do not publish it.
7. Report image assumptions, exposed ports, verification results, and remaining production concerns. Read [references/docker.md](references/docker.md) for the baseline.
