import type { LanguageModel, Message, ModelResponse } from "../models/language-model.js";
import type { Tool } from "./tools/tool.js";

/**
 * Agent definition — describes how an agent should behave.
 */
export interface AgentDefinition {
  /** Agent name for identification */
  name: string;
  /** System prompt that defines the agent's behavior */
  systemPrompt: string;
  /** Language model to use */
  model: LanguageModel;
  /** Available tools */
  tools?: Tool[];
  /** Maximum number of tool-use turns (default: 10) */
  maxTurns?: number;
  /** Temperature for model calls */
  temperature?: number;
  /** Maximum output tokens */
  maxTokens?: number;
}

/**
 * Input to the agent — the conversation messages.
 */
export interface AgentInput {
  messages: Message[];
}

/**
 * Record of a tool call made by the agent.
 */
export interface ToolCallRecord {
  /** Tool name */
  tool: string;
  /** Input provided to the tool */
  input: Record<string, unknown>;
  /** Output returned by the tool */
  output: string;
  /** Whether the tool call succeeded */
  success: boolean;
}

/**
 * Result from running an agent.
 */
export interface AgentResult {
  /** Final content from the model */
  content: string;
  /** Token usage */
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Number of tool-use turns completed */
  turns: number;
  /** All tool calls made during execution */
  toolCalls: ToolCallRecord[];
}

/**
 * Parse tool calls from model output.
 * Looks for format: [TOOL_CALL: tool_name]\n[INPUT: {"key": "value"}]\n[END_TOOL_CALL]
 */
function parseToolCalls(content: string): Array<{ name: string; input: Record<string, unknown> }> {
  const calls: Array<{ name: string; input: Record<string, unknown> }> = [];

  const toolCallRegex = /\[TOOL_CALL:\s*(\w+)\]\s*\n\s*\[INPUT:\s*(\{.*?\})\]\s*\n\s*\[END_TOOL_CALL\]/gs;

  let match: RegExpExecArray | null;
  while ((match = toolCallRegex.exec(content)) !== null) {
    const name = match[1];
    try {
      const input = JSON.parse(match[2]) as Record<string, unknown>;
      calls.push({ name, input });
    } catch {
      // Skip malformed tool calls
    }
  }

  return calls;
}

/**
 * Build tool descriptions for the system prompt.
 */
function buildToolDescriptions(tools: Tool[]): string {
  const sections = tools.map((tool) => {
    const params = Object.entries(tool.parameters)
      .map(([name, desc]) => {
        const required = desc.required ? " (required)" : " (optional)";
        return `    - ${name}: ${desc.description}${required} [${desc.type}]`;
      })
      .join("\n");

    return `  - ${tool.name}: ${tool.description}\n${params}`;
  });

  return [
    "Available tools:",
    sections.join("\n\n"),
    "",
    "To use a tool, output in this exact format:",
    "[TOOL_CALL: tool_name]",
    '[INPUT: {"param1": "value1", "param2": "value2"}]',
    "[END_TOOL_CALL]",
    "",
    "You may call multiple tools in sequence. After each tool result, decide whether to call another tool or provide your final answer.",
  ].join("\n");
}

/**
 * Run an agent with a model and tools.
 * Supports multi-turn tool use loops.
 */
export async function runAgent(
  agent: AgentDefinition,
  input: AgentInput,
): Promise<AgentResult> {
  const { systemPrompt, model, tools = [], maxTurns = 10, temperature, maxTokens } = agent;

  const toolContext = {
    cwd: process.cwd(),
  };

  // Build initial messages: system + conversation
  const messages: Message[] = [];

  // Build system prompt with tool descriptions
  let fullSystemPrompt = systemPrompt;
  if (tools.length > 0) {
    fullSystemPrompt += "\n\n" + buildToolDescriptions(tools);
  }
  messages.push({ role: "system", content: fullSystemPrompt });

  // Add conversation messages
  messages.push(...input.messages);

  // Track results
  const toolCalls: ToolCallRecord[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turns = 0;

  // Agent loop
  while (turns < maxTurns) {
    turns++;

    // Call model
    const response: ModelResponse = await model.generate({
      messages,
      temperature,
      maxTokens,
    });

    totalInputTokens += response.usage.inputTokens;
    totalOutputTokens += response.usage.outputTokens;

    // Parse tool calls from response
    const parsedCalls = parseToolCalls(response.content);

    // If no tool calls, return result
    if (parsedCalls.length === 0) {
      return {
        content: response.content,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
        turns,
        toolCalls,
      };
    }

    // Execute tool calls
    for (const call of parsedCalls) {
      const tool = tools.find((t) => t.name === call.name);
      let output: string;
      let success: boolean;

      if (!tool) {
        output = `Error: Tool "${call.name}" not found`;
        success = false;
      } else {
        try {
          output = await tool.execute(call.input, toolContext);
          success = true;
        } catch (err) {
          output = `Error: ${err instanceof Error ? err.message : String(err)}`;
          success = false;
        }
      }

      toolCalls.push({
        tool: call.name,
        input: call.input,
        output,
        success,
      });

      // Add tool result as assistant message (simulating tool response)
      messages.push({
        role: "assistant",
        content: `[TOOL_RESULT: ${call.name}]\n${output}\n[END_TOOL_RESULT]`,
      });
    }
  }

  // Max turns reached — make a final call to get a response without tool calls
  const finalResponse = await model.generate({
    messages: [
      ...messages,
      { role: "user", content: "Please provide your final answer now. Do not use any more tools." },
    ],
    temperature,
    maxTokens,
  });

  totalInputTokens += finalResponse.usage.inputTokens;
  totalOutputTokens += finalResponse.usage.outputTokens;

  return {
    content: finalResponse.content,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    },
    turns,
    toolCalls,
  };
}
