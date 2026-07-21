import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../config/loader.js";

function generateNodeWorkflow(config: Record<string, unknown>): string {
  const framework = (config.framework as string) || "node";
  const testRunner = (config.test_runner as string) || "vitest";

  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test
      - run: npm run lint --if-present
`;
}

function generatePythonWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"
      - run: pip install -r requirements.txt
      - run: pip install pytest
      - run: pytest
`;
}

function generateGoWorkflow(): string {
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"
      - run: go mod download
      - run: go test ./...
      - run: go vet ./...
`;
}

export function ciGenerateCommand(cwd: string) {
  const config = loadConfig(cwd);
  const workflowDir = resolve(cwd, ".github", "workflows");

  if (!existsSync(workflowDir)) mkdirSync(workflowDir, { recursive: true });

  const stack = config.stack || "node";
  let workflow: string;

  if (stack === "python" || config.project_language === "python") {
    workflow = generatePythonWorkflow();
  } else if (stack === "go" || config.project_language === "go") {
    workflow = generateGoWorkflow();
  } else {
    workflow = generateNodeWorkflow(config as Record<string, unknown>);
  }

  const workflowPath = resolve(workflowDir, "ci.yml");
  if (existsSync(workflowPath)) {
    return `CI workflow already exists at ${workflowPath}. Delete it first to regenerate.`;
  }

  writeFileSync(workflowPath, workflow, "utf-8");

  return `✓ CI workflow generated at .github/workflows/ci.yml

Workflow includes:
- Test runner: ${config.test_runner || "auto-detected"}
- Build step
- Lint step (if configured)

Stack: ${stack}`;
}
