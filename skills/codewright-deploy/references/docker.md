# Docker build baseline

Last verified: 2026-07-22.

- Prefer multi-stage builds and minimal runtime contents.
- Use deterministic dependency installs and an effective dockerignore.
- Run services as a non-root user when privileges are unnecessary.
- Rebuild supported base images regularly and test images in CI.
- Never bake credentials into layers.

Primary source: https://docs.docker.com/build/building/best-practices/

