import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TrelloTicketProvider,
  trello,
  type TrelloConfig,
} from "./trello-ticket-provider.js";
import type { TicketStatus } from "../ticket-provider.js";
import {
  ProviderAuthenticationError,
  ProviderNotFoundError,
  ProviderRateLimitError,
  ProviderError,
} from "../errors.js";

const DEFAULT_CONFIG: TrelloConfig = {
  apiKey: "test-key",
  token: "test-token",
  boardId: "board-123",
  readyList: "To Do",
  workingList: "In Progress",
  reviewList: "Review",
  blockedList: "Blocked",
};

const MOCK_LISTS = [
  { id: "list-ready-id", name: "To Do" },
  { id: "list-working-id", name: "In Progress" },
  { id: "list-review-id", name: "Review" },
  { id: "list-blocked-id", name: "Blocked" },
  { id: "list-other-id", name: "Done" },
];

function makeCard(overrides: Partial<{
  id: string;
  name: string;
  desc: string;
  url: string;
  labels: Array<{ id: string; name: string }>;
  idList: string;
  shortLink: string;
  idShort: number;
}> = {}): Record<string, unknown> {
  return {
    id: "card-abc123",
    name: "Implement feature X",
    desc: "Description of feature X",
    url: "https://trello.com/c/abc123/feature-x",
    labels: [{ id: "l1", name: "feature" }],
    idList: "list-ready-id",
    shortLink: "abc123",
    idShort: 42,
    ...overrides,
  };
}

function mockFetch(responses: Array<{ status: number; body: unknown; headers?: Record<string, string> }>) {
  let callIndex = 0;
  return vi.fn().mockImplementation(async (_url: string, _init?: RequestInit) => {
    const idx = Math.min(callIndex, responses.length - 1);
    callIndex++;
    const { status, body, headers = {} } = responses[idx];
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
    });
  });
}

