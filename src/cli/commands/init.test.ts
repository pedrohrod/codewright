import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const CLI = join(process.cwd(), "dist/cli/main.mjs");

describe("CLI Integration", () => {
  it("codewright init should create structure", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "init-test-"));
    execSync(`git init`, { cwd: tmpDir });
    const output = execSync(`node ${CLI} init`, { cwd: tmpDir, encoding: "utf-8" });

    expect(output).toContain("Codewright initialized");
    expect(existsSync(join(tmpDir, ".codewright", "config.yaml"))).toBe(true);
    expect(existsSync(join(tmpDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(tmpDir, ".agents", "skills"))).toBe(true);
    expect(existsSync(join(tmpDir, ".codewright-output", "project-context.md"))).toBe(true);

    // Check skills are installed
    const skills = readdirSync(join(tmpDir, ".agents", "skills"));
    expect(skills).toHaveLength(25);
    expect(existsSync(join(tmpDir, ".agents", "skills", "codewright-spec", "agents", "openai.yaml"))).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("codewright spec should create SPEC.md", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "spec-test-"));
    execSync(`git init`, { cwd: tmpDir });
    execSync(`node ${CLI} init`, { cwd: tmpDir });

    const output = execSync(`node ${CLI} spec my-feature`, { cwd: tmpDir, encoding: "utf-8" });
    expect(output).toContain("Spec created");

    const specDir = join(tmpDir, ".codewright-output", "specs", "spec-my-feature");
    expect(existsSync(join(specDir, "SPEC.md"))).toBe(true);
    expect(existsSync(join(specDir, ".memlog.md"))).toBe(true);

    const specContent = readFileSync(join(specDir, "SPEC.md"), "utf-8");
    expect(specContent).toContain("my-feature");
    expect(specContent).toContain("## Why");
    expect(specContent).toContain("## Capabilities");
    expect(specContent).toContain("## Constraints");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("codewright story should create story file", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "story-test-"));
    execSync(`git init`, { cwd: tmpDir });
    execSync(`node ${CLI} init`, { cwd: tmpDir });
    execSync(`node ${CLI} spec my-feature`, { cwd: tmpDir });

    const output = execSync(`node ${CLI} story my-feature S001 "My Story"`, {
      cwd: tmpDir,
      encoding: "utf-8",
    });
    expect(output).toContain("Story created");

    const storiesDir = join(tmpDir, ".codewright-output", "specs", "spec-my-feature", "stories");
    expect(existsSync(storiesDir)).toBe(true);
    const files = readdirSync(storiesDir);
    expect(files.length).toBe(1);
    expect(files[0]).toContain("S001");

    const storyContent = readFileSync(join(storiesDir, files[0]), "utf-8");
    expect(storyContent).toContain("S001");
    expect(storyContent).toContain("pending");
    expect(storyContent).toContain("My Story");

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
