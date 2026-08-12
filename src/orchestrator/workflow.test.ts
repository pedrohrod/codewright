import { describe, it, expect, vi } from "vitest";
import { ticketToPullRequest } from "./workflow.js";
import type { TicketToPullRequestConfig } from "./workflow.js";
import type { TicketProvider, Ticket, ClaimResult } from "../providers/ticket-provider.js";
import type { SourceControlProvider, PullRequest } from "../providers/source-control-provider.js";
import type { GitClient, GitStatus } from "../providers/git/git-client.js";
import type { ValidationConfig } from "../providers/validation.js";

// ── Test fixtures ──────────────────────────────────────────────────────

function makeTicket(overrides?: Partial<Ticket>): Ticket {
  return {
    id: "t_001",
    externalId: "TICKET-123",
    title: "Add user authentication",
    description: "Implement login flow with JWT tokens",
    url: "https://example.com/tickets/123",
    ...overrides,
  };
}

function makeGitStatus(): GitStatus {
  return {
    currentBranch: "main",
    isDirty: false,
    stagedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
  };
}

function makePr(): PullRequest {
  return {
    number: 42,
    url: "https://github.com/test/repo/pull/42",
    draft: true,
  };
}

// ── Mock factories ─────────────────────────────────────────────────────

function createTicketProvider(overrides?: {
  tickets?: Ticket[];
  claimResult?: ClaimResult;
}): TicketProvider {
  const tickets = overrides?.tickets ?? [makeTicket()];
  const claimResult = overrides?.claimResult ?? { success: true };

  return {
    name: "mock-ticket",
    findReadyTickets: vi.fn().mockResolvedValue(tickets),
    getTicket: vi.fn().mockResolvedValue(makeTicket()),
    claimTicket: vi.fn().mockResolvedValue(claimResult),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    releaseTicket: vi.fn().mockResolvedValue(undefined),
  };
}

function createSourceControl(overrides?: { pr?: PullRequest }): SourceControlProvider {
  const pr = overrides?.pr ?? makePr();
  return {
    name: "mock-sc",
    getRepositoryInfo: vi.fn().mockResolvedValue({
      owner: "test",
      name: "repo",
      defaultBranch: "main",
    }),
    createBranch: vi.fn().mockResolvedValue({ name: "test-branch", sha: "abc123" }),
    pushBranch: vi.fn().mockResolvedValue(undefined),
    createPullRequest: vi.fn().mockResolvedValue(pr),
  };
}

function createGitClient(overrides?: { hasChanges?: boolean; diff?: string }): GitClient {
  const hasChanges = overrides?.hasChanges ?? true;
  const diff = overrides?.diff ?? "diff --git a/src/foo.ts b/src/foo.ts\n+// new code";

  return {
    status: vi.fn().mockResolvedValue(makeGitStatus()),
    currentBranch: vi.fn().mockResolvedValue("main"),
    createBranch: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    diff: vi.fn().mockResolvedValue(diff),
    diffStaged: vi.fn().mockResolvedValue(diff),
    hasChanges: vi.fn().mockResolvedValue(hasChanges),
    headSha: vi.fn().mockResolvedValue("abc123"),
    branchSha: vi.fn().mockResolvedValue("abc123"),
  };
}

function makeMockModel() {
  return {
    name: "mock",
    modelId: "mock-model",
    generate: vi.fn().mockResolvedValue({
      content: "Mock response",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      model: "mock-model",
    }),
  };
}

