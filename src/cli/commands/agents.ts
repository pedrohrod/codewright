import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/loader.js";
import { readAgentManifest, writeAgentManifest, installAgentAdapters } from "../../agents/install.js";
import { getAgentDefinition, parseAgentTargets, AGENT_DEFINITIONS, type AgentTarget } from "../../agents/registry.js";
import { isPathGitignored } from "../../utils/gitignore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_SKILLS_DIR = resolve(__dirname, "../../skills");

interface AgentStatus {
  target: AgentTarget;
  label: string;
  adapter: string;
  selected: boolean;
  installed: boolean;
  adapterFiles: number;
  status: "installed" | "partial" | "missing" | "error";
}

function getAgentStatus(targetDir: string, target: AgentTarget): AgentStatus {
  const def = getAgentDefinition(target);
  // Adapter directory is determined by target name: .claude, .cline, .cursor
  const adapterDir = resolve(targetDir, `.${target}`);
  let adapterFiles = 0;

  if (existsSync(adapterDir)) {
    adapterFiles = readdirSync(adapterDir).length;
  }

  const installed = adapterFiles > 0;
  let status: AgentStatus["status"] = "missing";

  if (installed) {
    status = "installed";
  } else if (existsSync(adapterDir)) {
    status = "partial";
  }

  return {
    target,
    label: def.label,
    adapter: def.adapter,
    selected: true,
    installed,
    adapterFiles,
    status,
  };
}

export interface AgentsListResult {
  agents: AgentStatus[];
  manifestVersion: number;
}

export function agentsListCommand(cwd: string): AgentsListResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);

  const agents = manifest.targets.map(t => getAgentStatus(targetDir, t));

  return {
    agents,
    manifestVersion: manifest.version,
  };
}

export function agentsListFormatted(cwd: string): string {
  const result = agentsListCommand(cwd);
  const lines: string[] = [];

  lines.push("Installed Agents");
  lines.push("=".repeat(50));
  lines.push("");

  if (result.agents.length === 0) {
    lines.push("No agents configured. Run 'codewright init --agents all' to set up agents.");
    return lines.join("\n");
  }

  for (const agent of result.agents) {
    const icon = agent.status === "installed" ? "✓" :
                 agent.status === "partial" ? "⚠" : "✗";
    lines.push(`${icon} ${agent.label} (${agent.target})`);
    lines.push(`  Adapter: ${agent.adapter}`);
    lines.push(`  Files: ${agent.adapterFiles}`);
    lines.push(`  Status: ${agent.status}`);
    lines.push("");
  }

  // Check for gitignored agent directories
  const ignoredDirs: string[] = [];
  for (const agent of result.agents) {
    let dirName = `.${agent.target}`;
    if (agent.target === "cursor") dirName = ".cursor";

    const dirPath = resolve(cwd, dirName);
    if (existsSync(dirPath) && isPathGitignored(dirPath, cwd)) {
      ignoredDirs.push(dirName);
    }
  }

  if (ignoredDirs.length > 0) {
    lines.push("⚠ Warning: The following agent directories are ignored by Git (.gitignore):");
    lines.push(ignoredDirs.map(d => `  - ${d}`).join("\n"));
    lines.push("Other clones will not receive these adapters.");
    lines.push("");
  }

  return lines.join("\n");
}

export interface AgentsAddResult {
  added: AgentTarget[];
  manifestPath: string;
  adapterFiles: string[];
}

export function agentsAddCommand(cwd: string, targets: AgentTarget[]): AgentsAddResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);

  const newTargets = targets.filter(t => !manifest.targets.includes(t));

  if (newTargets.length === 0) {
    return { added: [], manifestPath: "", adapterFiles: [] };
  }

  const allTargets = [...manifest.targets, ...newTargets];
  const manifestPath = writeAgentManifest(targetDir, allTargets);

  const adapterResult = installAgentAdapters({
    targetDir,
    targets: newTargets,
    skillNames: readdirSync(PACKAGE_SKILLS_DIR).filter(name =>
      existsSync(resolve(PACKAGE_SKILLS_DIR, name, "SKILL.md"))
    ),
    upgrade: false,
    backupRoot: "",
  });

  return {
    added: newTargets,
    manifestPath,
    adapterFiles: adapterResult.installedFiles,
  };
}

