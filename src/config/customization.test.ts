import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadCustomization, clearCustomizationCache } from "./customization.js";

describe("loadCustomization", () => {
  afterEach(() => clearCustomizationCache());

  it("should return empty object when no customization exists", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "custom-test-"));
    const result = loadCustomization(tmpDir, "nonexistent");
    expect(result).toEqual({});
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should merge skill defaults with team overrides", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "custom-test-"));
    const customDir = join(tmpDir, ".codewright", "custom");
    const skillDir = join(tmpDir, "skills", "test-skill");

    mkdirSync(skillDir, { recursive: true });
    mkdirSync(customDir, { recursive: true });

    // Skill default
    writeFileSync(join(skillDir, "customize.toml"), '[workflow]\ntdd_mode = true\nauto_commit = false\n', "utf-8");

    // Team override
    writeFileSync(join(customDir, "test-skill.toml"), '[workflow]\nauto_commit = true\n', "utf-8");

    const result = loadCustomization(tmpDir, "test-skill");
    expect(result["workflow.tdd_mode"]).toBe(true);
    expect(result["workflow.auto_commit"]).toBe(true);

    rmSync(tmpDir, { recursive: true, force: true });
  });
});
