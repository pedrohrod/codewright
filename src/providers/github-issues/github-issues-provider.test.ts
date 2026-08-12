import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { githubIssues, GitHubIssuesTicketProvider } from "./github-issues-provider.js";

// ── Mock setup ─────────────────────────────────────────────────────────

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", fetchSpy);

function mockFetch(body: unknown, status = 200, headers: Record<string, string> = {}) {
  fetchSpy.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)),
    json: () => Promise.resolve(body),
  });
}

const DEFAULT_CONFIG = {
  token: "ghp_test-token-123",
  owner: "test-owner",
  repo: "test-repo",
};

function createProvider(overrides?: Record<string, unknown>) {
  return githubIssues({ ...DEFAULT_CONFIG, ...overrides });
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("GitHubIssuesTicketProvider", () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("factory", () => {
    it("should create a provider instance", () => {
      const provider = createProvider();
      expect(provider).toBeInstanceOf(GitHubIssuesTicketProvider);
      expect(provider.name).toBe("github-issues");
    });
  });

  describe("findReadyTickets", () => {
    it("should fetch issues with the ready label", async () => {
      const provider = createProvider();
      mockFetch([
        {
          number: 1,
          title: "Fix bug",
          body: "Description here",
          state: "open",
          labels: [{ name: "codewright:ready", color: "00ff00" }],
          html_url: "https://github.com/test-owner/test-repo/issues/1",
          user: { login: "testuser" },
        },
        {
          number: 2,
          title: "Add feature",
          body: null,
          state: "open",
          labels: [{ name: "codewright:ready", color: "00ff00" }],
          html_url: "https://github.com/test-owner/test-repo/issues/2",
          user: { login: "testuser" },
        },
      ]);

      const tickets = await provider.findReadyTickets();

      expect(tickets).toHaveLength(2);
      expect(tickets[0].id).toBe("1");
      expect(tickets[0].externalId).toBe("#1");
      expect(tickets[0].title).toBe("Fix bug");
      expect(tickets[0].description).toBe("Description here");
      expect(tickets[0].url).toBe("https://github.com/test-owner/test-repo/issues/1");
      expect(tickets[0].labels).toContain("codewright:ready");

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/repos/test-owner/test-repo/issues?labels="),
        expect.any(Object),
      );
    });

    it("should respect limit option", async () => {
      const provider = createProvider();
      mockFetch([
        { number: 1, title: "A", body: null, state: "open", labels: [], html_url: "", user: null },
        { number: 2, title: "B", body: null, state: "open", labels: [], html_url: "", user: null },
        { number: 3, title: "C", body: null, state: "open", labels: [], html_url: "", user: null },
      ]);

      const tickets = await provider.findReadyTickets({ limit: 2 });
      expect(tickets).toHaveLength(2);
    });

    it("should filter by ticketId", async () => {
      const provider = createProvider();
      mockFetch([
        { number: 1, title: "A", body: null, state: "open", labels: [], html_url: "", user: null },
        { number: 2, title: "B", body: null, state: "open", labels: [], html_url: "", user: null },
      ]);

      const tickets = await provider.findReadyTickets({ ticketId: "#2" });
      expect(tickets).toHaveLength(1);
      expect(tickets[0].externalId).toBe("#2");
    });

    it("should throw on authentication failure", async () => {
      const provider = createProvider();
      mockFetch({ message: "Bad credentials" }, 401);

      await expect(provider.findReadyTickets()).rejects.toThrow("Bad credentials");
    });
  });

  describe("claimTicket", () => {
    it("should claim a ticket by swapping labels", async () => {
      const provider = createProvider();

      // GET issue
      mockFetch({
        number: 1,
        title: "Fix bug",
        body: null,
        state: "open",
        labels: [{ name: "codewright:ready", color: "00ff00" }],
        html_url: "",
        user: null,
      });

      // PATCH issue
      mockFetch({});

      const result = await provider.claimTicket(
        { id: "1", externalId: "#1", title: "Fix bug" },
        { branchName: "codewright/1-fix-bug" },
      );

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("should return alreadyClaimed if label was removed", async () => {
      const provider = createProvider();

      // GET issue without ready label
      mockFetch({
        number: 1,
        title: "Fix bug",
        body: null,
        state: "open",
        labels: [{ name: "codewright:working", color: "ffff00" }],
        html_url: "",
        user: null,
      });

      const result = await provider.claimTicket(
        { id: "1", externalId: "#1", title: "Fix bug" },
        { branchName: "codewright/1-fix-bug" },
      );

      expect(result.success).toBe(false);
      expect(result.alreadyClaimed).toBe(true);
    });
  });

  describe("updateStatus", () => {
    it("should update issue labels based on status", async () => {
      const provider = createProvider();

      // GET issue
      mockFetch({
        number: 1,
        title: "Fix bug",
        body: null,
        state: "open",
        labels: [{ name: "codewright:working", color: "ffff00" }],
        html_url: "",
        user: null,
      });

      // PATCH issue
      mockFetch({});

      await provider.updateStatus(
        { id: "1", externalId: "#1", title: "Fix bug" },
        "review",
      );

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const patchCall = fetchSpy.mock.calls[1];
      const body = JSON.parse(patchCall[1].body);
      expect(body.labels).toContain("codewright:review");
    });
  });

  describe("addComment", () => {
    it("should add a comment to the issue", async () => {
      const provider = createProvider();
      mockFetch({ id: 1, body: "Test comment" });

      await provider.addComment(
        { id: "1", externalId: "#1", title: "Fix bug" },
        "Test comment",
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain("/issues/1/comments");
      const body = JSON.parse(call[1].body);
      expect(body.body).toBe("Test comment");
    });
  });

  describe("error handling", () => {
    it("should throw on missing token", async () => {
      const provider = githubIssues({ owner: "test", repo: "test" });
      await expect(provider.findReadyTickets()).rejects.toThrow("Missing GITHUB_TOKEN");
    });

    it("should throw on missing owner/repo", async () => {
      const provider = githubIssues({ token: "ghp_test" });
      await expect(provider.findReadyTickets()).rejects.toThrow("Missing GITHUB_REPOSITORY");
    });

    it("should handle rate limit errors", async () => {
      const provider = createProvider();
      mockFetch({ message: "API rate limit exceeded" }, 429, { "Retry-After": "30" });

      await expect(provider.findReadyTickets()).rejects.toThrow("Rate limit exceeded");
    });
  });
});
