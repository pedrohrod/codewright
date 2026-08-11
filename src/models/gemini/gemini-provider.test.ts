import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  gemini,
  GeminiLanguageModel,
} from "./gemini-provider.js";
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

const API_KEY = "test-gemini-key-abc123";
const MODEL = "gemini-2.0-flash";

function config(overrides?: Partial<ModelConfig>): ModelConfig {
  return { apiKey: API_KEY, model: MODEL, ...overrides };
}

function geminiSuccessResponse(text = "Hello from Gemini") {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: { parts: [{ text }] },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function geminiErrorResponse(status: number, message: string) {
  return new Response(
    JSON.stringify({
      error: { code: status, message, status: "ERROR" },
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

describe("gemini() factory", () => {
  it("creates provider with valid config", () => {
    const provider = gemini(config());
    expect(provider).toBeInstanceOf(Object);
    expect(provider.name).toBe("gemini");
  });

  it("createModel returns GeminiLanguageModel", () => {
    const provider = gemini(config());
    const model = provider.createModel(config());
    expect(model).toBeInstanceOf(GeminiLanguageModel);
    expect(model.modelId).toBe(MODEL);
  });

  it("validate() succeeds with valid config", () => {
    const provider = gemini(config());
    expect(() => provider.validate()).not.toThrow();
  });

  it("throws ModelAuthenticationError when apiKey is empty", () => {
    expect(() => gemini(config({ apiKey: "" }))).toThrow(ModelAuthenticationError);
  });

  it("throws ModelError when model is empty", () => {
    expect(() => gemini(config({ model: "" }))).toThrow(ModelError);
  });
});

describe("GeminiLanguageModel.generate", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct request to Gemini API", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(config());
    await model.generate({ messages: [{ role: "user", content: "Hi" }] });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;

    expect(url).toContain("/v1beta/models/gemini-2.0-flash:generateContent");
    expect(url).toContain(`key=${API_KEY}`);
    expect(init!.method).toBe("POST");

    const body = JSON.parse(init!.body as string);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
    ]);
  });

  it("maps system messages to systemInstruction", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(config());
    await model.generate({
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hi" },
      ],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.systemInstruction).toEqual({
      parts: [{ text: "You are helpful" }],
    });
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
    ]);
  });

  it("maps assistant role to model role", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(config());
    await model.generate({
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
        { role: "user", content: "How are you?" },
      ],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hello!" }] },
      { role: "user", parts: [{ text: "How are you?" }] },
    ]);
  });

  it("returns correct response shape", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse("Test reply"));

    const model = new GeminiLanguageModel(config());
    const response = await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(response).toEqual({
      content: "Test reply",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      model: MODEL,
      finishReason: "STOP",
    });
  });

  it("includes temperature and maxTokens in request", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(config());
    await model.generate({
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.7,
      maxTokens: 100,
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.generationConfig).toEqual({
      temperature: 0.7,
      maxOutputTokens: 100,
    });
  });

  it("handles multiple system messages by joining", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(config());
    await model.generate({
      messages: [
        { role: "system", content: "Rule 1" },
        { role: "system", content: "Rule 2" },
        { role: "user", content: "Hi" },
      ],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("Rule 1\n\nRule 2");
  });

  it("merges consecutive same-role messages", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(config());
    await model.generate({
      messages: [
        { role: "user", content: "A" },
        { role: "user", content: "B" },
      ],
    });

    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "A" }, { text: "B" }] },
    ]);
  });

  it("returns empty usage when usageMetadata is missing", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: "OK" }] }, finishReason: "STOP" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const model = new GeminiLanguageModel(config());
    const response = await model.generate({
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(response.usage).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("throws ModelAuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(geminiErrorResponse(401, "Unauthorized"));

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelAuthenticationError);
  });

  it("throws ModelAuthenticationError on 403", async () => {
    fetchSpy.mockResolvedValueOnce(geminiErrorResponse(403, "Forbidden"));

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelAuthenticationError);
  });

  it("throws ModelRateLimitError on 429", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: 429, message: "Rate limited", status: "RESOURCE_EXHAUSTED" } }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "5" },
        },
      ),
    );

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelRateLimitError);
  });

  it("throws ModelResponseError on invalid JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
    );

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelResponseError);
  });

  it("throws ModelResponseError when no candidates", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ candidates: [] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelResponseError);
  });

  it("throws ModelError on network failure", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelError);
  });

  it("throws ModelError on general HTTP errors", async () => {
    fetchSpy.mockResolvedValueOnce(geminiErrorResponse(500, "Internal error"));

    const model = new GeminiLanguageModel(config());
    await expect(
      model.generate({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow(ModelError);
  });

  it("uses custom baseURL when provided", async () => {
    fetchSpy.mockResolvedValueOnce(geminiSuccessResponse());

    const model = new GeminiLanguageModel(
      config({ baseURL: "https://custom-proxy.example.com" }),
    );
    await model.generate({ messages: [{ role: "user", content: "Hi" }] });

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("custom-proxy.example.com");
  });
});
