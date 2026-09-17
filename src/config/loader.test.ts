import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "./loader.js";

describe("loadConfig", () => {
  it("should return defaults when no config file exists", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
    const config = loadConfig(tmpDir);
    expect(config.project_name).toBe("");
    expect(config.stack).toBe("node");
    expect(config.communication_language).toBe("en");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should load existing config", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
    mkdirSync(join(tmpDir, ".codewright"), { recursive: true });

    // YAML with unquoted values to avoid parsing issues
    const yaml = [
      "project_name: my-project",
      "stack: python",
    ].join("\n");
    writeFileSync(join(tmpDir, ".codewright", "config.yaml"), yaml, "utf-8");

    const config = loadConfig(tmpDir);
    expect(config.project_name).toBe("my-project");
    expect(config.stack).toBe("python");
    expect(config.communication_language).toBe("en");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("graphify config", () => {
    it("should have graphify undefined by default", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
      const config = loadConfig(tmpDir);
      expect(config.graphify).toBeUndefined();
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should load graphify config when present", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
      mkdirSync(join(tmpDir, ".codewright"), { recursive: true });

      const yaml = [
        "project_name: my-project",
        "graphify:",
        "  enabled: true",
        "  analysis_mode: code-only",
      ].join("\n");
      writeFileSync(join(tmpDir, ".codewright", "config.yaml"), yaml, "utf-8");

      const config = loadConfig(tmpDir);
      expect(config.graphify).toBeDefined();
      expect(config.graphify!.enabled).toBe(true);
      expect(config.graphify!.analysis_mode).toBe("code-only");
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should load full analysis_mode", () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "config-test-"));
      mkdirSync(join(tmpDir, ".codewright"), { recursive: true });

      const yaml = [
        "graphify:",
        "  enabled: true",
        "  analysis_mode: full",
      ].join("\n");
      writeFileSync(join(tmpDir, ".codewright", "config.yaml"), yaml, "utf-8");

      const config = loadConfig(tmpDir);
      expect(config.graphify!.analysis_mode).toBe("full");
      rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
