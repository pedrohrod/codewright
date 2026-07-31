import { existsSync, readFileSync, readdirSync, statSync, accessSync, constants } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { execSync } from "node:child_process";
import { load } from "js-yaml";
import { loadConfig, type CodewrightConfig } from "../../config/loader.js";
import { readAgentManifest, type AgentManifestV2, installAgentAdapters } from "../../agents/install.js";
import { getAgentDefinition, AGENT_DEFINITIONS, type AgentTarget } from "../../agents/registry.js";
import {
  loadGraphifyConfig,
  checkGraphExists,
  updateGraph,
  type GraphifyConfig,
} from "../../config/graphify.js";

export interface DoctorCheck {
  name: string;
  status: "ok" | "warning" | "error" | "fixable" | "not_fixable";
  message: string;
  details?: string[];
  canFix?: boolean;
}

export interface DoctorResult {
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

function checkManifestIntegrity(targetDir: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const manifestPath = resolve(targetDir, ".codewright", "agents.yaml");

  if (!existsSync(manifestPath)) {
    checks.push({
      name: "Manifest",
      status: "ok",
      message: "No manifest found (clean state)",
    });
    return checks;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const parsed = load(content) as any;

    if (parsed.version !== 1 && parsed.version !== 2) {
      checks.push({
        name: "Manifest Version",
        status: "error",
        message: `Unsupported manifest version: ${parsed.version}`,
      });
    }

    if (parsed.agents) {
      for (const [agentName, agentInfo] of Object.entries(parsed.agents)) {
        const adapterDir = resolve(targetDir, `.${agentName}`);
        if ((agentInfo as any).status === "installed" && !existsSync(adapterDir)) {
          checks.push({
            name: "Orphan Adapter",
            status: "warning",
            message: `Adapter ${agentName} marked as installed but directory missing`,
            canFix: true,
          });
        }
      }
    }
  } catch (error) {
    checks.push({
      name: "Manifest Parse",
      status: "error",
      message: "Failed to parse manifest file",
      details: [String(error)],
    });
  }

  if (checks.length === 0) {
    checks.push({
      name: "Manifest Integrity",
      status: "ok",
      message: "Manifest is valid",
    });
  }

  return checks;
}

const MANAGED_MARKER = "<!-- codewright-managed: agent-adapter v1 -->";

function checkAdapterIntegrity(targetDir: string, targets: AgentTarget[]): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  for (const target of targets) {
    const adapterDir = resolve(targetDir, `.${target}`);
    if (!existsSync(adapterDir)) continue;

    const files = readdirSync(adapterDir);
    for (const file of files) {
      const filePath = resolve(adapterDir, file);
      if (!statSync(filePath).isFile()) continue;

      try {
        const content = readFileSync(filePath, "utf-8");

        // Check for managed marker
        if (content.includes(MANAGED_MARKER)) {
          // Check canonical reference
          const match = content.match(/canonical skill at `(.+?)`/);
          if (match) {
            const canonicalPath = resolve(dirname(filePath), match[1]);
            if (!existsSync(canonicalPath)) {
              checks.push({
                name: "Broken Reference",
                status: "error",
                message: `Adapter ${file} references missing canonical: ${match[1]}`,
              });
            }
          }
        } else {
          // User-managed file (no marker)
          checks.push({
            name: "User Adapter",
            status: "ok",
            message: `Preserved user-managed adapter: ${file}`,
          });
        }
      } catch {
        // Skip binary or unreadable files
      }
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: "Adapter Integrity",
      status: "ok",
      message: "All adapters valid",
    });
  }

  return checks;
}

function checkFilesystemPermissions(targetDir: string): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const dirs = [
    resolve(targetDir, ".codewright"),
    resolve(targetDir, ".agents"),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;

    try {
      accessSync(dir, constants.R_OK | constants.W_OK);
    } catch {
      checks.push({
        name: `Permissions: ${relative(targetDir, dir)}`,
        status: "warning",
        message: "Directory not writable",
      });
    }
  }

  if (checks.length === 0) {
    checks.push({
      name: "Filesystem Permissions",
      status: "ok",
      message: "All directories are accessible",
    });
  }

  return checks;
}

