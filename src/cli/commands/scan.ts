import type {
  CodewrightConfig,
  TicketConfig,
  SourceControlConfig,
  ModelProviderConfig,
} from "../../config/loader.js";
import { loadConfigAsync } from "../../config/loader.js";
import type {
  TicketProvider,
  Ticket,
  FindTicketsOptions,
} from "../../providers/ticket-provider.js";
import type { SourceControlProvider } from "../../providers/source-control-provider.js";
import type { GitClient } from "../../providers/git/git-client.js";
import { ticketToPullRequest } from "../../orchestrator/workflow.js";
import type { EngineeringResult } from "../../providers/validation.js";
import type { LanguageModel } from "../../models/language-model.js";

// ─── Types ────────────────────────────────────────────────

export interface ScanOptions {
  once?: boolean;
  dryRun?: boolean;
  limit?: number;
  ticketId?: string;
}

export interface ScanResult {
  status: "completed" | "no_tickets" | "blocked" | "failed" | "no_changes";
  ticketsProcessed: number;
  errors: string[];
}

// ─── Provider initialization ──────────────────────────────

async function createTicketProvider(
  ticketConfig: TicketConfig,
): Promise<TicketProvider> {
  if (ticketConfig.provider === "trello") {
    const { trello } = await import("../../providers/trello/index.js");
    return trello({
      apiKey: process.env.TRELLO_API_KEY || "",
      token: process.env.TRELLO_TOKEN || "",
      boardId: (ticketConfig.boardId as string) || process.env.TRELLO_BOARD_ID || "",
      readyList: (ticketConfig.readyList as string) || "Ready for AI",
      workingList: (ticketConfig.workingList as string) || "AI Working",
      reviewList: (ticketConfig.reviewList as string) || "Human Review",
      blockedList: (ticketConfig.blockedList as string) || "Blocked",
    });
  } else if (ticketConfig.provider === "github-issues") {
    const { githubIssues } = await import("../../providers/github-issues/index.js");
    return githubIssues({
      token: process.env.GITHUB_TOKEN || "",
      owner: (ticketConfig.owner as string) || process.env.GITHUB_REPOSITORY?.split("/")[0] || "",
      repo: (ticketConfig.repo as string) || process.env.GITHUB_REPOSITORY?.split("/")[1] || "",
      readyLabel: (ticketConfig.readyLabel as string) || "codewright:ready",
      workingLabel: (ticketConfig.workingLabel as string) || "codewright:working",
      reviewLabel: (ticketConfig.reviewLabel as string) || "codewright:review",
      blockedLabel: (ticketConfig.blockedList as string) || "codewright:blocked",
    });
  } else if (ticketConfig.provider === "sentry") {
    const { sentry } = await import("../../providers/sentry/index.js");
    return sentry({
      token: process.env.SENTRY_AUTH_TOKEN || "",
      organization: (ticketConfig.organization as string) || process.env.SENTRY_ORG || "",
      project: (ticketConfig.project as string) || process.env.SENTRY_PROJECT || "",
      serverUrl: (ticketConfig.serverUrl as string) || process.env.SENTRY_SERVER_URL || "",
      query: (ticketConfig.query as string) || "is:unresolved",
      level: (ticketConfig.level as string) || undefined,
    });
  } else {
    throw new Error(`Unknown ticket provider: ${ticketConfig.provider}`);
  }
}

async function createSourceControlProvider(
  scConfig: SourceControlConfig,
): Promise<SourceControlProvider> {
  if (scConfig.provider === "github") {
    const { github } = await import("../../providers/github/index.js");
    return github({
      token: process.env.GITHUB_TOKEN || "",
      owner: process.env.GITHUB_REPOSITORY?.split("/")[0] || "",
      repo: process.env.GITHUB_REPOSITORY?.split("/")[1] || "",
    });
  } else {
    throw new Error(`Unknown source control provider: ${scConfig.provider}`);
  }
}

/**
 * Auto-detect model provider from environment variables.
 * Falls back to OpenAI if OPENAI_API_KEY is set.
 */
