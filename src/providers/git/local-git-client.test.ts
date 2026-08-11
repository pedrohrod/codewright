import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalGitClient } from "./local-git-client.js";

function createTestRepo(): string {
  const tmpDir = mkdtempSync(join(tmpdir(), "git-client-test-"));
  execSync("git init", { cwd: tmpDir });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir });
  execSync('git config user.name "Test"', { cwd: tmpDir });

  writeFileSync(join(tmpDir, "README.md"), "# Test", "utf-8");
  execSync("git add -A", { cwd: tmpDir });
  execSync('git commit -m "initial"', { cwd: tmpDir });

  return tmpDir;
}

describe("LocalGitClient", () => {
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

  describe("constructor / basic validation", () => {
    it("should throw on non-git directory operations", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "no-git-"));
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      await expect(client.currentBranch()).rejects.toThrow();
    });
  });

  describe("currentBranch", () => {
    it("should return current branch name", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      const branch = await client.currentBranch();
      expect(branch).toMatch(/^(main|master)$/);
    });
  });

  describe("createBranch", () => {
    it("should create and checkout a new branch", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      await client.createBranch("feature/test");
      const branch = await client.currentBranch();
      expect(branch).toBe("feature/test");
    });

    it("should throw when branch already exists", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      await client.createBranch("existing");
      await expect(client.createBranch("existing")).rejects.toThrow("Failed to create branch");
    });
  });

  describe("add", () => {
    it("should stage all files when no files specified", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "new.txt"), "hello", "utf-8");
      await client.add();

      const status = await client.status();
      expect(status.stagedFiles).toContain("new.txt");
    });

    it("should stage specific files", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "a.txt"), "a", "utf-8");
      writeFileSync(join(tmpDir, "b.txt"), "b", "utf-8");
      await client.add(["a.txt"]);

      const status = await client.status();
      expect(status.stagedFiles).toContain("a.txt");
      expect(status.stagedFiles).not.toContain("b.txt");
    });

    it("should gracefully skip nonexistent files", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "real.txt"), "real", "utf-8");
      await client.add(["real.txt", "nope.txt"]);

      const status = await client.status();
      expect(status.stagedFiles).toContain("real.txt");
    });
  });

  describe("commit", () => {
    it("should create a commit with the given message", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "feature.ts"), "const x = 1;", "utf-8");
      await client.add(["feature.ts"]);
      await client.commit("feat: add feature");

      const log = execSync("git log --oneline -1", {
        cwd: tmpDir,
        encoding: "utf-8",
      }).trim();
      expect(log).toContain("feat: add feature");
    });

    it("should throw when nothing to commit", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      await expect(client.commit("empty commit")).rejects.toThrow("Failed to commit");
    });
  });

  describe("push", () => {
    it("should throw when no remote is configured", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      await client.createBranch("feature/push-test");
      writeFileSync(join(tmpDir, "push.txt"), "data", "utf-8");
      await client.add(["push.txt"]);
      await client.commit("test push");

      await expect(
        client.push({ branch: "feature/push-test" }),
      ).rejects.toThrow("Failed to push");
    });
  });

  describe("diff", () => {
    it("should return diff of unstaged changes", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "change.ts"), "original", "utf-8");
      await client.add(["change.ts"]);
      await client.commit("add change");

      // Modify without staging
      writeFileSync(join(tmpDir, "change.ts"), "modified", "utf-8");
      const diff = await client.diff();
      expect(diff).toContain("modified");
    });

    it("should return empty string when no changes", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      const diff = await client.diff();
      expect(diff).toBe("");
    });
  });

  describe("diffStaged", () => {
    it("should return diff of staged changes", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "staged.ts"), "new content", "utf-8");
      await client.add(["staged.ts"]);
      const diff = await client.diffStaged();
      expect(diff).toContain("new content");
    });

    it("should return empty string when nothing staged", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      const diff = await client.diffStaged();
      expect(diff).toBe("");
    });
  });

  describe("hasChanges", () => {
    it("should return true when there are uncommitted changes", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      writeFileSync(join(tmpDir, "dirty.txt"), "dirty", "utf-8");
      expect(await client.hasChanges()).toBe(true);
    });

    it("should return false on a clean repo", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      expect(await client.hasChanges()).toBe(false);
    });
  });

  describe("headSha", () => {
    it("should return the HEAD commit SHA", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      const sha = await client.headSha();
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });
  });

  describe("branchSha", () => {
    it("should return SHA for an existing branch", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      const sha = await client.branchSha("HEAD");
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    });

    it("should throw for a nonexistent branch", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      await expect(client.branchSha("nonexistent")).rejects.toThrow("does not exist");
    });
  });

  describe("status", () => {
    it("should return full status with branches and file categories", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      // Create an untracked file
      writeFileSync(join(tmpDir, "untracked.txt"), "new", "utf-8");
      // Create a worktree-modified file (committed then modified without re-staging)
      writeFileSync(join(tmpDir, "modified.txt"), "v1", "utf-8");
      await client.add(["modified.txt"]);
      await client.commit("add modified");
      writeFileSync(join(tmpDir, "modified.txt"), "v2", "utf-8");
      // Create a staged file (staged but not committed)
      writeFileSync(join(tmpDir, "staged.txt"), "staged content", "utf-8");
      await client.add(["staged.txt"]);

      const status = await client.status();
      console.log("DEBUG STATUS:", JSON.stringify(status, null, 2));
      expect(status.currentBranch).toMatch(/^(main|master)$/);
      expect(status.isDirty).toBe(true);
      expect(status.stagedFiles).toContain("staged.txt");
      expect(status.modifiedFiles).toContain("modified.txt");
      expect(status.untrackedFiles).toContain("untracked.txt");
    });

    it("should report clean status on a fresh repo", async () => {
      const tmpDir = createTestRepo();
      tmpDirs.push(tmpDir);
      const client = new LocalGitClient(tmpDir);

      const status = await client.status();
      expect(status.isDirty).toBe(false);
      expect(status.stagedFiles).toHaveLength(0);
      expect(status.modifiedFiles).toHaveLength(0);
      expect(status.untrackedFiles).toHaveLength(0);
    });
  });
});
