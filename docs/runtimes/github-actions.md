# GitHub Actions Runtime

Codewright is optimized for GitHub Actions. The `scan --once` command runs as a stateless job that polls for tickets, processes them, and exits.

## How It Works

```
GitHub Action (cron or manual)
  → checkout repository
  → npm install
  → codewright scan --once
  → finds ticket in Trello
  → processes ticket
  → creates Draft PR on GitHub
  → updates Trello card
  → action exits
```

## Workflow Configuration

See `examples/github-actions/codewright.yml` for a complete example.

### Schedule

```yaml
on:
  schedule:
    - cron: "*/5 * * * *"  # Every 5 minutes
```

Adjust frequency based on your needs. More frequent = faster response but more Actions minutes.

### Manual Trigger

```yaml
on:
  workflow_dispatch:
```

### Both

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "*/5 * * * *"
```

## Permissions

The workflow needs:

```yaml
permissions:
  contents: write    # Push branches, create commits
  pull-requests: write  # Create Draft PRs
```

## Required Secrets

| Secret | Description |
|--------|-------------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions |
| `TRELLO_API_KEY` | Trello API key |
| `TRELLO_TOKEN` | Trello API token |
| `TRELLO_BOARD_ID` | Trello board ID |

## Concurrency

```yaml
concurrency:
  group: codewright-${{ github.repository }}
  cancel-in-progress: false
```

This prevents multiple Codewright runs from executing simultaneously on the same repository. `cancel-in-progress: false` ensures a running job completes before the next starts.

## GITHUB_TOKEN

GitHub Actions automatically provides `GITHUB_TOKEN` with the permissions you specify. No configuration needed.

For alternative authentication (PAT, GitHub App), set a custom token:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.CUSTOM_GITHUB_TOKEN }}
```

## Self-Hosted Runners

To use a self-hosted runner:

```yaml
jobs:
  codewright:
    runs-on: self-hosted
```

Benefits:
- No Actions minute limits
- Custom environment setup
- Access to local resources

## Cost Considerations

- GitHub-hosted runners: free for public repos, billed for private (2,000 min/month free for Pro)
- Each `scan --once` run consumes ~1-2 minutes of Actions time
- At `*/5` schedule: ~288 runs/day = ~480-960 minutes/day
- Consider `*/15` or `*/30` for cost-conscious setups

## Limitations

- Maximum job duration: 6 hours (GitHub-hosted), unlimited (self-hosted)
- `GITHUB_TOKEN` cannot trigger other workflows (to prevent infinite loops)
- Scheduled workflows only run on the default branch
- Minimum schedule interval: 5 minutes

## Authentication Alternatives

### GitHub App Token

```yaml
- uses: tibdex/github-app-token@v2
  id: token
  with:
    app_id: ${{ secrets.APP_ID }}
    private_key: ${{ secrets.PRIVATE_KEY }}

- run: npx codewright scan --once
  env:
    GITHUB_TOKEN: ${{ steps.token.outputs.token }}
```

### Personal Access Token

```yaml
- run: npx codewright scan --once
  env:
    GITHUB_TOKEN: ${{ secrets.PERSONAL_ACCESS_TOKEN }}
```

## Monitoring

Check Codewright runs in the Actions tab. Each run logs:
- Tickets found
- Processing status
- Validation results
- PR creation status

## Troubleshooting

### "Authentication failed"
Verify `GITHUB_TOKEN` has `contents: write` and `pull-requests: write` permissions.

### "Branch already exists"
A previous run may have created the branch. Codewright handles this gracefully.

### No runs executing
- Check the cron schedule syntax
- Ensure the workflow is on the default branch
- Verify Actions are enabled for the repository

### Rate limiting
GitHub API allows 5,000 requests/hour. Normal Codewright usage won't hit this limit.