function detectModelFromEnv(): ModelProviderConfig {
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.CODEWRIGHT_MODEL || "claude-sonnet-4-20250514",
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.CODEWRIGHT_MODEL || "gemini-2.5-flash",
    };
  }
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
    return {
      provider: "openai-compatible",
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
      model: process.env.CODEWRIGHT_MODEL || "default",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.CODEWRIGHT_MODEL || "gpt-4o",
    };
  }
  throw new Error(
    "No model configured. Set a 'model' section in your config, " +
    "or provide an API key via OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, " +
    "or LLM_API_KEY + LLM_BASE_URL environment variables.",
  );
}

async function createModel(
  modelConfig: ModelProviderConfig,
): Promise<LanguageModel> {
  // Resolve from config with env var fallbacks
  const apiKey = modelConfig.apiKey
    || process.env.OPENAI_API_KEY
    || process.env.ANTHROPIC_API_KEY
    || process.env.GEMINI_API_KEY
    || process.env.LLM_API_KEY
    || "";
  const model = modelConfig.model || process.env.CODEWRIGHT_MODEL || "";
  const baseURL = modelConfig.baseURL || process.env.LLM_BASE_URL;

  if (modelConfig.provider === "openai") {
    const { openai } = await import("../../models/openai/index.js");
    const provider = openai({ apiKey, model, baseURL });
    provider.validate();
    return provider.createModel({ apiKey, model, baseURL });
  } else if (modelConfig.provider === "anthropic") {
    const { anthropic } = await import("../../models/anthropic/index.js");
    const provider = anthropic({ apiKey, model });
    provider.validate();
    return provider.createModel({ apiKey, model });
  } else if (modelConfig.provider === "gemini") {
    const { gemini } = await import("../../models/gemini/index.js");
    const provider = gemini({ apiKey, model });
    provider.validate();
    return provider.createModel({ apiKey, model });
  } else if (modelConfig.provider === "openai-compatible") {
    const { openaiCompatible } = await import("../../models/compatible/index.js");
    if (!baseURL) {
      throw new Error("openai-compatible provider requires baseURL (set via config or LLM_BASE_URL env var)");
    }
    const provider = openaiCompatible({ apiKey, model, baseURL });
    provider.validate();
    return provider.createModel({ apiKey, model, baseURL });
  } else {
    throw new Error(`Unknown model provider: ${modelConfig.provider}`);
  }
}

async function createDefaultProviders(config: CodewrightConfig, cwd: string) {
  if (!config.tickets) {
    throw new Error("No ticket provider configured. Add a 'tickets' section to your config.");
  }
  if (!config.sourceControl) {
    throw new Error("No source control provider configured. Add a 'sourceControl' section to your config.");
  }
  // Auto-detect model from env vars if not configured
  const modelConfig = config.model ?? detectModelFromEnv();

  const ticketProvider = await createTicketProvider(config.tickets);
  const sourceControl = await createSourceControlProvider(config.sourceControl);

  const { LocalGitClient } = await import("../../providers/git/local-git-client.js");
  const git = new LocalGitClient(cwd);

  // Create default model
  const defaultModel = await createModel(modelConfig);

  // Create per-agent model overrides if configured
  const agentModels: Record<string, LanguageModel> = {};
  if (config.agents) {
    for (const [name, agentConfig] of Object.entries(config.agents)) {
      if (agentConfig.model) {
        agentModels[name] = await createModel(agentConfig.model);
      }
    }
  }

  return {
    ticketProvider,
    sourceControl,
    git,
    model: defaultModel,
    agentModels,
  };
}

// ─── Core workflow ────────────────────────────────────────

