import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";

interface IoScenario {
  number: number;
  scenario: string;
  input: string;
  expected: string;
}

function parseIoMatrix(content: string): IoScenario[] {
  const scenarios: IoScenario[] = [];
  const lines = content.split("\n");
  let inMatrix = false;

  for (const line of lines) {
    if (line.includes("I/O & Edge-Case Matrix") || line.includes("I/O & Edge Case Matrix")) {
      inMatrix = true;
      continue;
    }
    if (inMatrix && line.startsWith("## ")) {
      inMatrix = false;
      continue;
    }
    if (inMatrix && line.startsWith("|") && !line.startsWith("|---") && !line.startsWith("| #")) {
      const parts = line.split("|").slice(1, -1).map((p) => p.trim());
      if (parts.length >= 2) {
        const num = parseInt(parts[0], 10);
        if (!isNaN(num)) {
          scenarios.push({
            number: num,
            scenario: parts[1] || "",
            input: parts[2] || "",
            expected: parts[3] || "",
          });
        }
      }
    }
  }
  return scenarios;
}

function generateTestCode(specName: string, storyId: string, storyTitle: string, scenarios: IoScenario[]): string {
  const testName = storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const desc = storyTitle.replace(/"/g, '\\"');

  let code = `import { describe, it, expect } from "vitest";\n\n`;
  code += `describe("${desc}", () => {\n`;

  for (const s of scenarios) {
    const testDesc = s.scenario.replace(/"/g, '\\"');
    code += `  it("should handle scenario ${s.number}: ${testDesc}", () => {\n`;
    code += `    // Input: ${s.input || "not specified"}\n`;
    code += `    // Expected: ${s.expected || "not specified"}\n`;
    code += `    // TODO: Implement test\n`;
    code += `    expect(true).toBe(true);\n`;
    code += `  });\n\n`;
  }

  code += `});\n`;
  return code;
}

export function testGenFromSpecCommand(cwd: string, spec: string, storyId?: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");

  if (!existsSync(storiesDir)) {
    return `Error: No stories found for spec '${spec}'.`;
  }

  const allFiles = readdirSync(storiesDir).filter((f) => f.endsWith(".md"));
  const filesToProcess = storyId
    ? allFiles.filter((f) => f.startsWith(storyId))
    : allFiles;

  if (filesToProcess.length === 0) {
    return `Error: No stories found matching the criteria.`;
  }

  const results: string[] = [];

  for (const file of filesToProcess) {
    const content = readFileSync(resolve(storiesDir, file), "utf-8");
    const idMatch = content.match(/^id:\s*(.+)/m);
    const titleMatch = content.match(/^#\s+(.+)/m);
    const storyIdMatch = idMatch?.[1]?.trim() || "unknown";
    const storyTitle = titleMatch?.[1]?.trim() || file;

    const scenarios = parseIoMatrix(content);

    if (scenarios.length === 0) {
      results.push(`  - ${storyIdMatch}: No I/O Matrix scenarios found`);
      continue;
    }

    const testCode = generateTestCode(spec, storyIdMatch, storyTitle, scenarios);
    const testFilename = `${storyIdMatch.toLowerCase()}.test.ts`;
    const testPath = resolve(cwd, "src", "__tests__", testFilename);
    const testDir = resolve(cwd, "src", "__tests__");

    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    writeFileSync(testPath, testCode, "utf-8");

    results.push(`  - ${storyIdMatch}: ${scenarios.length} scenarios → ${testPath}`);
  }

  let report = `Test Generation from Spec '${spec}':\n`;
  report += results.join("\n");

  if (results.length > 0) {
    report += `\n\nGenerated ${results.length} test file(s) from story I/O Matrix scenarios.`;
  }

  return report;
}
