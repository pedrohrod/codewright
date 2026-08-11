# Model Providers

Codewright uses LLM providers to power the Planner, Engineer, and Reviewer agents. All providers use native `fetch` — no SDK dependencies.

## Supported Providers

| Provider | Factory | Auth Env Var |
|----------|---------|-------------|
| OpenAI | `openai()` | `OPENAI_API_KEY` |
| Anthropic | `anthropic()` | `ANTHROPIC_API_KEY` |
| Google Gemini | `gemini()` | `GEMINI_API_KEY` |
| OpenAI-compatible | `openaiCompatible()` | Custom |

## Configuration

### Default model (all agents)

```ts
import { defineConfig, openai } from "codewright";

export default defineConfig({
  model: openai({
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.CODEWRIGHT_MODEL || "gpt-4o",
  }),
  // ...
});
```

### Per-agent model overrides

```ts
export default defineConfig({
  model: openai({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "gpt-4o",
  }),

  agents: {
    engineer: {
      model: anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: "claude-sonnet-4-20250514",
      }),
    },
  },
});
```

In this example:
- **Planner** uses OpenAI (default)
- **Engineer** uses Anthropic (override)
- **Reviewer** uses OpenAI (default)

### OpenAI-compatible providers

For gateways, self-hosted models, or third-party APIs:

```ts
import { defineConfig, openaiCompatible } from "codewright";

export default defineConfig({
  model: openaiCompatible({
    apiKey: process.env.LLM_API_KEY!,
    baseURL: process.env.LLM_BASE_URL!,
    model: process.env.LLM_MODEL!,
  }),
});
```

## Agent Roles

### Planner
- **Permissions**: READ only
- **Temperature**: 0.3
- **Purpose**: Analyzes ticket and repository, produces implementation plan

### Engineer
- **Permissions**: READ + WRITE + EXEC
- **Temperature**: 0.2
- **Purpose**: Implements the plan by modifying code

### Reviewer
- **Permissions**: READ only
- **Temperature**: 0.1
- **Purpose**: Reviews the git diff and returns structured findings

## Environment Variables

| Variable | Provider | Required |
|----------|----------|----------|
| `OPENAI_API_KEY` | OpenAI | Yes (if using OpenAI) |
| `ANTHROPIC_API_KEY` | Anthropic | Yes (if using Anthropic) |
| `GEMINI_API_KEY` | Gemini | Yes (if using Gemini) |
| `LLM_API_KEY` | Compatible | Yes (if using compatible) |
| `LLM_BASE_URL` | Compatible | Yes (if using compatible) |
| `CODEWRIGHT_MODEL` | Any | No (overrides default model) |

## Security

- API keys are never logged or included in prompts
- Keys come from environment variables only
- Agents never receive GitHub/Trello tokens
- Ticket content is treated as untrusted input

## Usage Tracking

Codewright tracks token usage per agent:

```
Usage
  Planner   input: 12,341  output: 2,102
  Engineer  input: 45,991  output: 8,229
  Reviewer  input: 22,819  output: 3,781
  Total     input: 81,151  output: 14,012
```

## Error Handling

| Error | Meaning |
|-------|---------|
| `ModelAuthenticationError` | Invalid or missing API key |
| `ModelRateLimitError` | Rate limit exceeded (auto-retry) |
| `ModelNotFoundError` | Model not available |
| `ModelTimeoutError` | Request timed out |
| `ModelContextLengthError` | Input too long |

## GitHub Actions

```yaml
- run: npx codewright scan --once
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
    LLM_BASE_URL: ${{ vars.LLM_BASE_URL }}
    CODEWRIGHT_MODEL: ${{ vars.CODEWRIGHT_MODEL }}
```

For OpenAI-compatible providers (gateways, self-hosted):

```yaml
    LLM_API_KEY: ${{ secrets.LLM_API_KEY }}
    LLM_BASE_URL: ${{ vars.LLM_BASE_URL }}
    CODEWRIGHT_MODEL: ${{ vars.CODEWRIGHT_MODEL }}
```

## Creating Custom Providers

Implement the `ModelProvider` interface:

```ts
import type { ModelProvider, ModelConfig } from "codewright";

function myProvider(config: ModelConfig): ModelProvider {
  return {
    name: "my-provider",
    validate() {
      if (!config.apiKey) throw new Error("Missing API key");
    },
    createModel(config) {
      return {
        name: "my-provider",
        modelId: config.model,
        async generate(options) {
          // Call your API here
          const response = await fetch("https://your-api.com/generate", {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}` },
            body: JSON.stringify({ model: config.model, messages: options.messages }),
          });
          const data = await response.json();
          return {
            content: data.text,
            usage: { inputTokens: data.prompt_tokens, outputTokens: data.completion_tokens, totalTokens: data.total_tokens },
            model: config.model,
          };
        },
      };
    },
  };
}
```
