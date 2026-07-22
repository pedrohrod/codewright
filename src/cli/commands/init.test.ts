import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { load } from "js-yaml";

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
    const manifest = load(readFileSync(join(tmpDir, ".codewright", "agents.yaml"), "utf-8")) as { targets: string[] };
    expect(manifest.targets).toEqual([]);

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("codewright init should install selected native agent adapters", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "init-agents-test-"));
    execSync("git init", { cwd: tmpDir });
    const output = execSync(`node ${CLI} init --agents claude,cursor`, { cwd: tmpDir, encoding: "utf-8" });

    expect(output).toContain("Claude Code, Cursor");
    expect(output).toContain("50 files generated");
    expect(readdirSync(join(tmpDir, ".claude", "skills"))).toHaveLength(25);
    expect(readdirSync(join(tmpDir, ".cursor", "commands"))).toHaveLength(25);
    expect(existsSync(join(tmpDir, ".cline"))).toBe(false);

    const claude = readFileSync(join(tmpDir, ".claude", "skills", "codewright-spec", "SKILL.md"), "utf-8");
    const cursor = readFileSync(join(tmpDir, ".cursor", "commands", "codewright-spec.md"), "utf-8");
    expect(claude).toContain("../../../.agents/skills/codewright-spec/SKILL.md");
    expect(cursor).toContain("../../.agents/skills/codewright-spec/SKILL.md");
    const status = execSync(`node ${CLI} status`, { cwd: tmpDir, encoding: "utf-8" });
    expect(status).toContain("**Agents:** Claude Code, Cursor");

    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("codewright init should reject an unknown agent before writing files", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "init-invalid-agent-test-"));
    execSync("git init", { cwd: tmpDir });
    expect(() => execSync(`node ${CLI} init --agents unknown`, { cwd: tmpDir, stdio: "pipe" })).toThrow();
    expect(existsSync(join(tmpDir, ".codewright"))).toBe(false);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("codewright init --agents all should install every required adapter", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "init-all-agents-test-"));
    execSync("git init", { cwd: tmpDir });
    const output = execSync(`node ${CLI} init --agents all`, { cwd: tmpDir, encoding: "utf-8" });
    const manifest = load(readFileSync(join(tmpDir, ".codewright", "agents.yaml"), "utf-8")) as { targets: string[] };

    expect(output).toContain("75 files generated");
    expect(manifest.targets).toHaveLength(8);
    expect(readdirSync(join(tmpDir, ".claude", "skills"))).toHaveLength(25);
    expect(readdirSync(join(tmpDir, ".cline", "skills"))).toHaveLength(25);
    expect(readdirSync(join(tmpDir, ".cursor", "commands"))).toHaveLength(25);

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
