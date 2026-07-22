import { describe, expect, it } from "vitest";
import {
  AGENT_TARGETS,
  formatAgentMenu,
  parseAgentTargets,
  parseInteractiveAgentSelection,
} from "./registry.js";

describe("agent target selection", () => {
  it("parses canonical ids, aliases, duplicates, all, and core", () => {
    expect(parseAgentTargets("claude,cursor,claude")).toEqual(["claude", "cursor"]);
    expect(parseAgentTargets("claude-code,gemini-cli,github-copilot")).toEqual([
      "claude",
      "gemini",
      "copilot",
    ]);
    expect(parseAgentTargets("all")).toEqual(AGENT_TARGETS);
    expect(parseAgentTargets("core")).toEqual([]);
  });

  it("rejects unknown and conflicting special selections", () => {
    expect(() => parseAgentTargets("unknown")).toThrow("Unknown agent");
    expect(() => parseAgentTargets("all,claude")).toThrow("cannot be combined");
    expect(() => parseAgentTargets("core,cursor")).toThrow("cannot be combined");
  });

  it("maps interactive numbers and documents all eight agents", () => {
    expect(parseInteractiveAgentSelection("2,8")).toEqual(["claude", "cursor"]);
    expect(parseInteractiveAgentSelection("all")).toEqual(AGENT_TARGETS);
    expect(parseInteractiveAgentSelection("")).toEqual([]);
    expect(formatAgentMenu()).toContain("Claude Code");
    expect(formatAgentMenu()).toContain("Cursor");
  });
});