export function agentsAddFormatted(cwd: string, targets: AgentTarget[]): string {
  const result = agentsAddCommand(cwd, targets);

  if (result.added.length === 0) {
    return "All specified agents are already installed.";
  }

  const lines: string[] = [];
  lines.push("Added Agents");
  lines.push("=".repeat(50));
  lines.push("");

  for (const target of result.added) {
    const def = getAgentDefinition(target);
    lines.push(`✓ ${def.label} (${target})`);
  }

  lines.push("");
  lines.push(`Manifest: ${result.manifestPath}`);
  lines.push(`Adapter files: ${result.adapterFiles.length}`);

  return lines.join("\n");
}

export interface AgentsRemoveResult {
  removed: AgentTarget[];
  manifestPath: string;
}

export function agentsRemoveCommand(cwd: string, targets: AgentTarget[]): AgentsRemoveResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);

  const targetsToRemove = targets.filter(t => manifest.targets.includes(t));

  if (targetsToRemove.length === 0) {
    return { removed: [], manifestPath: "" };
  }

  // Remove adapter files
  for (const target of targetsToRemove) {
    const def = getAgentDefinition(target);
    // Adapter directory is determined by target name: .claude, .cline, .cursor
    const adapterDir = resolve(targetDir, `.${target}`);
    if (existsSync(adapterDir)) {
      rmSync(adapterDir, { recursive: true, force: true });
    }
  }

  const remainingTargets = manifest.targets.filter(t => !targetsToRemove.includes(t));
  const manifestPath = writeAgentManifest(targetDir, remainingTargets);

  return {
    removed: targetsToRemove,
    manifestPath,
  };
}

export function agentsRemoveFormatted(cwd: string, targets: AgentTarget[]): string {
  const result = agentsRemoveCommand(cwd, targets);

  if (result.removed.length === 0) {
    return "None of the specified agents are currently installed.";
  }

  const lines: string[] = [];
  lines.push("Removed Agents");
  lines.push("=".repeat(50));
  lines.push("");

  for (const target of result.removed) {
    const def = getAgentDefinition(target);
    lines.push(`✓ ${def.label} (${target})`);
  }

  lines.push("");
  lines.push(`Manifest: ${result.manifestPath}`);

  return lines.join("\n");
}

export interface AgentsSetResult {
  added: AgentTarget[];
  removed: AgentTarget[];
  manifestPath: string;
  adapterFiles: string[];
}

export function agentsSetCommand(cwd: string, targets: AgentTarget[]): AgentsSetResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);

  const toAdd = targets.filter(t => !manifest.targets.includes(t));
  const toRemove = manifest.targets.filter(t => !targets.includes(t));

  // Remove adapters for removed agents
  for (const target of toRemove) {
    const def = getAgentDefinition(target);
    // Adapter directory is determined by target name: .claude, .cline, .cursor
    const adapterDir = resolve(targetDir, `.${target}`);
    if (existsSync(adapterDir)) {
      rmSync(adapterDir, { recursive: true, force: true });
    }
  }

  const manifestPath = writeAgentManifest(targetDir, targets);

  // Install adapters for new agents
  const adapterResult = installAgentAdapters({
    targetDir,
    targets: toAdd,
    skillNames: readdirSync(PACKAGE_SKILLS_DIR).filter(name =>
      existsSync(resolve(PACKAGE_SKILLS_DIR, name, "SKILL.md"))
    ),
    upgrade: false,
    backupRoot: "",
  });

  return {
    added: toAdd,
    removed: toRemove,
    manifestPath,
    adapterFiles: adapterResult.installedFiles,
  };
}

