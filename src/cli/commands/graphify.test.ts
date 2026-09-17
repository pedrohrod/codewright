import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { graphifyCommand, isGraphifyEnabled, getGraphifyConfig } from "./graphify.js";

describe("graphifyCommand", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "graphify-test-"));
    mkdirSync(join(tmpDir, ".codewright"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return error when graphify is not enabled", () => {
    const result = graphifyCommand(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.message).toContain("graphify is not enabled");
  });

  it("should return ready message with no query or build", () => {
    // Create config with graphify enabled
    const configPath = join(tmpDir, ".codewright", "config.yaml");
    writeFileSync(configPath, `
codewright_version: "0.1.0"
project_name: "test"
graphify:
  enabled: true
  analysis_mode: code-only
`.trim(), "utf-8");

    const result = graphifyCommand(tmpDir, {});
    expect(result.success).toBe(false);
    expect(result.message).toContain("code-only");
    expect(result.message).toContain("--query");
  });

  it("should handle build option", () => {
    const configPath = join(tmpDir, ".codewright", "config.yaml");
    writeFileSync(configPath, `
codewright_version: "0.1.0"
project_name: "test"
graphify:
  enabled: true
  analysis_mode: code-only
`.trim(), "utf-8");

    const result = graphifyCommand(tmpDir, { build: true });
    // Will show install message since graphify not installed in test env
    expect(result.success).toBe(false);
    expect(result.message).toContain("graphify not found");
    expect(result.message).toContain("pip install");
  });

  it("should handle query without existing graph", () => {
    const configPath = join(tmpDir, ".codewright", "config.yaml");
    writeFileSync(configPath, `
codewright_version: "0.1.0"
project_name: "test"
graphify:
  enabled: true
  analysis_mode: code-only
`.trim(), "utf-8");

    const result = graphifyCommand(tmpDir, { query: "architecture" });
    // Should try to build first, but fail since graphify not installed
    expect(result.success).toBe(false);
    expect(result.message).toContain("graphify not found");
  });
});

describe("isGraphifyEnabled", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "graphify-test-"));
    mkdirSync(join(tmpDir, ".codewright"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return false when graphify not configured", () => {
    expect(isGraphifyEnabled(tmpDir)).toBe(false);
  });

  it("should return true when graphify enabled", () => {
    const configPath = join(tmpDir, ".codewright", "config.yaml");
    writeFileSync(configPath, `
graphify:
  enabled: true
  analysis_mode: code-only
`.trim(), "utf-8");

    expect(isGraphifyEnabled(tmpDir)).toBe(true);
  });

  it("should return false when graphify explicitly disabled", () => {
    const configPath = join(tmpDir, ".codewright", "config.yaml");
    writeFileSync(configPath, `
graphify:
  enabled: false
  analysis_mode: code-only
`.trim(), "utf-8");

    expect(isGraphifyEnabled(tmpDir)).toBe(false);
  });
});

describe("getGraphifyConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "graphify-test-"));
    mkdirSync(join(tmpDir, ".codewright"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return undefined when not configured", () => {
    expect(getGraphifyConfig(tmpDir)).toBeUndefined();
  });

  it("should return config when enabled", () => {
    const configPath = join(tmpDir, ".codewright", "config.yaml");
    writeFileSync(configPath, `
graphify:
  enabled: true
  analysis_mode: code-only
`.trim(), "utf-8");

    const config = getGraphifyConfig(tmpDir);
    expect(config).toBeDefined();
    expect(config!.enabled).toBe(true);
    expect(config!.analysis_mode).toBe("code-only");
  });
});
