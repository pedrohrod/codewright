export const AGENT_TARGETS = [
  "codex",
  "claude",
  "gemini",
  "copilot",
  "opencode",
  "windsurf",
  "cline",
  "cursor",
] as const;

export type AgentTarget = (typeof AGENT_TARGETS)[number];

export type AgentAdapter = "canonical" | "skill-wrapper" | "cursor-command";

export interface AgentDefinition {
  id: AgentTarget;
  label: string;
  adapter: AgentAdapter;
  aliases: readonly string[];
}

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  { id: "codex", label: "Codex", adapter: "canonical", aliases: ["openai-codex"] },
  { id: "claude", label: "Claude Code", adapter: "skill-wrapper", aliases: ["claude-code"] },
  { id: "gemini", label: "Gemini CLI", adapter: "canonical", aliases: ["gemini-cli"] },
  { id: "copilot", label: "GitHub Copilot", adapter: "canonical", aliases: ["github-copilot"] },
  { id: "opencode", label: "OpenCode", adapter: "canonical", aliases: ["open-code"] },
  { id: "windsurf", label: "Windsurf", adapter: "canonical", aliases: ["cascade"] },
  { id: "cline", label: "Cline", adapter: "skill-wrapper", aliases: [] },
  { id: "cursor", label: "Cursor", adapter: "cursor-command", aliases: ["cursor-agent"] },
] as const;

const AGENT_LOOKUP = new Map<string, AgentTarget>();
for (const definition of AGENT_DEFINITIONS) {
  AGENT_LOOKUP.set(definition.id, definition.id);
  for (const alias of definition.aliases) AGENT_LOOKUP.set(alias, definition.id);
}

export function getAgentDefinition(target: AgentTarget): AgentDefinition {
  return AGENT_DEFINITIONS.find((definition) => definition.id === target)!;
}

export function parseAgentTargets(value: string): AgentTarget[] {
  const tokens = value.split(",").map((token) => token.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) throw new Error("Agent selection cannot be empty. Use 'core' for the universal skill set.");
  if (tokens.includes("all")) {
    if (tokens.length !== 1) throw new Error("'all' cannot be combined with individual agents.");
    return [...AGENT_TARGETS];
  }
  if (tokens.includes("core")) {
    if (tokens.length !== 1) throw new Error("'core' cannot be combined with individual agents.");
    return [];
  }

  const selected: AgentTarget[] = [];
  for (const token of tokens) {
    const target = AGENT_LOOKUP.get(token);
    if (!target) {
      throw new Error(`Unknown agent '${token}'. Valid values: ${AGENT_TARGETS.join(", ")}, all, core.`);
    }
    if (!selected.includes(target)) selected.push(target);
  }
  return selected;
}

export function parseInteractiveAgentSelection(value: string): AgentTarget[] {
  const answer = value.trim().toLowerCase();
  if (!answer || answer === "core") return [];
  if (answer === "all") return [...AGENT_TARGETS];

  const tokens = answer.split(",").map((token) => token.trim()).filter(Boolean);
  const normalized = tokens.map((token) => {
    if (!/^\d+$/.test(token)) return token;
    const index = Number(token) - 1;
    if (index < 0 || index >= AGENT_TARGETS.length) {
      throw new Error(`Agent number '${token}' is outside the available range.`);
    }
    return AGENT_TARGETS[index];
  });
  return parseAgentTargets(normalized.join(","));
}

export function formatAgentMenu(): string {
  const lines = ["Select AI agents (comma-separated numbers, 'all', or Enter for core only):"];
  AGENT_DEFINITIONS.forEach((definition, index) => {
    const mode = definition.adapter === "canonical" ? "uses universal core" : "installs native adapter";
    lines.push(`  ${index + 1}. ${definition.label} — ${mode}`);
  });
  return lines.join("\n");
}
