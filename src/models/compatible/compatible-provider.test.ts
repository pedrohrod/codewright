import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  openaiCompatible,
  CompatibleLanguageModel,
} from "./compatible-provider.js";
import {
  ModelAuthenticationError,
  ModelRateLimitError,
  ModelError,
  ModelResponseError,
} from "../errors.js";
import type { ModelConfig } from "../model-provider.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_KEY = "test-openai-key-abc123";
const BASE_URL = "https://api.example.com/v1";
const MODEL = "gpt-4o";

function config(overrides?: Partial<ModelConfig & { baseURL: string }>): ModelConfig & { baseURL: string } {
  return { apiKey: API_KEY, model: MODEL, baseURL: BASE_URL, ...overrides };
}

function openaiSuccessResponse(content = "Hello from OpenAI-compatible") {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test123",
      choices: [
        {
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function openaiErrorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({
      error: { message, type: "invalid_request_error", code: "error_code" },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("openaiCompatible() factory", () => {
  it("creates provider with valid config", () => {
    const provider = openaiCompatible(config());
    expect(provider).toBeInstanceOf(Object);
    expect(provider.name).toBe("openai-compatible");
  });

  it("createModel returns CompatibleLanguageModel", () => {
    const provider = openaiCompatible(config());
    const model = provider.createModel(config());
    expect(model).toBeInstanceOf(CompatibleLanguageModel);
    expect(model.modelId).toBe(MODEL);
  });

  it("validate() succeeds with valid config", () => {
    const provider = openaiCompatible(config());
    expect(() => provider.validate()).not.toThrow();
  });

  it("throws ModelAuthenticationError when apiKey is empty", () => {
    expect(() => openaiCompatible(config({ apiKey: "" }))).toThrow(
      ModelAuthenticationError,
    );
  });

  it("throws ModelError when baseURL is empty", () => {
    expect(() => openaiCompatible(config({ baseURL: "" }))).toThrow(ModelError);
  });

  it("throws ModelError when model is empty", () => {
    expect(() => openaiCompatible(config({ model: "" }))).toThrow(ModelError);
  });
});

describe("CompatibleLanguageModel.generate", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct request to chat/completions endpoint", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(config());
    await model.generate({ messages: [{ role: "user", content: "Hi" }] });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;

    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect(init!.method).toBe("POST");
    expect(init!.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    });

    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({
      model: MODEL,
      messages: [{ role: "user", content: "Hi" }],
    });
  });

  it("passes system messages as-is in messages array", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(config());
    await model.generate({
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
      ],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
    ]);
  });

  it("returns correct response shape", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse("Test reply"));

    const model = new CompatibleLanguageModel(config());
    const response = await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(response).toEqual({
      content: "Test reply",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: MODEL,
      finishReason: "stop",
    });
  });

  it("includes temperature and maxTokens in request", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(config());
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.5,
      maxTokens: 200,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(200);
  });

  it("includes stop sequences in request", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(config());
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
      stop: ["\n\n", "END"],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.stop).toEqual(["\n\n", "END"]);
  });

  it("does not send stop when empty array", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(config());
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
      stop: [],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body).not.toHaveProperty("stop");
  });

  it("returns empty usage when usage is missing", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "chatcmpl-test",
          choices: [{ message: { role: "assistant", content: "OK" }, finish_reason: "stop" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const model = new CompatibleLanguageModel(config());
    const response = await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("throws ModelAuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(openaiErrorResponse(401, "Unauthorized"));

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelAuthenticationError);
  });

  it("throws ModelAuthenticationError on 403", async () => {
    fetchSpy.mockResolvedValueOnce(openaiErrorResponse(403, "Forbidden"));

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelAuthenticationError);
  });

  it("throws ModelRateLimitError on 429", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: "Rate limited", type: "rate_limit_error", code: "rate_limited" } }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "3" },
        },
      ),
    );

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelRateLimitError);
  });

  it("throws ModelResponseError on invalid JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelResponseError);
  });

  it("throws ModelResponseError when no choices", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "chatcmpl-test", choices: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelResponseError);
  });

  it("throws ModelError on network failure", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelError);
  });

  it("throws ModelError on general HTTP errors", async () => {
    fetchSpy.mockResolvedValueOnce(openaiErrorResponse(500, "Server error"));

    const model = new CompatibleLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelError);
  });

  it("strips trailing slashes from baseURL", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(
      config({ baseURL: "https://api.example.com/v1///" }),
    );
    await model.generate({ messages: [{ role: "user", content: "Hi" }] });

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toBe("https://api.example.com/v1/chat/completions");
  });

  it("handles multiple messages in order", async () => {
    fetchSpy.mockResolvedValueOnce(openaiSuccessResponse());

    const model = new CompatibleLanguageModel(config());
    await model.generate({
      messages: [
        { role: "system", content: "Be concise" },
        { role: "user", content: "What is 2+2?" },
        { role: "assistant", content: "4" },
        { role: "user", content: "And 3+3?" },
      ],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.messages).toEqual([
      { role: "system", content: "Be concise" },
      { role: "user", content: "What is 2+2?" },
      { role: "assistant", content: "4" },
      { role: "user", content: "And 3+3?" },
    ]);
  });
});
