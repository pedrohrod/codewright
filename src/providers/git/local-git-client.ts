import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { GitClient, GitStatus, PushOptions } from "./git-client.js";

/**
 * Local git operations backed by execFileSync.
 * Safe from shell injection — no shell involved.
 */
export class LocalGitClient implements GitClient {
  constructor(private readonly cwd: string) {}

  private run(args: string[]): string {
    return execFileSync("git", args, {
      cwd: this.cwd,
      encoding: "utf-8",
    }).trim();
  }

  /** Run git command without trimming — needed for porcelain output where leading spaces are significant. */
  private runRaw(args: string[]): string {
    return execFileSync("git", args, {
      cwd: this.cwd,
      encoding: "utf-8",
    });
  }

  private runNoThrow(args: string[]): string {
    try {
      return this.run(args);
    } catch {
      throw new Error(`git command failed: git ${args.join(" ")}`);
    }
  }

  async status(): Promise<GitStatus> {
    const currentBranch = this.runNoThrow(["rev-parse", "--abbrev-ref", "HEAD"]);
    const porcelain = this.runRaw(["status", "--porcelain", "--untracked-files=all"]).trimEnd();

    const stagedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const untrackedFiles: string[] = [];

    if (porcelain) {
      for (const line of porcelain.split("\n")) {
        if (line.length < 3) continue;

        // Git porcelain format: XY <path>
        // X = index status (column 1), Y = worktree status (column 2)
        // Column 3+ is the path (may or may not have a separator space)
        const indexStatus = line.charAt(0);
        const worktreeStatus = line.charAt(1);
        // Path starts at column 2, may have leading space
        const filePath = line.substring(2).trimStart();

        // Untracked files: ?? path
        if (indexStatus === "?" && worktreeStatus === "?") {
          untrackedFiles.push(filePath);
        } else {
          // Staged if index status is not space or ?
          if (indexStatus !== " " && indexStatus !== "?") {
            stagedFiles.push(filePath);
          }
          // Modified in worktree if worktree status is not space or ?
          if (worktreeStatus !== " " && worktreeStatus !== "?") {
            modifiedFiles.push(filePath);
          }
        }
      }
    }

    return {
      currentBranch,
      isDirty: stagedFiles.length + modifiedFiles.length + untrackedFiles.length > 0,
      stagedFiles,
      modifiedFiles,
      untrackedFiles,
    };
  }

  async currentBranch(): Promise<string> {
    return this.runNoThrow(["rev-parse", "--abbrev-ref", "HEAD"]);
  }

  async createBranch(name: string): Promise<void> {
    try {
      this.run(["checkout", "-b", name]);
    } catch {
      throw new Error(`Failed to create branch '${name}'`);
    }
  }

  async add(files?: string[]): Promise<void> {
    if (!files || files.length === 0) {
      this.run(["add", "-A"]);
      return;
    }

    const existing = files.filter((f) => existsSync(join(this.cwd, f)));
    if (existing.length > 0) {
      this.run(["add", "--", ...existing]);
    }
  }

  async commit(message: string): Promise<void> {
    try {
      this.run(["commit", "-m", message]);
    } catch {
      throw new Error(`Failed to commit: ${message}`);
    }
  }

  async push(options: PushOptions): Promise<void> {
    const remote = options.remote || "origin";
    const args = ["push", "-u", remote, options.branch];
    if (options.force) {
      args.splice(2, 0, "--force");
    }

    try {
      this.run(args);
    } catch {
      throw new Error(`Failed to push to ${remote}/${options.branch}`);
    }
  }

  async diff(): Promise<string> {
    return this.runNoThrow(["diff"]);
  }

  async diffStaged(): Promise<string> {
    return this.runNoThrow(["diff", "--cached"]);
  }

  async hasChanges(): Promise<boolean> {
    const output = this.runNoThrow(["status", "--porcelain"]);
    return output.length > 0;
  }

  async headSha(): Promise<string> {
    return this.runNoThrow(["rev-parse", "HEAD"]);
  }

  async branchSha(branch: string): Promise<string> {
    try {
      return this.run(["rev-parse", branch]);
    } catch {
      throw new Error(`Branch '${branch}' does not exist`);
    }
  }
}
