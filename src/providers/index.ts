export type {
  Ticket,
  TicketStatus,
  FindTicketsOptions,
  ClaimContext,
  ClaimResult,
  TicketProvider,
} from "./ticket-provider.js";

export type {
  RepositoryInfo,
  CreateBranchOptions,
  BranchInfo,
  PushBranchOptions,
  CreatePullRequestOptions,
  PullRequest,
  SourceControlProvider,
} from "./source-control-provider.js";

export type {
  GitStatus,
  PushOptions,
  GitClient,
} from "./git/git-client.js";

export {
  ProviderError,
  ProviderAuthenticationError,
  ProviderNotFoundError,
  ProviderConflictError,
  ProviderRateLimitError,
} from "./errors.js";

export { github, GitHubSourceControlProvider } from "./github/index.js";
export type { GitHubConfig } from "./github/index.js";

export type {
  CheckResult,
  ValidationCheck,
  ValidationResult,
  ReviewFinding,
  ReviewResult,
  EngineeringPlan,
  EngineeringResult,
  WorkflowConfig,
  ValidationConfig,
} from "./validation.js";
