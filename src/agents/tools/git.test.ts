import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gitDiff, gitStatus, gitLog } from "./git.js";
import type { ToolContext } from "./tool.js";

function createTestRepo(): string {
  const tmpDir = mkdtempSync(join(tmpdir(), "git-tool-test-"));
  execSync("git init", { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });
  writeFileSync(join(tmpDir, "README.md"), "# Test", "utf-8");
  execSync("git add -A", { cwd: tmpDir });
  execSync('git commit -m "initial"', { cwd: tmpDir });
  return tmpDir;
}

describe("git tools", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
    tmpDirs.length = 0;
  });

  function ctx(cwd: string): ToolContext {
    return { cwd };
  }

  describe("gitDiff", () => {
    it("should return no changes message on clean repo", async () => {
      const dir = createTestRepo();
      tmpDirs.push(dir);

      const tool = gitDiff();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toBe("(no changes)");
    });

    it("should show unstaged changes", async () => {
      const dir = createTestRepo();
      tmpDirs.push(dir);

      // Modify a tracked file to create unstaged changes
      writeFileSync(join(dir, "README.md"), "# Modified", "utf-8");

      const tool = gitDiff();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toContain("Modified");
    });
  });

  describe("gitStatus", () => {
    it("should show branch and clean status", async () => {
      const dir = createTestRepo();
      tmpDirs.push(dir);

      const tool = gitStatus();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toContain("Branch:");
      expect(result).toContain("(clean)");
    });

    it("should show untracked files", async () => {
      const dir = createTestRepo();
      tmpDirs.push(dir);

      writeFileSync(join(dir, "untracked.txt"), "new", "utf-8");

      const tool = gitStatus();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toContain("untracked.txt");
    });
  });

  describe("gitLog", () => {
    it("should show commit history", async () => {
      const dir = createTestRepo();
      tmpDirs.push(dir);

      const tool = gitLog();
      const result = await tool.execute({}, ctx(dir));
      expect(result).toContain("initial");
    });

    it("should respect count parameter", async () => {
      const dir = createTestRepo();
      tmpDirs.push(dir);

      // Add more commits
      writeFileSync(join(dir, "a.txt"), "a", "utf-8");
      execSync("git add -A", { cwd: dir });
      execSync('git commit -m "second"', { cwd: dir });

      const tool = gitLog();
      const result = await tool.execute({ count: 1 }, ctx(dir));
      const lines = result.split("\n").filter((l) => l.trim());
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("second");
    });
  });
});