export function doctorCommand(cwd: string, options?: { fix?: boolean; dryRun?: boolean }): DoctorResult {
  const checks: DoctorCheck[] = [];
  const targetDir = cwd;

  const config = loadConfig(targetDir);
  const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);

  const manifest = readAgentManifest(targetDir);
  const manifestTargets = Object.keys(manifest.agents) as AgentTarget[];
  const { installed, missing } = checkAgentAdapters(targetDir, manifestTargets);

  checks.push({
    name: "Agent Adapters",
    status: missing.length === 0 ? "ok" : missing.length === manifestTargets.length ? "error" : "fixable",
    message: missing.length === 0
      ? `All ${installed.length} agents installed correctly`
      : `${missing.length} of ${manifestTargets.length} agents missing`,
    details: [
      ...installed.map(t => `  ✓ ${t}`),
      ...missing.map(t => `  ✗ ${t}`),
    ],
    canFix: missing.length > 0,
  });

  const skills = checkSkills(targetDir);
  checks.push({
    name: "Skills",
    status: skills.count > 0 ? "ok" : "warning",
    message: `${skills.count} skills installed`,
    details: skills.skills.slice(0, 5).map(s => `  - ${s}`),
  });

  const ignored = checkGitignore(targetDir);
  checks.push({
    name: "Git Ignore",
    status: ignored.length === 0 ? "ok" : "warning",
    message: ignored.length === 0
      ? "No agent directories ignored by Git"
      : `${ignored.length} agent directories ignored by Git`,
    details: ignored.map(g => `  ⚠ ${g}`),
  });

  const version = checkVersion(targetDir);
  checks.push({
    name: "Version",
    status: version.match ? "ok" : "warning",
    message: version.match
      ? `Version ${version.packageVersion} matches`
      : `Config version ${version.configVersion} != package version ${version.packageVersion}`,
  });

  const configPath = resolve(targetDir, ".codewright", "config.yaml");
  checks.push({
    name: "Config",
    status: existsSync(configPath) ? "ok" : "error",
    message: existsSync(configPath) ? "config.yaml exists" : "config.yaml not found",
  });

  const agentsPath = resolve(targetDir, "AGENTS.md");
  checks.push({
    name: "AGENTS.md",
    status: existsSync(agentsPath) ? "ok" : "warning",
    message: existsSync(agentsPath) ? "AGENTS.md exists" : "AGENTS.md not found",
  });

  // Graphify Checks
  const graphifyCheck = checkGraphifyAvailableSync(graphifyConfig.command);
  checks.push({
    name: "Graphify Installation",
    status: graphifyCheck.available ? "ok" : "warning",
    message: graphifyCheck.available
      ? `Graphify v${graphifyCheck.version} installed`
      : "Graphify not found or not in PATH",
  });

  if (graphifyConfig.enabled) {
    const graphExists = checkGraphExists(targetDir, graphifyConfig.graph_path);
    checks.push({
      name: "Graph Existence",
      status: graphExists ? "ok" : "fixable",
      message: graphExists
        ? `Graph found at ${graphifyConfig.graph_path}`
        : "Graph not found",
      canFix: !graphExists,
    });

    if (graphExists && graphifyCheck.available) {
      const isStale = checkGraphStaleSync(targetDir, graphifyConfig.command, graphifyConfig.graph_path);
      checks.push({
        name: "Graph Staleness",
        status: isStale ? "fixable" : "ok",
        message: isStale ? "Graph is stale" : "Graph is up-to-date",
        canFix: isStale,
      });
    }

    checks.push({
      name: "Graphify Mode",
      status: "ok",
      message: `Mode: ${graphifyConfig.mode}`,
    });
  }

  // Manifest Integrity
  const manifestChecks = checkManifestIntegrity(targetDir);
  checks.push(...manifestChecks);

  // Adapter Integrity
  const adapterChecks = checkAdapterIntegrity(targetDir, manifestTargets);
  checks.push(...adapterChecks);

  // Filesystem Permissions
  const permissionChecks = checkFilesystemPermissions(targetDir);
  checks.push(...permissionChecks);

  const errors = checks.filter(c => c.status === "error" || c.status === "not_fixable").length;
  const warnings = checks.filter(c => c.status === "warning").length;
  const fixable = checks.filter(c => c.status === "fixable").length;
  const healthy = errors === 0;

  const summary = healthy
    ? (warnings > 0 ? `Healthy with ${warnings} warnings` : fixable > 0 ? `${fixable} issues fixable` : "All checks passed")
    : `${errors} checks failed, ${warnings} warnings, ${fixable} fixable`;

  return { healthy, checks, summary };
}

function checkGraphifyAvailableSync(command: string): { available: boolean; version: string } {
  try {
    const stdout = execSync(`${command} --version`, { timeout: 5000, encoding: "utf-8" });
    return { available: true, version: stdout.trim() };
  } catch {
    return { available: false, version: "" };
  }
}

function checkGraphStaleSync(cwd: string, command: string, graphPath: string): boolean {
  try {
    const stdout = execSync(`${command} check-update --graph ${graphPath}`, { cwd, timeout: 10000, encoding: "utf-8" });
    return stdout.includes("stale");
  } catch {
    return false;
  }
}

export async function applyFixes(result: DoctorResult, cwd: string, dryRun: boolean = false): Promise<DoctorResult> {
  for (const check of result.checks) {
    if (check.status !== "fixable" || !check.canFix) continue;

    if (check.name === "Agent Adapters") {
      if (!dryRun) {
        const manifest = readAgentManifest(cwd);
        const targets = Object.keys(manifest.agents) as AgentTarget[];
        const { missing } = checkAgentAdapters(cwd, targets);

        if (missing.length > 0) {
          const skills = checkSkills(cwd);
          const skillNames = skills.skills;
          installAgentAdapters({
            targetDir: cwd,
            targets,
            skillNames,
            upgrade: false,
            backupRoot: resolve(cwd, ".codewright", "backups"),
          });
        }
      }
    } else if (check.name === "Graph Existence" || check.name === "Graph Staleness") {
      if (!dryRun) {
        const config = loadConfig(cwd);
        const graphifyConfig = loadGraphifyConfig(config as unknown as Record<string, unknown>);
        await updateGraph(cwd, graphifyConfig.command);
      }
    }
  }

  return doctorCommand(cwd);
}

export function doctorCommandFormatted(cwd: string, options?: { fix?: boolean; dryRun?: boolean }): string {
  const result = doctorCommand(cwd, options);
  const lines: string[] = [];

  lines.push("Codewright Doctor");
  lines.push("=".repeat(50));
  lines.push("");

  for (const check of result.checks) {
    let icon = "✓";
    switch (check.status) {
      case "ok": icon = "✓"; break;
      case "warning": icon = "⚠"; break;
      case "error": icon = "✗"; break;
      case "fixable": icon = "🔧"; break;
      case "not_fixable": icon = "🚫"; break;
    }

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

export async function doctorCommandJson(cwd: string): Promise<string> {
  const result = await doctorCommand(cwd);
  return JSON.stringify(result, null, 2);
}