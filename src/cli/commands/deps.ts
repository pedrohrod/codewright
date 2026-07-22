import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

interface RunResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

function run(cwd: string, command: string, args: string[]): RunResult {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8", timeout: 120_000 });
  return { stdout: result.stdout || "", stderr: result.stderr || "", status: result.status };
}

function nodeReport(cwd: string): string {
  const pkg = JSON.parse(readFileSync(resolve(cwd, "package.json"), "utf-8"));
  const total = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
  const outdated = run(cwd, "npm", ["outdated", "--json"]);
  const audit = run(cwd, "npm", ["audit", "--json"]);
  const lines = [`Dependency Check (Node.js)`, `Total direct dependencies: ${total}`];

  try {
    const parsed = JSON.parse(outdated.stdout || "{}") as Record<string, { current?: string; latest?: string }>;
    const entries = Object.entries(parsed);
    lines.push(entries.length ? `Outdated packages (${entries.length}):` : "Outdated packages: none");
    lines.push(...entries.slice(0, 20).map(([name, value]) => `  - ${name}: ${value.current || "unknown"} → ${value.latest || "unknown"}`));
  } catch {
    lines.push("Outdated packages: unknown (registry response could not be parsed)");
  }

  try {
    const parsed = JSON.parse(audit.stdout || "{}") as { metadata?: { vulnerabilities?: Record<string, number> } };
    const vulnerabilities = parsed.metadata?.vulnerabilities;
    lines.push(vulnerabilities
      ? `Known vulnerabilities: ${Object.entries(vulnerabilities).map(([key, value]) => `${key}=${value}`).join(", ")}`
      : "Known vulnerabilities: none reported");
  } catch {
    lines.push("Known vulnerabilities: unknown (audit unavailable or response could not be parsed)");
  }
  return lines.join("\n");
}

function pythonReport(cwd: string): string {
  const python = run(cwd, "python3", ["-m", "pip", "list", "--outdated", "--format=json"]);
  if (python.status === null) return "Dependency Check (Python)\nOutdated packages: unknown (python3 unavailable)";
  try {
    const entries = JSON.parse(python.stdout) as Array<{ name: string; version: string; latest_version: string }>;
    return ["Dependency Check (Python)", `Outdated packages (${entries.length}):`,
      ...entries.slice(0, 20).map((entry) => `  - ${entry.name}: ${entry.version} → ${entry.latest_version}`),
      "Known vulnerabilities: run pip-audit when it is installed; no automatic upgrade was performed.",
    ].join("\n");
  } catch {
    return "Dependency Check (Python)\nOutdated packages: unknown (pip response could not be parsed)";
  }
}

function goReport(cwd: string): string {
  const result = run(cwd, "go", ["list", "-m", "-u", "all"]);
  if (result.status !== 0) return "Dependency Check (Go)\nModule status: unknown (go list failed)";
  const outdated = result.stdout.split("\n").filter((line) => /\[.*\]$/.test(line));
  return ["Dependency Check (Go)", `Outdated modules (${outdated.length}):`,
    ...outdated.slice(0, 20).map((line) => `  - ${line}`),
    "Known vulnerabilities: run govulncheck when it is installed; no automatic upgrade was performed.",
  ].join("\n");
}

export function depsCheckCommand(cwd: string): string {
  if (existsSync(resolve(cwd, "package.json"))) return nodeReport(cwd);
  if (existsSync(resolve(cwd, "pyproject.toml")) || existsSync(resolve(cwd, "requirements.txt"))) return pythonReport(cwd);
  if (existsSync(resolve(cwd, "go.mod"))) return goReport(cwd);
  return "No supported dependency manifest found (package.json, pyproject.toml/requirements.txt, or go.mod).";
}
