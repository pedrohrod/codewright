# Dependency and supply-chain baseline

Last verified: 2026-07-22.

- Inventory direct and transitive dependencies from lockfiles.
- Separate version freshness from known-vulnerability status.
- Treat unavailable registry or advisory data as unknown.
- Review breaking releases before upgrading and verify the resulting lockfile.
- Prefer automated, repeatable audit checks in CI.

Primary sources:

- https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html
- https://docs.npmjs.com/cli/v11/commands/npm-audit/

