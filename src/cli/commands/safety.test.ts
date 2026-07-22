import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { envListCommand } from "./env.js";
import { testGenFromSpecCommand } from "./testgen.js";
import { ciGenerateCommand } from "./ci.js";
import { deployDockerfileCommand } from "./deploy.js";

describe("safe command output", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories) rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  it("never reveals environment values", () => {
    const directory = mkdtempSync(join(tmpdir(), "codewright-env-"));
    directories.push(directory);
    writeFileSync(join(directory, ".env"), "API_TOKEN=super-secret-value\nEMPTY=\n", "utf-8");
    const output = envListCommand(directory);
    expect(output).toContain("API_TOKEN: set");
    expect(output).toContain("EMPTY: unset");
    expect(output).not.toContain("super-secret-value");
  });

  it("generates explicit TODO tests instead of always-passing assertions", () => {
    const directory = mkdtempSync(join(tmpdir(), "codewright-testgen-"));
    directories.push(directory);
    const stories = join(directory, ".codewright-output", "specs", "spec-demo", "stories");
    mkdirSync(stories, { recursive: true });
    writeFileSync(join(stories, "S001-demo.md"), `---
id: S001
---
# Demo behavior
## I/O & Edge-Case Matrix
| # | Scenario | Input | Expected Output |
|---|----------|-------|-----------------|
| 1 | success | value | result |
## Code Map
`, "utf-8");

    testGenFromSpecCommand(directory, "demo", "S001");
    const generated = readFileSync(join(directory, "src", "__tests__", "s001.test.ts"), "utf-8");
    expect(generated).toContain("it.todo");
    expect(generated).not.toContain("expect(true)");
  });

  it("generates lockfile-aware CI with least-privilege defaults and SHA pins", () => {
    const directory = mkdtempSync(join(tmpdir(), "codewright-ci-"));
    directories.push(directory);
    writeFileSync(join(directory, "package.json"), JSON.stringify({
      engines: { node: ">=22" },
      scripts: { test: "vitest --run", lint: "eslint src" },
    }), "utf-8");
    writeFileSync(join(directory, "package-lock.json"), "{}", "utf-8");

    ciGenerateCommand(directory);
    const workflow = readFileSync(join(directory, ".github", "workflows", "ci.yml"), "utf-8");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toMatch(/actions\/checkout@[a-f0-9]{40}/);
    expect(workflow).toContain('node-version: "22"');
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run test");
  });

  it("generates a non-root container runtime", () => {
    const directory = mkdtempSync(join(tmpdir(), "codewright-deploy-"));
    directories.push(directory);
    mkdirSync(join(directory, ".codewright"), { recursive: true });
    writeFileSync(join(directory, ".codewright", "config.yaml"), "stack: node\nframework: express\n", "utf-8");

    deployDockerfileCommand(directory);
    const dockerfile = readFileSync(join(directory, "Dockerfile"), "utf-8");
    expect(dockerfile).toContain("FROM node:24-alpine");
    expect(dockerfile).toContain("USER node");
  });
});
