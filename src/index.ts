export { loadConfig } from "./config/loader.js";
export type { CodewrightConfig } from "./config/loader.js";
export { memlog } from "./memlog/memlog.js";
export type { MemlogEntry, MemlogData } from "./memlog/memlog.js";
export { writeArtifact } from "./artifacts/writer.js";
export { specTemplate } from "./templates/spec-template.js";
export { storyTemplate } from "./templates/story-template.js";
export { AGENT_DEFINITIONS, AGENT_TARGETS, parseAgentTargets } from "./agents/registry.js";
export type { AgentAdapter, AgentDefinition, AgentTarget } from "./agents/registry.js";

// Provider contracts
export type {
  Ticket,
  TicketStatus,
  TicketProvider,
  FindTicketsOptions,
  ClaimContext,
  ClaimResult,
} from "./providers/ticket-provider.js";
export type {
  SourceControlProvider,
  RepositoryInfo,
  PullRequest,
  CreatePullRequestOptions,
} from "./providers/source-control-provider.js";
export type { GitClient, GitStatus } from "./providers/git/git-client.js";
export {
  ProviderError,
  ProviderAuthenticationError,
  ProviderNotFoundError,
  ProviderConflictError,
  ProviderRateLimitError,
} from "./providers/errors.js";
export type {
  EngineeringResult,
  ReviewResult,
  WorkflowConfig,
  ValidationConfig,
} from "./providers/validation.js";

// Agent Runtime
export { runAgent } from "./agents/runtime.js";
export type {
  AgentDefinition as AgentRuntimeDefinition,
  AgentInput,
  AgentResult,
  ToolCallRecord,
} from "./agents/runtime.js";

// Tools
export type { Tool, ToolContext } from "./agents/tools/tool.js";
export {
  readFile,
  writeFile,
  editFile,
  listFiles,
  searchCode,
} from "./agents/tools/filesystem.js";
export { shell } from "./agents/tools/shell.js";
export { gitDiff, gitStatus, gitLog } from "./agents/tools/git.js";

// Config (scan-related)
export type {
  TicketConfig,
  SourceControlConfig,
  WorkflowAutomationConfig,
  ValidationAutomationConfig,
  ExecutionConfig,
  ModelProviderConfig,
} from "./config/loader.js";
export { defineConfig } from "./config/loader.js";

// Model providers
export type {
  Message,
  ModelUsage,
  ModelResponse,
  ModelCallOptions,
  LanguageModel,
  ModelConfig,
  ModelProvider,
} from "./models/index.js";
export {
  ModelError,
  ModelAuthenticationError,
  ModelRateLimitError,
  ModelNotFoundError,
  ModelTimeoutError,
  ModelContextLengthError,
  ModelResponseError,
} from "./models/index.js";
export { openai } from "./models/openai/index.js";
export { anthropic } from "./models/anthropic/index.js";
export { gemini } from "./models/gemini/index.js";
export { openaiCompatible } from "./models/compatible/index.js";

// Ticket providers
export { githubIssues } from "./providers/github-issues/index.js";
export type { GitHubIssuesConfig } from "./providers/github-issues/index.js";

// Sentry ticket provider
export { sentry } from "./providers/sentry/index.js";
export type { SentryConfig } from "./providers/sentry/index.js";

// Agent definitions
export { plannerAgent, engineerAgent, reviewerAgent } from "./agents/definitions.js";
