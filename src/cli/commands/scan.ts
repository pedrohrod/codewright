import type {
  CodewrightConfig,
  TicketConfig,
  SourceControlConfig,
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
  } else if (ticketConfig.provider === "github") {
    throw new Error("GitHub ticket provider not yet implemented");
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

async function createDefaultProviders(config: CodewrightConfig, cwd: string) {
  if (!config.tickets) {
    throw new Error("No ticket provider configured. Add a 'tickets' section to your config.");
  }
  if (!config.sourceControl) {
    throw new Error("No source control provider configured. Add a 'sourceControl' section to your config.");
  }

  const ticketProvider = await createTicketProvider(config.tickets);
  const sourceControl = await createSourceControlProvider(config.sourceControl);

  const { LocalGitClient } = await import("../../providers/git/local-git-client.js");
  const git = new LocalGitClient(cwd);

  return { ticketProvider, sourceControl, git };
}

// ─── Core workflow ────────────────────────────────────────

async function processTicket(
  ticket: Ticket,
  ticketProvider: TicketProvider,
  sourceControl: SourceControlProvider,
  git: GitClient,
  dryRun: boolean,
  cwd: string,
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

  // 2. Create providers
  let ticketProvider: TicketProvider;
  let sourceControl: SourceControlProvider;
  let git: GitClient;

  try {
    const createProvidersFn = deps?.createProviders ?? createDefaultProviders;
    const providers = await createProvidersFn(config, cwd);
    ticketProvider = providers.ticketProvider;
    sourceControl = providers.sourceControl;
    git = providers.git;
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
