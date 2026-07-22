# GitHub Actions security baseline

Last verified: 2026-07-22.

- Declare the minimum required token permissions.
- Pin actions to reviewed full commit SHAs.
- Avoid passing untrusted pull-request data through shell interpolation.
- Add job timeouts and cancel superseded runs.
- Keep privileged secrets unavailable to untrusted fork code.

Primary source: https://docs.github.com/en/actions/reference/security/secure-use

