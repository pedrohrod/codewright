# Sentry Integration

Codewright can monitor Sentry for errors and automatically fix them. When Sentry detects an error, Codewright fetches it, analyzes the stacktrace, fixes the bug, and creates a Draft PR.

## How It Works

```
Sentry Error
    ↓
codewright scan --once
    ↓
SentryTicketProvider.findReadyTickets()
    ↓ (fetches issues + stacktraces)
Planner Agent (analyzes error + code)
    ↓
Engineer Agent (fixes the bug)
    ↓
Reviewer Agent (reviews the fix)
    ↓
Git commit → push → Draft PR
    ↓
Comment on Sentry issue with PR link
```

## Setup

### 1. Get Sentry Auth Token

1. Go to Sentry → Settings → Developer Settings → Auth Tokens
2. Create a new token with scopes:
   - `event:read` (read issues and events)
   - `event:write` (resolve issues, add comments)

### 2. Find Your Organization and Project Slugs

- **Organization slug**: Visible in the URL: `https://sentry.io/organizations/<ORG-SLUG>/`
- **Project slug**: Visible in the URL: `https://sentry.io/organizations/<ORG>/projects/<PROJECT-SLUG>/`

### 3. Configure Environment Variables

```bash
SENTRY_AUTH_TOKEN=sntrys_...       # Required
SENTRY_ORG=my-org                   # Required
SENTRY_PROJECT=my-project           # Optional (filters to specific project)
SENTRY_SERVER_URL=https://sentry.io # Optional (for self-hosted)
```

### 4. Configure Codewright

**TypeScript** (`codewright.config.ts`):

```ts
import { defineConfig, sentry, github, openai } from "codewright";

export default defineConfig({
  model: openai({
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.CODEWRIGHT_MODEL || "gpt-4o",
  }),

  tickets: sentry({
    organization: process.env.SENTRY_ORG!,
    project: process.env.SENTRY_PROJECT,
    query: "is:unresolved level:error",
  }),

  sourceControl: github(),

  workflow: {
    draft: true,
    maxIterations: 3,
  },

  validation: {
    commands: ["npm test", "npm run lint"],
  },
});
```

**YAML** (`.codewright/config.yaml`):

```yaml
tickets:
  provider: sentry
  organization: my-org
  project: my-project
  query: "is:unresolved level:error"

sourceControl:
  provider: github

model:
  provider: openai
  model: gpt-4o

workflow:
  draft: true
  maxIterations: 3

validation:
  commands:
    - npm test
    - npm run lint
```

## Query Customization

The `query` parameter uses Sentry's search syntax:

```ts
sentry({
  query: "is:unresolved level:error",        // Only errors
  query: "is:unresolved has:stacktrace",     // Only with stacktrace
  query: "is:unresolved assigned:[none]",    // Unassigned only
})
```

Common filters:
- `is:unresolved` — Only unresolved issues
- `level:error` — Only errors (not warnings)
- `level:fatal` — Only fatal errors
- `has:stacktrace` — Only issues with stacktraces
- `assigned:[none]` — Unassigned issues

## Self-Hosted Sentry

```ts
sentry({
  serverUrl: process.env.SENTRY_SERVER_URL,  // e.g., https://sentry.mycompany.com
  token: process.env.SENTRY_AUTH_TOKEN,
  organization: "my-org",
})
```

## What Gets Passed to the AI

The planner agent receives the error context in the ticket description:

- **Error Type** (e.g., "TypeError")
- **Level** (e.g., "error")
- **Culprit** (e.g., "src/components/List.tsx in renderItems")
- **Occurrence count** and affected users
- **First/last seen** timestamps
- **Stacktrace** (top 10 frames, node_modules filtered out)

This gives the agent enough context to understand the error and locate the problematic code.

## Resolution Semantics

- **When PR is created**: A comment with the PR link is added to the Sentry issue. The issue is NOT resolved.
- **When PR merges**: Nothing happens automatically (V1).
- **Manual resolution**: Resolve the issue in Sentry after verifying the fix.
- **Future**: `codewright resolve` command for post-merge resolution.

## GitHub Actions

```yaml
- run: npx codewright scan --once
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    CODEWRIGHT_MODEL: ${{ vars.CODEWRIGHT_MODEL }}
```

## Troubleshooting

### "Missing SENTRY_AUTH_TOKEN"
Check that `SENTRY_AUTH_TOKEN` is set and has the correct scopes.

### "Missing SENTRY_ORG"
Check that `SENTRY_ORG` is set to your organization slug (not the full URL).

### No issues found
- Verify the query syntax (try `is:unresolved` without filters)
- Check that the project slug is correct
- Ensure the auth token has access to the organization

### Rate limiting
Sentry API allows 50 requests/second. Codewright handles 429 errors with automatic backoff.

### Self-hosted issues
- Verify `SENTRY_SERVER_URL` includes the protocol (https://)
- Ensure the self-hosted instance has the API enabled
- Check that the auth token is valid for the self-hosted instance