async function processTicket(
  ticket: Ticket,
  ticketProvider: TicketProvider,
  sourceControl: SourceControlProvider,
  git: GitClient,
  dryRun: boolean,
  cwd: string,
  model: LanguageModel,
  agentModels: Record<string, LanguageModel>,
): Promise<{ success: boolean; blocked: boolean; error?: string; result?: EngineeringResult }> {
  if (dryRun) {
    return { success: true, blocked: false };
  }

  try {
    const result = await ticketToPullRequest({
      ticketProvider,
      sourceControl,
      git,
      ticket,
      workflow: { draft: true, maxIterations: 3 },
      validation: {},
      cwd,
      model,
      agents: {
        planner: agentModels.planner ? { model: agentModels.planner } : undefined,
        engineer: agentModels.engineer ? { model: agentModels.engineer } : undefined,
        reviewer: agentModels.reviewer ? { model: agentModels.reviewer } : undefined,
      },
    });

    if (result.status === "blocked") {
      return { success: false, blocked: true, error: result.blockers.join("; "), result };
    }

    if (result.status === "failed") {
      return { success: false, blocked: false, error: result.summary, result };
    }

    return { success: true, blocked: false, result };
  } catch (error) {
    return { success: false, blocked: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ─── Main command ─────────────────────────────────────────

export interface ScanDeps {
  loadConfig?: (cwd: string) => Promise<CodewrightConfig>;
  createProviders?: (config: CodewrightConfig, cwd: string) => Promise<{
    ticketProvider: TicketProvider;
    sourceControl: SourceControlProvider;
    git: GitClient;
    model: LanguageModel;
    agentModels: Record<string, LanguageModel>;
  }>;
}

export async function scanCommand(
  cwd: string,
  options: ScanOptions,
  deps?: ScanDeps,
): Promise<ScanResult> {
  const errors: string[] = [];
  const limit = options.limit ?? 1;

  // 1. Load config
  const loadConfigFn = deps?.loadConfig ?? loadConfigAsync;
  let config: CodewrightConfig;
  try {
    config = await loadConfigFn(cwd);
  } catch (error) {
    return {
      status: "failed",
      ticketsProcessed: 0,
      errors: [`Failed to load config: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  // 2. Create providers (including model)
  let ticketProvider: TicketProvider;
  let sourceControl: SourceControlProvider;
  let git: GitClient;
  let model: LanguageModel;
  let agentModels: Record<string, LanguageModel>;

  try {
    const createProvidersFn = deps?.createProviders ?? createDefaultProviders;
    const providers = await createProvidersFn(config, cwd);
    ticketProvider = providers.ticketProvider;
    sourceControl = providers.sourceControl;
    git = providers.git;
    model = providers.model;
    agentModels = providers.agentModels;
  } catch (error) {
    return {
      status: "failed",
      ticketsProcessed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }

  // 3. Find eligible tickets
  const findOptions: FindTicketsOptions = {
    limit,
  };
  if (options.ticketId) {
    findOptions.ticketId = options.ticketId;
  }

  let tickets: Ticket[];
  try {
    tickets = await ticketProvider.findReadyTickets(findOptions);
  } catch (error) {
    return {
      status: "failed",
      ticketsProcessed: 0,
      errors: [`Failed to fetch tickets: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  if (tickets.length === 0) {
    return { status: "no_tickets", ticketsProcessed: 0, errors };
  }

  // 4. Process tickets
  let processed = 0;
  for (const ticket of tickets) {
    try {
      const result = await processTicket(
        ticket,
        ticketProvider,
        sourceControl,
        git,
        options.dryRun ?? false,
        cwd,
        model,
        agentModels,
      );

      if (result.blocked) {
        errors.push(`Ticket ${ticket.externalId} blocked: ${result.error}`);
        return {
          status: "blocked",
          ticketsProcessed: processed,
          errors,
        };
      }

      if (!result.success) {
        errors.push(`Ticket ${ticket.externalId} failed: ${result.error}`);
        continue;
      }

      processed++;
    } catch (error) {
      errors.push(`Ticket ${ticket.externalId} error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (processed === 0) {
    return {
      status: errors.length > 0 ? "failed" : "no_changes",
      ticketsProcessed: 0,
      errors,
    };
  }

  return {
    status: "completed",
    ticketsProcessed: processed,
    errors,
  };
}
