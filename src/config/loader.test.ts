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
});
