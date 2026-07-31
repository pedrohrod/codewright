import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execSync } from "node:child_process";
import { loadConfig } from "../../config/loader.js";
import { readAgentManifest } from "../../agents/install.js";
import { getAgentDefinition, AGENT_DEFINITIONS, type AgentTarget } from "../../agents/registry.js";

interface DoctorCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
  details?: string[];
}

interface DoctorResult {
  healthy: boolean;
  checks: DoctorCheck[];
  summary: string;
}

function checkGitignore(targetDir: string): string[] {
  const gitignorePath = resolve(targetDir, ".gitignore");
  if (!existsSync(gitignorePath)) return [];

  const content = readFileSync(gitignorePath, "utf-8");
  const ignored: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      if (trimmed.includes(".claude") || trimmed.includes(".cline") ||
          trimmed.includes(".cursor") || trimmed.includes(".agents")) {
        ignored.push(trimmed);
      }
    }
  }
  return ignored;
}

function checkAgentAdapters(targetDir: string, targets: AgentTarget[]): { installed: string[]; missing: string[] } {
  const installed: string[] = [];
  const missing: string[] = [];

  for (const target of targets) {
    const def = getAgentDefinition(target);
    // Adapter directory is determined by target name: .claude, .cline, .cursor
    const adapterDir = resolve(targetDir, `.${target}`);

    if (existsSync(adapterDir)) {
      const files = readdirSync(adapterDir);
      if (files.length > 0) {
        installed.push(target);
      } else {
        missing.push(target);
      }
    } else {
      missing.push(target);
    }
  }

  return { installed, missing };
}

function checkSkills(targetDir: string): { count: number; skills: string[] } {
  const skillsDir = resolve(targetDir, ".agents", "skills");
  if (!existsSync(skillsDir)) return { count: 0, skills: [] };

  const skills = readdirSync(skillsDir).filter(name => {
    const skillPath = resolve(skillsDir, name);
    return statSync(skillPath).isDirectory() &&
           existsSync(resolve(skillPath, "SKILL.md"));
  });

  return { count: skills.length, skills };
}

function checkVersion(targetDir: string): { configVersion: string; packageVersion: string; match: boolean } {
  const config = loadConfig(targetDir);
  let packageVersion = "unknown";

  try {
    const pkgPath = resolve(targetDir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      packageVersion = pkg.version || "unknown";
    }
  } catch {
    // ignore
  }

  return {
    configVersion: config.codewright_version,
    packageVersion,
    match: config.codewright_version === packageVersion,
  };
}

export function doctorCommand(cwd: string): DoctorResult {
  const checks: DoctorCheck[] = [];
  const targetDir = cwd;

  // Check 1: Manifest vs installed adapters
  const manifest = readAgentManifest(targetDir);
  const { installed, missing } = checkAgentAdapters(targetDir, manifest.targets);

  checks.push({
    name: "Agent Adapters",
    status: missing.length === 0 ? "pass" : missing.length === manifest.targets.length ? "fail" : "warn",
    message: missing.length === 0
      ? `All ${installed.length} agents installed correctly`
      : `${missing.length} of ${manifest.targets.length} agents missing`,
    details: [
      ...installed.map(t => `  ✓ ${t}`),
      ...missing.map(t => `  ✗ ${t}`),
    ],
  });

  // Check 2: Skills
  const skills = checkSkills(targetDir);
  checks.push({
    name: "Skills",
    status: skills.count > 0 ? "pass" : "warn",
    message: `${skills.count} skills installed`,
    details: skills.skills.slice(0, 5).map(s => `  - ${s}`),
  });

  // Check 3: Git ignore warnings
  const ignored = checkGitignore(targetDir);
  checks.push({
    name: "Git Ignore",
    status: ignored.length === 0 ? "pass" : "warn",
    message: ignored.length === 0
      ? "No agent directories ignored by Git"
      : `${ignored.length} agent directories ignored by Git`,
    details: ignored.map(g => `  ⚠ ${g}`),
  });

  // Check 4: Version
  const version = checkVersion(targetDir);
  checks.push({
    name: "Version",
    status: version.match ? "pass" : "warn",
    message: version.match
      ? `Version ${version.packageVersion} matches`
      : `Config version ${version.configVersion} != package version ${version.packageVersion}`,
  });

  // Check 5: Config exists
  const configPath = resolve(targetDir, ".codewright", "config.yaml");
  checks.push({
    name: "Config",
    status: existsSync(configPath) ? "pass" : "fail",
    message: existsSync(configPath) ? "config.yaml exists" : "config.yaml not found",
  });

  // Check 6: AGENTS.md exists
  const agentsPath = resolve(targetDir, "AGENTS.md");
  checks.push({
    name: "AGENTS.md",
    status: existsSync(agentsPath) ? "pass" : "warn",
    message: existsSync(agentsPath) ? "AGENTS.md exists" : "AGENTS.md not found",
  });

  // Determine overall health
  const failed = checks.filter(c => c.status === "fail").length;
  const warned = checks.filter(c => c.status === "warn").length;
  const healthy = failed === 0;

  const summary = healthy
    ? (warned > 0 ? `Healthy with ${warned} warnings` : "All checks passed")
    : `${failed} checks failed, ${warned} warnings`;

  return { healthy, checks, summary };
}

export function doctorCommandFormatted(cwd: string): string {
  const result = doctorCommand(cwd);
  const lines: string[] = [];

  lines.push("Codewright Doctor");
  lines.push("=".repeat(50));
  lines.push("");

  for (const check of result.checks) {
    const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗";
    lines.push(`${icon} ${check.name}: ${check.message}`);
    if (check.details) {
      for (const detail of check.details) {
        lines.push(detail);
      }
    }
    lines.push("");
  }

  lines.push("-".repeat(50));
  lines.push(result.summary);

  return lines.join("\n");
}