describe("TrelloTicketProvider", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("factory function", () => {
    it("should create a TrelloTicketProvider instance", () => {
      const provider = trello(DEFAULT_CONFIG);
      expect(provider).toBeInstanceOf(TrelloTicketProvider);
      expect(provider.name).toBe("trello");
    });
  });

  describe("list resolution", () => {
    it("should resolve list names to IDs on first access", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets();

      expect(tickets).toEqual([]);
      // First call fetches lists, second fetches cards
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it("should use direct IDs when value looks like an ID", async () => {
      const configWithIds: TrelloConfig = {
        ...DEFAULT_CONFIG,
        readyList: "60a1b2c3d4e5f6a7b8c9d0e1",
        workingList: "60a1b2c3d4e5f6a7b8c9d0e2",
        reviewList: "60a1b2c3d4e5f6a7b8c9d0e3",
        blockedList: "60a1b2c3d4e5f6a7b8c9d0e4",
      };

      globalThis.fetch = mockFetch([
        { status: 200, body: [] },
      ]);

      const provider = trello(configWithIds);
      const tickets = await provider.findReadyTickets();

      expect(tickets).toEqual([]);
      // Should only call fetch once (for cards), not for lists
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it("should throw ProviderNotFoundError for unresolvable list name", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
      ]);

      const provider = trello({
        ...DEFAULT_CONFIG,
        readyList: "Nonexistent List",
      });

      await expect(provider.findReadyTickets()).rejects.toThrow(
        ProviderNotFoundError,
      );
    });

    it("should cache list resolution across calls", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [] },
        { status: 200, body: [] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await provider.findReadyTickets();
      await provider.findReadyTickets();

      // Lists should only be fetched once
      const listCalls = vi.mocked(globalThis.fetch).mock.calls.filter(
        (call) => (call[0] as string).includes("/lists?"),
      );
      expect(listCalls).toHaveLength(1);
    });
  });

  describe("findReadyTickets", () => {
    it("should convert Trello cards to normalized tickets", async () => {
      const card = makeCard();
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [card] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets();

      expect(tickets).toHaveLength(1);
      expect(tickets[0]).toEqual({
        id: "card-abc123",
        externalId: "abc123",
        title: "Implement feature X",
        description: "Description of feature X",
        url: "https://trello.com/c/abc123/feature-x",
        labels: ["feature"],
      });
    });

    it("should handle cards with no labels", async () => {
      const card = makeCard({ labels: [] });
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [card] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets();

      expect(tickets[0].labels).toEqual([]);
    });

    it("should handle cards with empty description", async () => {
      const card = makeCard({ desc: "" });
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [card] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets();

      expect(tickets[0].description).toBeUndefined();
    });

    it("should apply limit option", async () => {
      const cards = [
        makeCard({ id: "c1", name: "Card 1" }),
        makeCard({ id: "c2", name: "Card 2" }),
        makeCard({ id: "c3", name: "Card 3" }),
      ];
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: cards },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets({ limit: 2 });

      expect(tickets).toHaveLength(2);
      expect(tickets[0].id).toBe("c1");
      expect(tickets[1].id).toBe("c2");
    });

    it("should filter by ticketId when specified", async () => {
      const cards = [
        makeCard({ id: "c1", name: "Card 1" }),
        makeCard({ id: "c2", name: "Card 2" }),
      ];
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: cards },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets({ ticketId: "c2" });

      expect(tickets).toHaveLength(1);
      expect(tickets[0].id).toBe("c2");
    });

    it("should use idShort as externalId when shortLink is missing", async () => {
      const card = makeCard({ shortLink: undefined, idShort: 99 });
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [card] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const tickets = await provider.findReadyTickets();

      expect(tickets[0].externalId).toBe("99");
    });
  });

  describe("getTicket", () => {
    it("should fetch and convert a single card", async () => {
      const card = makeCard();
      globalThis.fetch = mockFetch([
        { status: 200, body: card },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const ticket = await provider.getTicket("card-abc123");

      expect(ticket.id).toBe("card-abc123");
      expect(ticket.title).toBe("Implement feature X");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("claimTicket", () => {
    it("should succeed when card is in ready list", async () => {
      const card = makeCard({ idList: "list-ready-id" });
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: card },
        { status: 200, body: { ...card, idList: "list-working-id" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const result = await provider.claimTicket(
        { id: "card-abc123", externalId: "abc123", title: "Test" },
        { branchName: "feature/test" },
      );

      expect(result).toEqual({ success: true });
    });

    it("should fail when card is not in ready list", async () => {
      const card = makeCard({ idList: "list-working-id" });
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: card },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const result = await provider.claimTicket(
        { id: "card-abc123", externalId: "abc123", title: "Test" },
        {},
      );

      expect(result).toEqual({ success: false, alreadyClaimed: true });
    });

    it("should send PUT to move card to working list", async () => {
      const card = makeCard({ idList: "list-ready-id" });
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: card },
        { status: 200, body: { ...card, idList: "list-working-id" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await provider.claimTicket(
        { id: "card-abc123", externalId: "abc123", title: "Test" },
        {},
      );

      const putCall = vi.mocked(globalThis.fetch).mock.calls[2];
      expect(putCall[1]?.method).toBe("PUT");
      expect(putCall[0] as string).toContain("idList=list-working-id");
    });
  });

  describe("updateStatus", () => {
    it("should move card to correct list for each status", async () => {
      const statusMappings: Array<[string, string]> = [
        ["ready", "list-ready-id"],
        ["in_progress", "list-working-id"],
        ["review", "list-review-id"],
        ["blocked", "list-blocked-id"],
        ["failed", "list-blocked-id"],
        ["completed", "list-review-id"],
      ];

      for (const [status, expectedList] of statusMappings) {
        globalThis.fetch = mockFetch([
          { status: 200, body: MOCK_LISTS },
          { status: 200, body: {} },
        ]);

        const provider = trello(DEFAULT_CONFIG);
        await provider.updateStatus(
          { id: "card-abc123", externalId: "abc123", title: "Test" },
          status as TicketStatus,
        );

        const putCall = vi.mocked(globalThis.fetch).mock.calls[1];
        expect(putCall[0] as string).toContain(`idList=${expectedList}`);
      }
    });
  });

  describe("addComment", () => {
    it("should POST comment to card", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: {} },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await provider.addComment(
        { id: "card-abc123", externalId: "abc123", title: "Test" },
        "This is a comment",
      );

      const postCall = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(postCall[1]?.method).toBe("POST");
      expect(postCall[0] as string).toContain("/actions/comments");
      expect(postCall[0] as string).toContain(
        `text=${encodeURIComponent("This is a comment")}`,
      );
    });

    it("should encode special characters in comments", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: {} },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      const comment = "Line 1\nLine 2 & special <chars>";
      await provider.addComment(
        { id: "card-abc123", externalId: "abc123", title: "Test" },
        comment,
      );

      const postCall = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(postCall[0] as string).toContain(
        `text=${encodeURIComponent(comment)}`,
      );
    });
  });

  describe("releaseTicket", () => {
    it("should move card back to ready list", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: {} },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await provider.releaseTicket(
        { id: "card-abc123", externalId: "abc123", title: "Test" },
      );

      const putCall = vi.mocked(globalThis.fetch).mock.calls[1];
      expect(putCall[1]?.method).toBe("PUT");
      expect(putCall[0] as string).toContain("idList=list-ready-id");
    });
  });

  describe("error handling", () => {
    it("should throw ProviderAuthenticationError on 401", async () => {
      globalThis.fetch = mockFetch([
        { status: 401, body: { error: "Unauthorized" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await expect(provider.getTicket("card-abc123")).rejects.toThrow(
        ProviderAuthenticationError,
      );
    });

    it("should throw ProviderNotFoundError on 404", async () => {
      globalThis.fetch = mockFetch([
        { status: 404, body: { error: "Not found" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await expect(provider.getTicket("card-abc123")).rejects.toThrow(
        ProviderNotFoundError,
      );
    });

    it("should throw ProviderRateLimitError on 429", async () => {
      globalThis.fetch = mockFetch([
        {
          status: 429,
          body: { error: "Rate limit exceeded" },
          headers: { "retry-after": "5" },
        },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      try {
        await provider.getTicket("card-abc123");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRateLimitError);
        expect((error as ProviderRateLimitError).retryAfterMs).toBe(5000);
      }
    });

    it("should default retryAfterMs when no retry-after header", async () => {
      globalThis.fetch = mockFetch([
        { status: 429, body: { error: "Rate limit exceeded" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      try {
        await provider.getTicket("card-abc123");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderRateLimitError);
        expect((error as ProviderRateLimitError).retryAfterMs).toBe(10_000);
      }
    });

    it("should throw ProviderError for other HTTP errors", async () => {
      globalThis.fetch = mockFetch([
        { status: 500, body: { error: "Internal error" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      try {
        await provider.getTicket("card-abc123");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).message).toContain("500");
      }
    });
  });

  describe("auth params", () => {
    it("should include key and token on all requests", async () => {
      globalThis.fetch = mockFetch([
        { status: 200, body: MOCK_LISTS },
        { status: 200, body: [] },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      await provider.findReadyTickets();

      for (const call of vi.mocked(globalThis.fetch).mock.calls) {
        const url = call[0] as string;
        expect(url).toContain("key=test-key");
        expect(url).toContain("token=test-token");
      }
    });

    it("should never include tokens in error messages", async () => {
      globalThis.fetch = mockFetch([
        { status: 401, body: { error: "Unauthorized" } },
      ]);

      const provider = trello(DEFAULT_CONFIG);
      try {
        await provider.getTicket("card-abc123");
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).not.toContain("test-token");
        expect((error as Error).message).not.toContain("test-key");
      }
    });
  });
});