function makeConfig(overrides?: {
  tickets?: Ticket[];
  claimResult?: ClaimResult;
  hasChanges?: boolean;
  diff?: string;
  pr?: PullRequest;
  validation?: ValidationConfig;
  maxIterations?: number;
  draft?: boolean;
}): TicketToPullRequestConfig {
  return {
    ticketProvider: createTicketProvider({
      tickets: overrides?.tickets,
      claimResult: overrides?.claimResult,
    }),
    sourceControl: createSourceControl({ pr: overrides?.pr }),
    git: createGitClient({
      hasChanges: overrides?.hasChanges,
      diff: overrides?.diff,
    }),
    workflow: {
      draft: overrides?.draft,
      maxIterations: overrides?.maxIterations,
    },
    validation: overrides?.validation ?? { commands: ["echo ok"] },
    cwd: "/tmp/test-project",
    model: makeMockModel() as any,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("ticketToPullRequest", () => {
  it("processes a ticket through the full workflow", async () => {
    const config = makeConfig();
    const result = await ticketToPullRequest(config);

    expect(result.status).toBe("completed");
    expect(result.ticket.externalId).toBe("TICKET-123");
    expect(result.branch).toBe("codewright/TICKET-123-add-user-authentication");
    expect(result.pullRequest?.url).toBe("https://github.com/test/repo/pull/42");
    expect(result.metrics.iterations).toBeGreaterThanOrEqual(1);

    // Verify workflow steps were called
    expect(config.ticketProvider.findReadyTickets).toHaveBeenCalledOnce();
    expect(config.ticketProvider.claimTicket).toHaveBeenCalledOnce();
    expect(config.ticketProvider.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: "TICKET-123" }),
      "review",
    );
    expect(config.ticketProvider.addComment).toHaveBeenCalledOnce();
    expect(config.git.createBranch).toHaveBeenCalledOnce();
    expect(config.git.add).toHaveBeenCalledOnce();
    expect(config.git.commit).toHaveBeenCalledOnce();
    expect(config.git.push).toHaveBeenCalledOnce();
    expect(config.sourceControl.createPullRequest).toHaveBeenCalledOnce();
  });

  it("returns no_changes when no tickets found", async () => {
    const config = makeConfig({ tickets: [] });
    const result = await ticketToPullRequest(config);

    expect(result.status).toBe("no_changes");
    expect(result.summary).toContain("No ready tickets found");
    expect(config.ticketProvider.claimTicket).not.toHaveBeenCalled();
  });

  it("returns blocked when claim fails with alreadyClaimed", async () => {
    const config = makeConfig({
      claimResult: { success: false, alreadyClaimed: true, message: "locked by run-456" },
    });
    const result = await ticketToPullRequest(config);

    expect(result.status).toBe("blocked");
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].toLowerCase()).toContain("already claimed");
    expect(config.git.createBranch).not.toHaveBeenCalled();
  });

  it("throws ProviderError when claim fails without alreadyClaimed", async () => {
    const config = makeConfig({
      claimResult: { success: false, message: "permission denied" },
    });

    await expect(ticketToPullRequest(config)).rejects.toThrow("Failed to claim ticket");
  });

  it("returns no_changes when no changes after implement step", async () => {
    const config = makeConfig({ hasChanges: false });
    const result = await ticketToPullRequest(config);

    expect(result.status).toBe("no_changes");
    expect(result.summary).toContain("No changes were produced");
    expect(config.git.commit).not.toHaveBeenCalled();
  });

  it("handles dry run without claiming or modifying", async () => {
    const config = makeConfig();
    const result = await ticketToPullRequest(config, { dryRun: true });

    expect(result.status).toBe("no_changes");
    expect(result.summary).toContain("DRY RUN");
    expect(result.branch).toBe("codewright/TICKET-123-add-user-authentication");
    expect(config.ticketProvider.claimTicket).not.toHaveBeenCalled();
    expect(config.git.createBranch).not.toHaveBeenCalled();
    expect(config.git.commit).not.toHaveBeenCalled();
    expect(config.sourceControl.createPullRequest).not.toHaveBeenCalled();
  });

  it("respects maxIterations", async () => {
    const config = makeConfig({
      hasChanges: true,
      maxIterations: 2,
    });
    const result = await ticketToPullRequest(config);

    // Loop only continues if review has issues; with a clean diff,
    // review is always approved so iterations is 1, which is <= maxIterations
    expect(result.metrics.iterations).toBeLessThanOrEqual(2);
  });

  it("generates correct branch name from ticket title", async () => {
    const ticket = makeTicket({
      title: "Fix  Special  Characters!!  & More",
    });
    const config = makeConfig({ tickets: [ticket] });
    const result = await ticketToPullRequest(config, { dryRun: true });

    expect(result.branch).toBe("codewright/TICKET-123-fix-special-characters-more");
  });

  it("passes options.limit to findReadyTickets", async () => {
    const config = makeConfig();
    await ticketToPullRequest(config, { limit: 5 });

    expect(config.ticketProvider.findReadyTickets).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });

  it("passes options.ticketId to findReadyTickets", async () => {
    const config = makeConfig();
    await ticketToPullRequest(config, { ticketId: "TICKET-456" });

    expect(config.ticketProvider.findReadyTickets).toHaveBeenCalledWith(
      expect.objectContaining({ ticketId: "TICKET-456" }),
    );
  });

  it("releases ticket on infrastructure error", async () => {
    const config = makeConfig();
    (config.git.createBranch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("disk full"),
    );

    await expect(ticketToPullRequest(config)).rejects.toThrow("disk full");
    expect(config.ticketProvider.releaseTicket).toHaveBeenCalled();
  });
});
