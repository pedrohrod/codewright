import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";

const skillsRoot = resolve(process.cwd(), "skills");

describe("bundled skill contracts", () => {
  const folders = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  it("ships exactly 25 valid, portable skills", () => {
    expect(folders).toHaveLength(25);
    for (const folder of folders) {
      const skillPath = resolve(skillsRoot, folder, "SKILL.md");
      const content = readFileSync(skillPath, "utf-8");
      const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
      expect(match, folder + " must have frontmatter").toBeTruthy();
      const frontmatter = load(match![1]) as Record<string, unknown>;
      expect(Object.keys(frontmatter).sort()).toEqual(["description", "name"]);
      expect(frontmatter.name).toBe(folder);
      expect(folder).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(String(frontmatter.description)).toContain(`$${folder}`);
      expect(String(frontmatter.description)).toContain("codewright:");
      expect(content).not.toContain("## Activation");
      expect(content).not.toContain("<workflow>");
    }
  });

  it("ships matching Codex UI metadata and valid local references", () => {
    for (const folder of folders) {
      const metadataPath = resolve(skillsRoot, folder, "agents", "openai.yaml");
      expect(existsSync(metadataPath), folder + " metadata").toBe(true);
      const metadata = load(readFileSync(metadataPath, "utf-8")) as {
        interface?: { short_description?: string; default_prompt?: string };
      };
      const shortDescription = metadata.interface?.short_description || "";
      expect(shortDescription.length).toBeGreaterThanOrEqual(25);
      expect(shortDescription.length).toBeLessThanOrEqual(64);
      expect(metadata.interface?.default_prompt).toContain(`$${folder}`);

      const skillContent = readFileSync(resolve(skillsRoot, folder, "SKILL.md"), "utf-8");
      for (const match of skillContent.matchAll(/\]\((references\/[^)]+)\)/g)) {
        expect(existsSync(resolve(skillsRoot, folder, match[1])), folder + " reference " + match[1]).toBe(true);
      }
    }
  });
});
