import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../../config/loader.js";

const CHECKOUT = "actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8"; // v5.0.0
const SETUP_NODE = "actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444"; // v5.0.0
const SETUP_PYTHON = "actions/setup-python@e797f83bcb11b83ae66e0230d6156d7c80228e7c"; // v6.0.0
const SETUP_GO = "actions/setup-go@44694675825211faa026b3c33043df3e48a5fa00"; // v6.0.0

function workflowHeader(): string {
  const workflow = "$" + "{{ github.workflow }}";
  const ref = "$" + "{{ github.ref }}";
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${workflow}-${ref}
  cancel-in-progress: true
`;
}

function generateNodeWorkflow(cwd: string): string {
  const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8")) as {
    engines?: { node?: string };
    scripts?: Record<string, string>;
  };
  const scripts = pkg.scripts || {};
  const nodeVersion = pkg.engines?.node?.match(/\d+/)?.[0] || "24";
  let packageManager: "npm" | "pnpm" | "yarn";
  let install: string;
  let lockfile: string;

  if (existsSync(resolve(cwd, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
    install = "pnpm install --frozen-lockfile";
    lockfile = "pnpm-lock.yaml";
  } else if (existsSync(resolve(cwd, "yarn.lock"))) {
    packageManager = "yarn";
    install = "yarn install --immutable";
    lockfile = "yarn.lock";
  } else if (existsSync(resolve(cwd, "package-lock.json"))) {
    packageManager = "npm";
    install = "npm ci";
    lockfile = "package-lock.json";
  } else {
    throw new Error("A lockfile is required before generating deterministic Node.js CI");
  }

  const run = (name: string) => packageManager === "npm" ? `npm run ${name}` : `${packageManager} ${name}`;
  const checks = ["build", "typecheck", "lint", "test"].filter((name) => scripts[name])
    .map((name) => `      - run: ${run(name)}`);
  if (checks.length === 0) checks.push("      - run: echo 'No verification scripts declared in package.json'");
  const steps = packageManager === "npm" ? [] : ["      - run: corepack enable"];
  steps.push(`      - run: ${install}`, ...checks);

  return workflowHeader() + `
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: ${CHECKOUT}
      - uses: ${SETUP_NODE}
        with:
          node-version: "${nodeVersion}"
          cache: "${packageManager}"
          cache-dependency-path: "${lockfile}"
${steps.join("\n")}
`;
}

function generatePythonWorkflow(cwd: string): string {
  const versionPath = resolve(cwd, ".python-version");
  const version = existsSync(versionPath) ? readFileSync(versionPath, "utf-8").trim() : "3.14";
  const install = existsSync(resolve(cwd, "requirements.txt"))
    ? "python -m pip install -r requirements.txt"
    : existsSync(resolve(cwd, "pyproject.toml"))
      ? "python -m pip install ."
      : "echo 'No Python dependency manifest found' && exit 1";
  return workflowHeader() + `
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: ${CHECKOUT}
      - uses: ${SETUP_PYTHON}
        with:
          python-version: "${version}"
          cache: "pip"
      - run: ${install}
      - run: python -m pytest
`;
}

function generateGoWorkflow(cwd: string): string {
  const goMod = readFileSync(resolve(cwd, "go.mod"), "utf-8");
  const version = goMod.match(/^go\s+(\d+\.\d+)/m)?.[1] || "1.26";
  return workflowHeader() + `
jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: ${CHECKOUT}
      - uses: ${SETUP_GO}
        with:
          go-version: "${version}"
          cache: true
      - run: go mod download
      - run: go test ./...
      - run: go vet ./...
`;
}

export function ciGenerateCommand(cwd: string, options: { force?: boolean } = {}) {
  const config = loadConfig(cwd);
  const workflowDir = resolve(cwd, ".github", "workflows");
  const workflowPath = resolve(workflowDir, "ci.yml");
  if (existsSync(workflowPath) && !options.force) {
    return `CI workflow already exists at ${workflowPath}. Review it or rerun with --force to replace it.`;
  }
  if (!existsSync(workflowDir)) mkdirSync(workflowDir, { recursive: true });

  const stack = config.stack || "node";
  const workflow = stack === "python" || config.project_language === "python"
    ? generatePythonWorkflow(cwd)
    : stack === "go" || config.project_language === "go"
      ? generateGoWorkflow(cwd)
      : generateNodeWorkflow(cwd);
  writeFileSync(workflowPath, workflow, "utf-8");
  return `✓ CI workflow generated at .github/workflows/ci.yml

Stack: ${stack}
Security: read-only token permissions, full-SHA action pins, timeout, and concurrency cancellation`;
}
