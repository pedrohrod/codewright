import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  OpenAIProvider,
  openai,
} from "./openai-provider.js";
import {
  ModelAuthenticationError,
  ModelRateLimitError,
  ModelNotFoundError,
  ModelTimeoutError,
  ModelError,
  ModelResponseError,
} from "../errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_KEY = "sk-test-key-12345";
const MODEL = "gpt-4o";

function openAIResponse(
  content: string,
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number },
  extras?: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: usage ?? {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
      model: MODEL,
      ...extras,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function errorResponse(status: number, message?: string, headers: Record<string, string> = {}) {
  const body = message
    ? { error: { message } }
    : {};
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

describe("openai() factory", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("creates provider from explicit config", () => {
    const provider = openai({ apiKey: API_KEY, model: MODEL });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe("openai");
  });

  it("creates provider from env vars", () => {
    process.env.OPENAI_API_KEY = "env-key";
    const provider = openai();
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe("openai");
  });

  it("uses default model when not specified", () => {
    process.env.OPENAI_API_KEY = "env-key";
    const provider = openai();
    const model = provider.createModel();
    expect(model.modelId).toBe("gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// validate()
// ---------------------------------------------------------------------------

describe("validate()", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes with valid key", () => {
    const provider = openai({ apiKey: API_KEY });
    expect(() => provider.validate()).not.toThrow();
  });

  it("throws ModelAuthenticationError when key is empty", () => {
    const provider = openai({ apiKey: "" });
    expect(() => provider.validate()).toThrow(ModelAuthenticationError);
  });

  it("throws ModelAuthenticationError when key is whitespace only", () => {
    const provider = openai({ apiKey: "   " });
    expect(() => provider.validate()).toThrow(ModelAuthenticationError);
  });

  it("throws ModelAuthenticationError when key is missing (env not set)", () => {
    delete process.env.OPENAI_API_KEY;
    const provider = openai();
    expect(() => provider.validate()).toThrow(ModelAuthenticationError);
  });
});

// ---------------------------------------------------------------------------
// generate() — success
// ---------------------------------------------------------------------------

describe("generate() — success", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns normalized ModelResponse", async () => {
    fetchSpy.mockResolvedValueOnce(
      openAIResponse("Hello, world!", {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      }),
    );

    const provider = openai({ apiKey: API_KEY, model: MODEL });
    const model = provider.createModel();
    const response = await model.generate({
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(response.content).toBe("Hello, world!");
    expect(response.model).toBe(MODEL);
    expect(response.finishReason).toBe("stop");
    expect(response.usage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
    });
  });

  it("sends correct headers and body", async () => {
    fetchSpy.mockResolvedValueOnce(openAIResponse("ok"));

    const provider = openai({
      apiKey: API_KEY,
      model: MODEL,
      temperature: 0.7,
      maxTokens: 100,
    });
    const model = provider.createModel();
    await model.generate({
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        { role: "user", content: "How are you?" },
      ],
      temperature: 0.5,
      maxTokens: 50,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0];

    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe(`Bearer ${API_KEY}`);

    const body = JSON.parse(opts.body);
    expect(body.model).toBe(MODEL);
    expect(body.messages).toEqual([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "How are you?" },
    ]);
    // Call-level overrides win
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(50);
  });

  it("uses config defaults when call options omit them", async () => {
    fetchSpy.mockResolvedValueOnce(openAIResponse("ok"));

    const provider = openai({
      apiKey: API_KEY,
      model: MODEL,
      temperature: 0.3,
      maxTokens: 200,
    });
    const model = provider.createModel();
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// generate() — JSON mode
// ---------------------------------------------------------------------------

describe("generate() — JSON mode", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("includes response_format when jsonMode is true", async () => {
    fetchSpy.mockResolvedValueOnce(
      openAIResponse('{"key":"value"}'),
    );

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();
    await model.generate({
      messages: [{ role: "user", content: "Return JSON" }],
      jsonMode: true,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("does not include response_format when jsonMode is false", async () => {
    fetchSpy.mockResolvedValueOnce(openAIResponse("plain text"));

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();
    await model.generate({
      messages: [{ role: "user", content: "Say hi" }],
      jsonMode: false,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// generate() — custom baseURL
// ---------------------------------------------------------------------------

describe("generate() — custom baseURL", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses custom base URL", async () => {
    fetchSpy.mockResolvedValueOnce(openAIResponse("ok"));

    const provider = openai({
      apiKey: API_KEY,
      baseURL: "https://my-proxy.example.com/v1",
    });
    const model = provider.createModel();
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://my-proxy.example.com/v1/chat/completions",
    );
  });
});

// ---------------------------------------------------------------------------
// generate() — error handling
// ---------------------------------------------------------------------------

describe("generate() — error handling", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ModelAuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(401, "Invalid API key"));

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();

    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelAuthenticationError);
  });

  it("throws ModelRateLimitError on 429 with Retry-After", async () => {
    fetchSpy.mockResolvedValueOnce(
      errorResponse(429, "Rate limited", { "Retry-After": "30" }),
    );

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();

    try {
      await model.generate({ messages: [{ role: "user", content: "Hi" }] });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ModelRateLimitError);
      expect((err as ModelRateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  it("throws ModelRateLimitError on 429 without Retry-After", async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(429, "Rate limited"));

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();

    try {
      await model.generate({ messages: [{ role: "user", content: "Hi" }] });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ModelRateLimitError);
      expect((err as ModelRateLimitError).retryAfterMs).toBeUndefined();
    }
  });

  it("throws ModelNotFoundError on 404", async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(404, "Model not found"));

    const provider = openai({ apiKey: API_KEY, model: "gpt-99" });
    const model = provider.createModel();

    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelNotFoundError);
  });

  it("throws ModelTimeoutError on 408", async () => {
    fetchSpy.mockResolvedValueOnce(errorResponse(408, "Request timeout"));

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();

    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelTimeoutError);
  });

  it("throws ModelError on 500 with error detail", async () => {
    fetchSpy.mockResolvedValueOnce(
      errorResponse(500, "Internal server error"),
    );

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();

    try {
      await model.generate({ messages: [{ role: "user", content: "Hi" }] });
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ModelError);
      expect((err as ModelError).message).toContain("500");
      expect((err as ModelError).message).toContain("Internal server error");
    }
  });

  it("throws ModelResponseError when choices array is empty", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: MODEL,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const provider = openai({ apiKey: API_KEY });
    const model = provider.createModel();

    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelResponseError);
  });
});

// ---------------------------------------------------------------------------
// generate() — timeout
// ---------------------------------------------------------------------------

describe("generate() — timeout", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws ModelTimeoutError when AbortController fires", async () => {
    // Simulate an abort by rejecting with AbortError
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    fetchSpy.mockRejectedValueOnce(abortError);

    const provider = openai({ apiKey: API_KEY, timeout: 100 });
    const model = provider.createModel();

    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelTimeoutError);
  });
});

// ---------------------------------------------------------------------------
// generate() — API key safety
// ---------------------------------------------------------------------------

describe("generate() — API key safety", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends API key in Authorization header, never in URL or body", async () => {
    fetchSpy.mockResolvedValueOnce(openAIResponse("ok"));

    const secretKey = "sk-super-secret-abc123";
    const provider = openai({ apiKey: secretKey });
    const model = provider.createModel();
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    const [url, opts] = fetchSpy.mock.calls[0];

    // URL should not contain the key
    expect(url).not.toContain(secretKey);

    // Body should not contain the key
    expect(opts.body).not.toContain(secretKey);

    // Header should have it
    expect(opts.headers.Authorization).toBe(`Bearer ${secretKey}`);
  });
});
