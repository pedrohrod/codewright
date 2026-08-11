import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sentry, SentryTicketProvider } from "./sentry-ticket-provider.js";

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
  token: "sntrys_test-token-123",
  organization: "test-org",
  project: "test-project",
};

function createProvider(overrides?: Record<string, unknown>) {
  return sentry({ ...DEFAULT_CONFIG, ...overrides });
}

function makeSentryIssue(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "123",
    shortId: "TEST-1A",
    title: "TypeError: Cannot read property 'map' of undefined",
    culprit: "src/components/List.tsx in renderItems",
    type: "error",
    level: "error",
    status: "unresolved",
    firstSeen: "2026-01-01T00:00:00Z",
    lastSeen: "2026-08-11T12:00:00Z",
    count: "42",
    userCount: 7,
    metadata: {
      title: "TypeError: Cannot read property 'map' of undefined",
      type: "TypeError",
    },
    permalink: "https://sentry.io/organizations/test-org/issues/123/",
    ...overrides,
  };
}

function makeSentryEvent() {
  return {
    eventID: "abc-123",
    exception: {
      values: [
        {
          type: "TypeError",
          value: "Cannot read property 'map' of undefined",
          stacktrace: {
            frames: [
              {
                filename: "node_modules/react-dom/index.js",
                function: "renderRoot",
                lineno: 100,
                colno: 5,
                in_app: false,
              },
              {
                filename: "src/components/List.tsx",
                function: "renderItems",
                lineno: 25,
                colno: 12,
                context_line: "  return items.map(item => <Item key={item.id} />)",
                in_app: true,
              },
              {
                filename: "src/components/List.tsx",
                function: "List",
                lineno: 10,
                colno: 5,
                context_line: "  const items = data?.items;",
                in_app: true,
              },
            ],
          },
        },
      ],
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("SentryTicketProvider", () => {
  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("factory", () => {
    it("should create a provider instance", () => {
      const provider = createProvider();
      expect(provider).toBeInstanceOf(SentryTicketProvider);
      expect(provider.name).toBe("sentry");
    });
  });

  describe("ensureConfigured", () => {
    it("should throw on missing token", async () => {
      const provider = sentry({ organization: "org" });
      await expect(provider.findReadyTickets()).rejects.toThrow("Missing SENTRY_AUTH_TOKEN");
    });

    it("should throw on missing organization", async () => {
      const provider = sentry({ token: "sntrys_test" });
      await expect(provider.findReadyTickets()).rejects.toThrow("Missing SENTRY_ORG");
    });
  });

  describe("findReadyTickets", () => {
    it("should fetch unresolved issues with correct query", async () => {
      const provider = createProvider();

      // Mock issue list
      mockFetch([makeSentryIssue()]);
      // Mock events for stacktrace
      mockFetch([makeSentryEvent()]);

      const tickets = await provider.findReadyTickets();

      expect(tickets).toHaveLength(1);
      expect(tickets[0].id).toBe("123");
      expect(tickets[0].externalId).toBe("TEST-1A");
      expect(tickets[0].title).toBe("TypeError: Cannot read property 'map' of undefined");
      expect(tickets[0].url).toBe("https://sentry.io/organizations/test-org/issues/123/");
      expect(tickets[0].labels).toContain("error");

      // Verify the query parameter
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain("query=is%3Aunresolved");
    });

    it("should include stacktrace in description", async () => {
      const provider = createProvider();
      mockFetch([makeSentryIssue()]);
      mockFetch([makeSentryEvent()]);

      const tickets = await provider.findReadyTickets();

      expect(tickets[0].description).toContain("**Stacktrace:**");
      expect(tickets[0].description).toContain("renderItems");
      expect(tickets[0].description).toContain("src/components/List.tsx");
      // Should NOT include node_modules frames
      expect(tickets[0].description).not.toContain("react-dom");
    });

    it("should respect limit option", async () => {
      const provider = createProvider();
      mockFetch([
        makeSentryIssue({ id: "1", shortId: "A-1" }),
        makeSentryIssue({ id: "2", shortId: "A-2" }),
        makeSentryIssue({ id: "3", shortId: "A-3" }),
      ]);
      // Mock events for each issue
      mockFetch([makeSentryEvent()]);
      mockFetch([makeSentryEvent()]);

      const tickets = await provider.findReadyTickets({ limit: 2 });
      expect(tickets).toHaveLength(2);
    });

    it("should filter by ticketId", async () => {
      const provider = createProvider();
      mockFetch([
        makeSentryIssue({ id: "1", shortId: "A-1" }),
        makeSentryIssue({ id: "2", shortId: "A-2" }),
      ]);
      mockFetch([makeSentryEvent()]);

      const tickets = await provider.findReadyTickets({ ticketId: "2" });
      expect(tickets).toHaveLength(1);
      expect(tickets[0].id).toBe("2");
    });

    it("should add level filter to query", async () => {
      const provider = createProvider({ level: "fatal" });
      mockFetch([]);
      await provider.findReadyTickets();

      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain("level%3Afatal");
    });

    it("should handle self-hosted Sentry URL", async () => {
      const provider = createProvider({ serverUrl: "https://sentry.mycompany.com" });
      mockFetch([]);
      await provider.findReadyTickets();

      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain("https://sentry.mycompany.com");
    });
  });

  describe("getTicket", () => {
    it("should fetch a single issue with events", async () => {
      const provider = createProvider();
      mockFetch(makeSentryIssue());
      mockFetch([makeSentryEvent()]);

      const ticket = await provider.getTicket("123");

      expect(ticket.id).toBe("123");
      expect(ticket.title).toContain("TypeError");
      expect(ticket.description).toContain("**Stacktrace:**");
    });
  });

  describe("claimTicket", () => {
    it("should verify issue is still unresolved", async () => {
      const provider = createProvider();
      mockFetch(makeSentryIssue());

      const result = await provider.claimTicket(
        { id: "123", externalId: "TEST-1A", title: "Test" },
        { branchName: "codewright/123-fix" },
      );

      expect(result.success).toBe(true);
    });

    it("should return alreadyClaimed if issue is resolved", async () => {
      const provider = createProvider();
      mockFetch(makeSentryIssue({ status: "resolved" }));

      const result = await provider.claimTicket(
        { id: "123", externalId: "TEST-1A", title: "Test" },
        { branchName: "codewright/123-fix" },
      );

      expect(result.success).toBe(false);
      expect(result.alreadyClaimed).toBe(true);
    });
  });

  describe("updateStatus", () => {
    it("should resolve issue when status is completed", async () => {
      const provider = createProvider();
      mockFetch({});

      await provider.updateStatus(
        { id: "123", externalId: "TEST-1A", title: "Test" },
        "completed",
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain("/issues/123/");
      expect(call[1].method).toBe("PUT");
      const body = JSON.parse(call[1].body);
      expect(body.status).toBe("resolved");
    });
  });

  describe("addComment", () => {
    it("should add a comment to the issue", async () => {
      const provider = createProvider();
      mockFetch({});

      await provider.addComment(
        { id: "123", externalId: "TEST-1A", title: "Test" },
        "PR created: https://github.com/org/repo/pull/1",
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0];
      expect(call[0]).toContain("/issues/123/comments/");
      const body = JSON.parse(call[1].body);
      expect(body.data).toContain("PR created");
    });
  });

  describe("error handling", () => {
    it("should throw on authentication failure", async () => {
      const provider = createProvider();
      mockFetch({ detail: "Invalid token" }, 401);

      await expect(provider.findReadyTickets()).rejects.toThrow("Invalid token");
    });

    it("should handle rate limit errors", async () => {
      const provider = createProvider();
      mockFetch({ detail: "Rate limit exceeded" }, 429, { "Retry-After": "30" });

      await expect(provider.findReadyTickets()).rejects.toThrow("Rate limit exceeded");
    });

    it("should handle 404 errors", async () => {
      const provider = createProvider();
      mockFetch({ detail: "Not found" }, 404);

      await expect(provider.getTicket("999")).rejects.toThrow("Not found");
    });
  });

  describe("stacktrace extraction", () => {
    it("should filter out node_modules frames", async () => {
      const provider = createProvider();
      mockFetch([makeSentryIssue()]);
      mockFetch([makeSentryEvent()]);

      const tickets = await provider.findReadyTickets();

      expect(tickets[0].description).not.toContain("react-dom");
      expect(tickets[0].description).toContain("renderItems");
    });

    it("should handle events without stacktrace", async () => {
      const provider = createProvider();
      mockFetch([makeSentryIssue()]);
      mockFetch([{ eventID: "no-stack" }]); // No exception

      const tickets = await provider.findReadyTickets();

      expect(tickets[0].description).not.toContain("**Stacktrace:**");
    });

    it("should handle fetch events failure gracefully", async () => {
      const provider = createProvider();
      // Issue list endpoint returns the issue
      mockFetch([makeSentryIssue()]);
      // Events endpoint returns error
      mockFetch({ detail: "Internal server error" }, 500);

      // Should still return ticket, just without stacktrace
      const tickets = await provider.findReadyTickets();
      expect(tickets).toHaveLength(1);
      expect(tickets[0].description).toContain("**Error Type:**");
    });
  });
});