export function agentsSetFormatted(cwd: string, targets: AgentTarget[]): string {
  const result = agentsSetCommand(cwd, targets);

  const lines: string[] = [];
  lines.push("Set Agents");
  lines.push("=".repeat(50));
  lines.push("");

  if (result.added.length > 0) {
    lines.push("Added:");
    for (const target of result.added) {
      const def = getAgentDefinition(target);
      lines.push(`  ✓ ${def.label} (${target})`);
    }
  }

  if (result.removed.length > 0) {
    lines.push("Removed:");
    for (const target of result.removed) {
      const def = getAgentDefinition(target);
      lines.push(`  ✗ ${def.label} (${target})`);
    }
  }

  if (result.added.length === 0 && result.removed.length === 0) {
    lines.push("No changes needed.");
  }

  lines.push("");
  lines.push(`Manifest: ${result.manifestPath}`);

  return lines.join("\n");
}

export interface AgentsRepairResult {
  repaired: AgentTarget[];
  failed: AgentTarget[];
}

export function agentsRepairCommand(cwd: string): AgentsRepairResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);

  const repaired: AgentTarget[] = [];
  const failed: AgentTarget[] = [];

  for (const target of manifest.targets) {
    const def = getAgentDefinition(target);
    // Adapter directory is determined by target name: .claude, .cline, .cursor
    const adapterDir = resolve(targetDir, `.${target}`);
    const installed = existsSync(adapterDir) && readdirSync(adapterDir).length > 0;

    if (!installed) {
      try {
        const result = installAgentAdapters({
          targetDir,
          targets: [target],
          skillNames: readdirSync(PACKAGE_SKILLS_DIR).filter(name =>
            existsSync(resolve(PACKAGE_SKILLS_DIR, name, "SKILL.md"))
          ),
          upgrade: true,
          backupRoot: "",
        });

        if (result.installedFiles.length > 0) {
          repaired.push(target);
        } else {
          failed.push(target);
        }
      } catch {
        failed.push(target);
      }
    } else {
      repaired.push(target);
    }
  }

  return { repaired, failed };
}

export function agentsRepairFormatted(cwd: string): string {
  const result = agentsRepairCommand(cwd);

  const lines: string[] = [];
  lines.push("Repair Agents");
  lines.push("=".repeat(50));
  lines.push("");

  if (result.repaired.length > 0) {
    lines.push("Repaired/OK:");
    for (const target of result.repaired) {
      const def = getAgentDefinition(target);
      lines.push(`  ✓ ${def.label} (${target})`);
    }
  }

  if (result.failed.length > 0) {
    lines.push("Failed:");
    for (const target of result.failed) {
      const def = getAgentDefinition(target);
      lines.push(`  ✗ ${def.label} (${target})`);
    }
  }

  return lines.join("\n");
}

export interface AgentsDoctorResult {
  healthy: boolean;
  issues: { target: AgentTarget; issue: string }[];
}

export function agentsDoctorCommand(cwd: string): AgentsDoctorResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);
  const issues: { target: AgentTarget; issue: string }[] = [];

  for (const target of manifest.targets) {
    const def = getAgentDefinition(target);
    // Adapter directory is determined by target name: .claude, .cline, .cursor
    const adapterDir = resolve(targetDir, `.${target}`);

    if (!existsSync(adapterDir)) {
      issues.push({ target, issue: "Adapter directory missing" });
      continue;
    }

    const files = readdirSync(adapterDir);
    if (files.length === 0) {
      issues.push({ target, issue: "Adapter directory empty" });
    }

    // Check for expected files based on adapter type
    if (def.adapter === "skill-wrapper") {
      const expectedDir = def.adapter === "skill-wrapper" ? "skills" : "commands";
      const expectedPath = resolve(adapterDir, expectedDir);
      if (!existsSync(expectedPath)) {
        issues.push({ target, issue: `Missing ${expectedDir} directory` });
      }
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

export function agentsDoctorFormatted(cwd: string): string {
  const result = agentsDoctorCommand(cwd);

  const lines: string[] = [];
  lines.push("Agent Doctor");
  lines.push("=".repeat(50));
  lines.push("");

  if (result.healthy) {
    lines.push("✓ All agents are healthy");
  } else {
    lines.push(`✗ Found ${result.issues.length} issue(s):`);
    lines.push("");
    for (const { target, issue } of result.issues) {
      const def = getAgentDefinition(target);
      lines.push(`  ${def.label} (${target}): ${issue}`);
    }
  }

  return lines.join("\n");
}