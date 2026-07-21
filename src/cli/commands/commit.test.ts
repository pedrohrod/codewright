import { describe, it, expect, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { commitCommand } from "./commit.js";

const CLI = join(process.cwd(), "dist/cli/main.mjs");

function createTestRepo(): string {
  const tmpDir = mkdtempSync(join(tmpdir(), "commit-test-"));
  execSync(`git init`, { cwd: tmpDir });
  execSync(`git config user.email "test@test.com"`, { cwd: tmpDir });
  execSync(`git config user.name "Test"`, { cwd: tmpDir });

  // Create an initial commit so we have a baseline
  writeFileSync(join(tmpDir, "README.md"), "# Test", "utf-8");
  execSync(`git add -A`, { cwd: tmpDir });
  execSync(`git commit -m "initial"`, { cwd: tmpDir });

  return tmpDir;
}

function createStoryFile(tmpDir: string, spec: string, storyId: string, title: string): string {
  const storiesDir = join(tmpDir, ".codewright-output", "specs", `spec-${spec}`, "stories");
  mkdirSync(storiesDir, { recursive: true });

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `${storyId}-${slug}.md`;
  const content = `---
id: ${storyId}
status: in-progress
baseline_commit:
phase: 1
spec: ${spec}
---

# ${title}

## Intent
Problem: test
Approach: test

## I/O & Edge-Case Matrix
| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| 1 | Success  |       |                 |

## Code Map
- test.ts (CREATE)

## Tasks
- [ ] Task 1

## Change Log
`;

  writeFileSync(join(storiesDir, filename), content, "utf-8");
  return filename;
}

describe("commitCommand", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDirs.length = 0;
  });

  it("should throw when not a git repository", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "no-git-"));
    tmpDirs.push(tmpDir);

    expect(() => commitCommand(tmpDir, "test", "S001")).toThrow("Not a git repository");
  });

  it("should throw when story not found", () => {
    const tmpDir = createTestRepo();
    tmpDirs.push(tmpDir);

    execSync(`node ${CLI} init`, { cwd: tmpDir });
    execSync(`node ${CLI} spec test`, { cwd: tmpDir });
    createStoryFile(tmpDir, "test", "S001", "Existing story");

    expect(() => commitCommand(tmpDir, "test", "S999")).toThrow("Story 'S999' not found");
  });

  it("should create branch, commit changes, and stay on branch", () => {
    const tmpDir = createTestRepo();
    tmpDirs.push(tmpDir);

    // Initialize codewright and create spec + story
    execSync(`node ${CLI} init`, { cwd: tmpDir });
    execSync(`node ${CLI} spec test`, { cwd: tmpDir });
    createStoryFile(tmpDir, "test", "S001", "Create login form");

    // Make a code change
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1;", "utf-8");

    const result = commitCommand(tmpDir, "test", "S001");

    expect(result.branch).toBe("story/S001-create-login-form");
    expect(result.commitHash).toBeTruthy();
    expect(result.filesChanged).toBeGreaterThan(0);
    expect(result.storyUpdated).toBe(true);
    expect(result.pushed).toBe(false); // no remote configured

    // Verify we're on the feature branch, not main/master
    const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: tmpDir,
      encoding: "utf-8",
    }).trim();
    expect(currentBranch).toBe("story/S001-create-login-form");

    // Verify story status was updated
    const storiesDir = join(tmpDir, ".codewright-output", "specs", "spec-test", "stories");
    const storyContent = readFileSync(join(storiesDir, "S001-create-login-form.md"), "utf-8");
    expect(storyContent).toContain("status: done");
    expect(storyContent).toContain("Committed as");
  });

  it("should use custom branch name with --branch", () => {
    const tmpDir = createTestRepo();
    tmpDirs.push(tmpDir);

    execSync(`node ${CLI} init`, { cwd: tmpDir });
    execSync(`node ${CLI} spec test`, { cwd: tmpDir });
    createStoryFile(tmpDir, "test", "S001", "Test");
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1;", "utf-8");

    const result = commitCommand(tmpDir, "test", "S001", { branch: "custom-branch" });
    expect(result.branch).toBe("custom-branch");

    const branches = execSync("git branch", { cwd: tmpDir, encoding: "utf-8" });
    expect(branches).toContain("custom-branch");
  });

  it("should warn when nothing to commit", () => {
    const tmpDir = createTestRepo();
    tmpDirs.push(tmpDir);

    execSync(`node ${CLI} init`, { cwd: tmpDir });
    execSync(`node ${CLI} spec test`, { cwd: tmpDir });
    createStoryFile(tmpDir, "test", "S001", "Test");

    // Commit the story file first
    execSync("git add -A", { cwd: tmpDir });
    execSync("git commit -m 'chore: add story file'", { cwd: tmpDir });

    // Now there should be no changes
    const result = commitCommand(tmpDir, "test", "S001");
    expect(result.commitHash).toBeNull();
    expect(result.filesChanged).toBe(0);
    expect(result.storyUpdated).toBe(false);
  });

  it("should throw when branch already exists", () => {
    const tmpDir = createTestRepo();
    tmpDirs.push(tmpDir);

    execSync(`node ${CLI} init`, { cwd: tmpDir });
    execSync(`node ${CLI} spec test`, { cwd: tmpDir });
    createStoryFile(tmpDir, "test", "S001", "Test");
    writeFileSync(join(tmpDir, "test.ts"), "const x = 1;", "utf-8");

    // First commit succeeds
    commitCommand(tmpDir, "test", "S001");

    // Second commit should fail because branch exists
    writeFileSync(join(tmpDir, "test2.ts"), "const y = 2;", "utf-8");
    expect(() => commitCommand(tmpDir, "test", "S001")).toThrow("already exists");
  });
});
