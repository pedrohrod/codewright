import { execFileSync } from "node:child_process";
import type { Tool } from "./tool.js";

/** Commands allowed to run via shell tool */
const ALLOWED_COMMANDS = ["npm", "node", "npx", "git", "tsc", "eslint", "vitest"];

/** Timeout for shell commands (60 seconds) */
const TIMEOUT_MS = 60_000;

/**
 * Shell tool — execute commands safely using execFileSync.
 * No shell involved, so no shell injection is possible.
 */
export function shell(): Tool {
  return {
    name: "shell",
    description: `Execute a shell command. Allowed commands: ${ALLOWED_COMMANDS.join(", ")}`,
    parameters: {
      command: {
        type: "string",
        description: "Command to execute (must be in allowlist)",
        required: true,
      },
      args: {
        type: "string[]",
        description: "Arguments to pass to the command",
        required: false,
      },
    },
    async execute(input: Record<string, unknown>): Promise<string> {
      const command = input.command as string;
      const args = (input.args as string[]) ?? [];

      if (!command) {
        throw new Error("command is required");
      }

      if (!ALLOWED_COMMANDS.includes(command)) {
        throw new Error(
          `Command not allowed: ${command}. Allowed: ${ALLOWED_COMMANDS.join(", ")}`,
        );
      }

      try {
        const stdout = execFileSync(command, args, {
          encoding: "utf-8",
          timeout: TIMEOUT_MS,
          maxBuffer: 1024 * 1024, // 1MB
        });

        return stdout.trim() || "(no output)";
      } catch (err: unknown) {
        const error = err as { status?: number; stderr?: string; message?: string };
        const stderr = error.stderr?.trim() ?? "";
        const status = error.status ?? "unknown";
        return `Exit code: ${status}\n${stderr || error.message || "Unknown error"}`;
      }
    },
  };
}
