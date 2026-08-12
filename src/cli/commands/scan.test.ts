import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanCommand } from "./scan.js";
import type { CodewrightConfig } from "../../config/loader.js";
import type { TicketProvider } from "../../providers/ticket-provider.js";
import type { SourceControlProvider } from "../../providers/source-control-provider.js";
import type { GitClient } from "../../providers/git/git-client.js";

// ─── Helpers ──────────────────────────────────────────────

function makeDefaultConfig(overrides?: Record<string, unknown>): CodewrightConfig {
  return {
    codewright_version: "0.1.0",
    project_name: "test",
    stack: "node",
    communication_language: "en",
    output_folder: ".codewright-output",
    context_file: ".codewright-output/project-context.md",
    ...overrides,
  } as CodewrightConfig;
}

function makeMockTicketProvider(overrides?: Record<string, unknown>): TicketProvider {
  return {
    name: "trello",
    findReadyTickets: vi.fn().mockResolvedValue([]),
    getTicket: vi.fn(),
    claimTicket: vi.fn().mockResolvedValue({ success: true }),
    updateStatus: vi.fn(),
    addComment: vi.fn(),
    ...overrides,
  } as unknown as TicketProvider;
}

function makeMockSourceControl(): SourceControlProvider {
  return {
    name: "github",
    getRepositoryInfo: vi.fn().mockResolvedValue({
      owner: "test-owner",
      name: "test-repo",
      defaultBranch: "main",
    }),
    createBranch: vi.fn().mockResolvedValue({ name: "test-branch", sha: "abc123" }),
    pushBranch: vi.fn().mockResolvedValue(undefined),
    createPullRequest: vi.fn().mockResolvedValue({
      number: 1,
      url: "https://github.com/test-owner/test-repo/pull/1",
      draft: true,
    }),
  } as unknown as SourceControlProvider;
}

