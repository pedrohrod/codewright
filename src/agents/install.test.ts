import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installAgentAdapters, readAgentManifest, writeAgentManifest } from "./install.js";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "codewright-agents-"));
  const skillDir = join(root, ".agents", "skills", "codewright-spec");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---
name: codewright-spec
description: Create a specification. Use for planning.
---

# Specification
`, "utf-8");
  return root;
}

describe("agent adapter installation", () => {
  it("generates native wrappers that point to the canonical skill", () => {
    const root = fixture();
    const result = installAgentAdapters({
      targetDir: root,
      targets: ["codex", "claude", "cline", "cursor"],
      skillNames: ["codewright-spec"],
      upgrade: false,
      backupRoot: join(root, ".codewright", "skill-backups", "test"),
    });

    expect(result.installedFiles).toHaveLength(3);
    const claude = readFileSync(join(root, ".claude", "skills", "codewright-spec", "SKILL.md"), "utf-8");
    const cline = readFileSync(join(root, ".cline", "skills", "codewright-spec", "SKILL.md"), "utf-8");
    const cursor = readFileSync(join(root, ".cursor", "commands", "codewright-spec.md"), "utf-8");
    expect(claude).toContain("../../../.agents/skills/codewright-spec/SKILL.md");
    expect(cline).toContain("../../../.agents/skills/codewright-spec/SKILL.md");
    expect(cursor).toContain("../../.agents/skills/codewright-spec/SKILL.md");
  });

  it("preserves user files and backs up managed files during upgrades", () => {
    const root = fixture();
    const destination = join(root, ".claude", "skills", "codewright-spec", "SKILL.md");
    mkdirSync(join(root, ".claude", "skills", "codewright-spec"), { recursive: true });
    writeFileSync(destination, "user content", "utf-8");

    const preserved = installAgentAdapters({
      targetDir: root,
      targets: ["claude"],
      skillNames: ["codewright-spec"],
      upgrade: true,
      backupRoot: join(root, ".codewright", "skill-backups", "first"),
    });
    expect(preserved.warnings).toHaveLength(1);
    expect(readFileSync(destination, "utf-8")).toBe("user content");

    writeFileSync(destination, "<!-- codewright-managed: agent-adapter v1 -->\nold", "utf-8");
    const backupRoot = join(root, ".codewright", "skill-backups", "second");
    installAgentAdapters({
      targetDir: root,
      targets: ["claude"],
      skillNames: ["codewright-spec"],
      upgrade: true,
      backupRoot,
    });
    expect(existsSync(join(backupRoot, "adapters", ".claude", "skills", "codewright-spec", "SKILL.md"))).toBe(true);
  });

  it("persists a validated agent manifest", () => {
    const root = fixture();
    writeAgentManifest(root, ["claude", "cursor"]);
    expect(readAgentManifest(root)).toEqual({ version: 1, targets: ["claude", "cursor"] });
  });
});
