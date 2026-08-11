import { execFileSync } from "node:child_process";
import type { Tool } from "./tool.js";

/**
 * Run a git command safely using execFileSync.
 */
function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    timeout: 30_000,
  }).trim();
}

/**
 * Git diff tool — show changes.
 */
export function gitDiff(): Tool {
  return {
    name: "git_diff",
    description: "Show git diff of current changes",
    parameters: {
      args: {
        type: "string[]",
        description: "Additional git diff arguments (e.g., ['--staged'])",
        required: false,
      },
    },
    async execute(input: Record<string, unknown>, context): Promise<string> {
      const extraArgs = (input.args as string[]) ?? [];
      const diff = runGit(["diff", ...extraArgs], context.cwd);
      return diff || "(no changes)";
    },
  };
}

/**
 * Git status tool — show working tree status.
 */
export function gitStatus(): Tool {
  return {
    name: "git_status",
    description: "Show git status of the working tree",
    parameters: {},
    async execute(_input: Record<string, unknown>, context): Promise<string> {
      const status = runGit(["status", "--porcelain"], context.cwd);
      const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], context.cwd);
      const output = [`Branch: ${branch}`, ""];
      if (status) {
        output.push(status);
      } else {
        output.push("(clean)");
      }
      return output.join("\n");
    },
  };
}

/**
 * Git log tool — show recent commits.
 */
export function gitLog(): Tool {
  return {
    name: "git_log",
    description: "Show recent git commits",
    parameters: {
      count: {
        type: "number",
        description: "Number of commits to show (default: 10)",
        required: false,
      },
    },
    async execute(input: Record<string, unknown>, context): Promise<string> {
      const count = (input.count as number) ?? 10;
      const log = runGit(
        ["log", `--max-count=${count}`, "--oneline", "--decorate"],
        context.cwd,
      );
      return log || "(no commits)";
    },
  };
}