function makeMockGit(): GitClient {
  return {
    status: vi.fn().mockResolvedValue({ currentBranch: "main", isDirty: false, stagedFiles: [], modifiedFiles: [], untrackedFiles: [] }),
    currentBranch: vi.fn().mockResolvedValue("main"),
    createBranch: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
    diff: vi.fn().mockResolvedValue(""),
    diffStaged: vi.fn().mockResolvedValue(""),
    hasChanges: vi.fn().mockResolvedValue(false),
    headSha: vi.fn().mockResolvedValue("abc123"),
    branchSha: vi.fn().mockResolvedValue("abc123"),
  } as unknown as GitClient;
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

function makeDeps(config: CodewrightConfig, overrides?: {
  ticketProvider?: TicketProvider;
  sourceControl?: SourceControlProvider;
  git?: GitClient;
}) {
  const ticketProvider = overrides?.ticketProvider ?? makeMockTicketProvider();
  const sourceControl = overrides?.sourceControl ?? makeMockSourceControl();
  const git = overrides?.git ?? makeMockGit();
  const model = makeMockModel();

  return {
    loadConfig: vi.fn().mockResolvedValue(config),
    createProviders: vi.fn().mockResolvedValue({ ticketProvider, sourceControl, git, model, agentModels: {} }),
  };
}

// ─── Tests ────────────────────────────────────────────────

describe("scanCommand", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
    tmpDirs.length = 0;
  });

  function createTmpDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "scan-test-"));
    tmpDirs.push(dir);
    return dir;
  }

  it("should return failed when config has no ticket provider", async () => {
    // Only inject loadConfig — let createDefaultProviders run its validation
    const deps = { loadConfig: vi.fn().mockResolvedValue(makeDefaultConfig()) };

    const result = await scanCommand(createTmpDir(), {}, deps);

    expect(result.status).toBe("failed");
    expect(result.errors[0]).toContain("No ticket provider configured");
  });

  it("should return failed when source control provider is not configured", async () => {
    const config = makeDefaultConfig({ tickets: { provider: "trello" } });
    // Only inject loadConfig — let createDefaultProviders run its validation
    const deps = { loadConfig: vi.fn().mockResolvedValue(config) };

    const result = await scanCommand(createTmpDir(), {}, deps);

    expect(result.status).toBe("failed");
    expect(result.errors[0]).toContain("No source control provider configured");
  });

  it("should return no_tickets when ticket provider finds nothing", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const mockProvider = makeMockTicketProvider({ findReadyTickets: vi.fn().mockResolvedValue([]) });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), {}, deps);

    expect(result.status).toBe("no_tickets");
    expect(result.ticketsProcessed).toBe(0);
  });

  it("should handle dry-run mode without claiming tickets", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const mockProvider = makeMockTicketProvider({
      findReadyTickets: vi.fn().mockResolvedValue([
        { id: "1", externalId: "TRELLO-1", title: "Test ticket" },
      ]),
    });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), { dryRun: true }, deps);

    expect(result.status).toBe("completed");
    expect(result.ticketsProcessed).toBe(1);
    expect(mockProvider.claimTicket).not.toHaveBeenCalled();
  });

  it("should process tickets successfully", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const mockProvider = makeMockTicketProvider({
      findReadyTickets: vi.fn().mockResolvedValue([
        { id: "1", externalId: "TRELLO-1", title: "Test ticket" },
      ]),
      claimTicket: vi.fn().mockResolvedValue({ success: true }),
    });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), {}, deps);

    expect(result.status).toBe("completed");
    expect(result.ticketsProcessed).toBe(1);
    expect(mockProvider.claimTicket).toHaveBeenCalled();
  });

  it("should handle blocked tickets (already claimed)", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const mockProvider = makeMockTicketProvider({
      findReadyTickets: vi.fn().mockResolvedValue([
        { id: "1", externalId: "TRELLO-1", title: "Blocked ticket" },
      ]),
      claimTicket: vi.fn().mockResolvedValue({
        success: false,
        alreadyClaimed: true,
        message: "Another process owns this ticket",
      }),
    });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), {}, deps);

    expect(result.status).toBe("blocked");
    expect(result.ticketsProcessed).toBe(0);
    expect(result.errors[0]).toContain("TRELLO-1");
    expect(result.errors[0]).toContain("blocked");
  });

  it("should handle provider fetch errors", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const mockProvider = makeMockTicketProvider({
      findReadyTickets: vi.fn().mockRejectedValue(new Error("API rate limit")),
    });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), {}, deps);

    expect(result.status).toBe("failed");
    expect(result.errors[0]).toContain("Failed to fetch tickets");
    expect(result.errors[0]).toContain("API rate limit");
  });

  it("should pass limit option to findReadyTickets", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const allTickets = [
      { id: "1", externalId: "TRELLO-1", title: "Ticket 1" },
      { id: "2", externalId: "TRELLO-2", title: "Ticket 2" },
      { id: "3", externalId: "TRELLO-3", title: "Ticket 3" },
    ];
    // Provider respects the limit and returns only the requested number
    const findReadyTickets = vi.fn().mockImplementation((opts: { limit?: number }) => {
      const n = opts.limit ?? allTickets.length;
      return Promise.resolve(allTickets.slice(0, n));
    });
    const mockProvider = makeMockTicketProvider({ findReadyTickets });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), { limit: 2 }, deps);

    expect(result.status).toBe("completed");
    expect(result.ticketsProcessed).toBe(2);
    expect(mockProvider.findReadyTickets).toHaveBeenCalledWith({ limit: 2 });
  });

  it("should pass ticketId option to findReadyTickets", async () => {
    const config = makeDefaultConfig({
      tickets: { provider: "trello" },
      sourceControl: { provider: "github" },
    });
    const mockProvider = makeMockTicketProvider({
      findReadyTickets: vi.fn().mockResolvedValue([
        { id: "1", externalId: "TRELLO-1", title: "Specific ticket" },
      ]),
    });
    const deps = makeDeps(config, { ticketProvider: mockProvider });

    const result = await scanCommand(createTmpDir(), { ticketId: "TRELLO-1" }, deps);

    expect(result.status).toBe("completed");
    expect(result.ticketsProcessed).toBe(1);
    expect(mockProvider.findReadyTickets).toHaveBeenCalledWith({ limit: 1, ticketId: "TRELLO-1" });
  });
});
