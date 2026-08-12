import { describe, it, expect } from "vitest";
import type { LanguageModel, ModelCallOptions, ModelResponse } from "../models/language-model.js";
import { runAgent } from "./runtime.js";
import type { AgentDefinition, AgentInput } from "./runtime.js";
import type { Tool } from "./tools/tool.js";

/**
 * Mock language model for testing.
 * Supports returning a sequence of responses.
 */
function createMockModel(responses: ModelResponse[]): LanguageModel {
  let callIndex = 0;
  return {
    name: "mock",
    modelId: "mock-model",
    async generate(_options: ModelCallOptions): Promise<ModelResponse> {
      const response = responses[Math.min(callIndex, responses.length - 1)];
      callIndex++;
      return response;
    },
  };
}

function mockResponse(content: string): ModelResponse {
  return {
    content,
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    model: "mock-model",
    finishReason: "stop",
  };
}

function createAgent(model: LanguageModel, tools?: Tool[]): AgentDefinition {
  return {
    name: "test-agent",
    systemPrompt: "You are a test agent.",
    model,
    tools,
    maxTurns: 5,
  };
}

function createUserMessage(content: string): AgentInput {
  return { messages: [{ role: "user", content }] };
}

describe("runAgent", () => {
  it("should return model response when no tool calls", async () => {
    const model = createMockModel([mockResponse("Hello!")]);
    const agent = createAgent(model);

    const result = await runAgent(agent, createUserMessage("hi"));
    expect(result.content).toBe("Hello!");
    expect(result.turns).toBe(1);
    expect(result.toolCalls).toHaveLength(0);
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(50);
  });

  it("should handle tool calls and return final answer", async () => {
    const mockTool: Tool = {
      name: "test_tool",
      description: "A test tool",
      parameters: {
        input: { type: "string", description: "Input", required: true },
      },
      async execute(input): Promise<string> {
        return `Result: ${input.input}`;
      },
    };

    // First response: tool call
    // Second response: final answer (no tool call)
    const model = createMockModel([
      mockResponse(
        'Let me use the tool.\n[TOOL_CALL: test_tool]\n[INPUT: {"input": "hello"}]\n[END_TOOL_CALL]',
      ),
      mockResponse("The tool returned: Result: hello"),
    ]);

    const agent = createAgent(model, [mockTool]);
    const result = await runAgent(agent, createUserMessage("use the tool"));

    expect(result.content).toBe("The tool returned: Result: hello");
    expect(result.turns).toBe(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe("test_tool");
    expect(result.toolCalls[0].output).toBe("Result: hello");
    expect(result.toolCalls[0].success).toBe(true);
  });

  it("should handle tool not found", async () => {
    const model = createMockModel([
      mockResponse(
        '[TOOL_CALL: unknown_tool]\n[INPUT: {"key": "val"}]\n[END_TOOL_CALL]',
      ),
      mockResponse("Tool not found"),
    ]);

    const agent = createAgent(model, []);
    const result = await runAgent(agent, createUserMessage("use tool"));

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].success).toBe(false);
    expect(result.toolCalls[0].output).toContain("not found");
  });

  it("should handle tool execution error", async () => {
    const failingTool: Tool = {
      name: "fail_tool",
      description: "Always fails",
      parameters: {},
      async execute(): Promise<string> {
        throw new Error("Tool broke");
      },
    };

    const model = createMockModel([
      mockResponse(
        '[TOOL_CALL: fail_tool]\n[INPUT: {}]\n[END_TOOL_CALL]',
      ),
      mockResponse("Recovered from error"),
    ]);

    const agent = createAgent(model, [failingTool]);
    const result = await runAgent(agent, createUserMessage("do it"));

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].success).toBe(false);
    expect(result.toolCalls[0].output).toContain("Tool broke");
  });

  it("should stop at maxTurns", async () => {
    const tool: Tool = {
      name: "loop_tool",
      description: "Loops",
      parameters: {},
      async execute(): Promise<string> {
        return "ok";
      },
    };

    // Always returns a tool call
    const alwaysToolCall = mockResponse(
      '[TOOL_CALL: loop_tool]\n[INPUT: {}]\n[END_TOOL_CALL]',
    );
    const model = createMockModel([
      alwaysToolCall,
      alwaysToolCall,
      alwaysToolCall,
      alwaysToolCall,
      alwaysToolCall,
      alwaysToolCall,
      mockResponse("Final answer after max turns"),
    ]);

    const agent = createAgent(model, [tool]);
    agent.maxTurns = 5;
    const result = await runAgent(agent, createUserMessage("loop"));

    expect(result.turns).toBe(5);
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });

  it("should accumulate token usage across turns", async () => {
    const tool: Tool = {
      name: "usage_tool",
      description: "For counting",
      parameters: {},
      async execute(): Promise<string> {
        return "done";
      },
    };

    const model = createMockModel([
      mockResponse('[TOOL_CALL: usage_tool]\n[INPUT: {}]\n[END_TOOL_CALL]'),
      mockResponse("Finished"),
    ]);

    const agent = createAgent(model, [tool]);
    const result = await runAgent(agent, createUserMessage("go"));

    expect(result.usage.inputTokens).toBe(200); // 100 + 100
    expect(result.usage.outputTokens).toBe(100); // 50 + 50
  });
});
