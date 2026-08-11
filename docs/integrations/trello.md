# Trello Integration

Codewright can monitor a Trello board and automatically process eligible tickets into Draft Pull Requests.

## Setup

### 1. Create Trello Lists

Create these lists on your Trello board (left to right):

```
Backlog
Ready for AI
AI Working
Human Review
Blocked
Done
```

- **Ready for AI** — Cards here are eligible for Codewright processing
- **AI Working** — Codewright claims and processes cards here
- **Human Review** — Completed work awaits human review
- **Blocked** — Cards that Codewright could not complete

### 2. Get API Credentials

1. Go to [Trello Power-Up Admin Portal](https://trello.com/power-ups/admin)
2. Generate an API key
3. Generate a token with read/write access

### 3. Configure Environment Variables

```bash
TRELLO_API_KEY=your_api_key
TRELLO_TOKEN=your_token
TRELLO_BOARD_ID=your_board_id
```

To find your Board ID, open the board in Trello and add `.json` to the URL. Search for `"id"` at the top level.

### 4. Configure Codewright

In your `codewright.config.ts`:

```ts
import { defineConfig, trello, github } from "codewright";

export default defineConfig({
  tickets: trello({
    boardId: process.env.TRELLO_BOARD_ID!,
    readyList: "Ready for AI",
    workingList: "AI Working",
    reviewList: "Human Review",
    blockedList: "Blocked",
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

Or in `.codewright/config.yaml`:

```yaml
tickets:
  provider: trello
  boardId: "${TRELLO_BOARD_ID}"
  readyList: "Ready for AI"
  workingList: "AI Working"
  reviewList: "Human Review"
  blockedList: "Blocked"

sourceControl:
  provider: github

workflow:
  draft: true
  maxIterations: 3

validation:
  commands:
    - npm test
    - npm run lint
```

## Flow

```
1. Create a card in "Ready for AI"
2. Codewright detects the card
3. Moves it to "AI Working"
4. Plans and implements the change
5. Runs validation (tests, lint, etc.)
6. Creates a Draft Pull Request on GitHub
7. Moves the card to "Human Review"
8. Adds a comment with the PR link
```

## Card Title as Requirements

The card title becomes the task description for the AI agent. Write clear, actionable titles:

- Good: "Fix duplicate webhook in notification handler"
- Good: "Add input validation to user registration endpoint"
- Bad: "Fix stuff"
- Bad: "Update code"

## Security

- Card descriptions are treated as untrusted input
- Codewright never executes instructions found in card content
- API credentials are never logged
- Cards cannot override Codewright security policies

## Rate Limits

Trello allows 100 requests per 10 seconds per token. Codewright handles rate limiting automatically with exponential backoff.

## Troubleshooting

### "Authentication failed"
Check that `TRELLO_API_KEY` and `TRELLO_TOKEN` are valid.

### "List not found"
Verify the list names match exactly (case-sensitive). Use IDs instead of names for reliability:

```ts
trello({
  boardId: "...",
  readyList: "60a1b2c3d4e5f6a7b8c9d0e1",
  workingList: "60a1b2c3d4e5f6a7b8c9d0e2",
  // ...
})
```

### "No eligible tickets found"
Ensure there are cards in the "Ready for AI" list.

### Card not moving
Check that the token has write access to the board.
