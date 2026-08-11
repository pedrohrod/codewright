import { describe, it, expect } from "vitest";
import { shell } from "./shell.js";
import type { ToolContext } from "./tool.js";

describe("shell tool", () => {
  const ctx: ToolContext = { cwd: process.cwd() };

  it("should execute allowed command", async () => {
    const tool = shell();
    const result = await tool.execute({ command: "node", args: ["--version"] }, ctx);
    expect(result).toMatch(/^v\d+\.\d+\.\d+/);
  });

  it("should reject disallowed command", async () => {
    const tool = shell();
    await expect(
      tool.execute({ command: "rm", args: ["-rf", "/"] }, ctx),
    ).rejects.toThrow("Command not allowed");
  });

  it("should handle command with no output", async () => {
    const tool = shell();
    const result = await tool.execute({ command: "node", args: ["-e", ""] }, ctx);
    // node -e "" produces no output
    expect(result).toBe("(no output)");
  });

  it("should return error info for failed command", async () => {
    const tool = shell();
    const result = await tool.execute({ command: "node", args: ["-e", "process.exit(1)"] }, ctx);
    expect(result).toContain("Exit code: 1");
  });

  it("should throw on missing command", async () => {
    const tool = shell();
    await expect(tool.execute({}, ctx)).rejects.toThrow("command is required");
  });
});
