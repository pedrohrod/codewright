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

// Config (scan-related)
export type {
  TicketConfig,
  SourceControlConfig,
  WorkflowAutomationConfig,
  ValidationAutomationConfig,
  ExecutionConfig,
} from "./config/loader.js";
export { defineConfig } from "./config/loader.js";
