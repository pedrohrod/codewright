import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { anthropic } from "./anthropic-provider.js";
import {
  ModelAuthenticationError,
  ModelRateLimitError,
  ModelNotFoundError,
  ModelTimeoutError,
  ModelResponseError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Record<string, unknown>) {
  return {
    apiKey: "sk-ant-test-key",
    model: "claude-sonnet-4-20250514",
    ...overrides,
  };
}

function fakeAnthropicResponse(overrides?: Record<string, unknown>) {
  return {
    id: "msg_test123",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "Hello from Claude" }],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    usage: { input_tokens: 10, output_tokens: 20 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("anthropic()", () => {
  it("returns a provider with name 'anthropic'", () => {
    const provider = anthropic(makeConfig());
    expect(provider.name).toBe("anthropic");
  });

  // -- validate() -----------------------------------------------------------

  describe("validate()", () => {
    it("does not throw when apiKey is present", () => {
      const provider = anthropic(makeConfig());
      expect(() => provider.validate()).not.toThrow();
    });

    it("throws ModelAuthenticationError when apiKey is empty", () => {
      const provider = anthropic(makeConfig({ apiKey: "" }));
      expect(() => provider.validate()).toThrow(ModelAuthenticationError);
    });

    it("throws ModelAuthenticationError when apiKey is whitespace", () => {
      const provider = anthropic(makeConfig({ apiKey: "   " }));
      expect(() => provider.validate()).toThrow(ModelAuthenticationError);
    });
  });

  // -- createModel() --------------------------------------------------------

  describe("createModel()", () => {
    it("returns a LanguageModel with correct name and modelId", () => {
      const provider = anthropic(makeConfig());
      const model = provider.createModel();
      expect(model.name).toBe("anthropic");
      expect(model.modelId).toBe("claude-sonnet-4-20250514");
    });

    it("allows overriding model via createModel config", () => {
      const provider = anthropic(makeConfig());
      const model = provider.createModel({ model: "claude-3-haiku" });
      expect(model.modelId).toBe("claude-3-haiku");
    });
  });

  // -- generate() -----------------------------------------------------------

  describe("generate()", () => {
    it("sends a successful request with correct headers and body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fakeAnthropicResponse(),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      const result = await model.generate({
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hi" },
        ],
      });

      expect(result.content).toBe("Hello from Claude");
      expect(result.model).toBe("claude-sonnet-4-20250514");
      expect(result.finishReason).toBe("end_turn");
      expect(result.usage).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });

      // Verify request was made correctly
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init.method).toBe("POST");
      expect(init.headers).toMatchObject({
        "x-api-key": "sk-ant-test-key",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      });

      const body = JSON.parse(init.body);
      expect(body.model).toBe("claude-sonnet-4-20250514");
      expect(body.system).toBe("You are a helpful assistant.");
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
      expect(body.max_tokens).toBe(4096);
    });

    it("concatenates multiple system messages into the system parameter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fakeAnthropicResponse(),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      await model.generate({
        messages: [
          { role: "system", content: "Rule 1" },
          { role: "system", content: "Rule 2" },
          { role: "user", content: "Hello" },
        ],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBe("Rule 1\nRule 2");
      expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
    });

    it("sends no system field when there are no system messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fakeAnthropicResponse(),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      await model.generate({
        messages: [{ role: "user", content: "Hello" }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBeUndefined();
    });

    it("passes temperature, maxTokens, and stop_sequences", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fakeAnthropicResponse(),
      });

      const provider = anthropic(makeConfig({ temperature: 0.5 }));
      const model = provider.createModel();

      await model.generate({
        messages: [{ role: "user", content: "Hello" }],
        temperature: 0.8,
        maxTokens: 1024,
        stop: ["STOP"],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.8);
      expect(body.max_tokens).toBe(1024);
      expect(body.stop_sequences).toEqual(["STOP"]);
    });

    it("uses config temperature when call-level temperature is absent", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fakeAnthropicResponse(),
      });

      const provider = anthropic(makeConfig({ temperature: 0.3 }));
      const model = provider.createModel();

      await model.generate({
        messages: [{ role: "user", content: "Hello" }],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBe(0.3);
    });

    it("uses custom baseURL when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => fakeAnthropicResponse(),
      });

      const provider = anthropic(
        makeConfig({ baseURL: "https://proxy.example.com" }),
      );
      const model = provider.createModel();

      await model.generate({
        messages: [{ role: "user", content: "Hello" }],
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        "https://proxy.example.com/v1/messages",
      );
    });

    // -- Error handling ------------------------------------------------------

    it("throws ModelAuthenticationError on 401", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({ error: { message: "Invalid API key" } }),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      await expect(
        model.generate({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow(ModelAuthenticationError);
    });

    it("throws ModelRateLimitError on 429", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "30" }),
        text: async () =>
          JSON.stringify({ error: { message: "Rate limited" } }),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      await expect(
        model.generate({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow(ModelRateLimitError);
    });

    it("throws ModelNotFoundError on 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({ error: { message: "Model not found" } }),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      await expect(
        model.generate({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow(ModelNotFoundError);
    });

    it("throws ModelTimeoutError when fetch aborts", async () => {
      // Simulate an AbortError using a plain Error with the correct name
      const abortError = new Error("The operation was aborted.");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const provider = anthropic(makeConfig({ timeout: 100 }));
      const model = provider.createModel();

      await expect(
        model.generate({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow(ModelTimeoutError);
    });

    it("throws ModelResponseError on unexpected status codes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        text: async () => "Internal Server Error",
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      await expect(
        model.generate({ messages: [{ role: "user", content: "Hi" }] }),
      ).rejects.toThrow(ModelResponseError);
    });

    it("never exposes the API key in error messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({ error: { message: "Auth failed" } }),
      });

      const provider = anthropic(makeConfig());
      const model = provider.createModel();

      try {
        await model.generate({ messages: [{ role: "user", content: "Hi" }] });
        expect.fail("Should have thrown");
      } catch (err) {
        expect((err as Error).message).not.toContain("sk-ant-test-key");
      }
    });
  });
});
