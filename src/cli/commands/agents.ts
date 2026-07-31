import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync, cpSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/loader.js";
import { readAgentManifest, writeAgentManifest, installAgentAdapters, MANAGED_MARKER } from "../../agents/install.js";
import { getAgentDefinition, parseAgentTargets, AGENT_DEFINITIONS, type AgentTarget } from "../../agents/registry.js";
import { isPathGitignored } from "../../utils/gitignore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve skills directory - works both in source (src/cli/commands) and bundled (dist/cli)
function getPackageSkillsDir(): string {
  const bundledPath = resolve(__dirname, "../../skills");
  const sourcePath = resolve(__dirname, "../../../skills");
  if (existsSync(bundledPath)) return bundledPath;
  if (existsSync(sourcePath)) return sourcePath;
  return bundledPath;
}
const PACKAGE_SKILLS_DIR = getPackageSkillsDir();

interface AgentStatus {
  target: AgentTarget;
  label: string;
  adapter: string;
  selected: boolean;
  installed: boolean;
  validated: boolean;
  gitignored: boolean;
  unavailable: boolean;
  conflict: boolean;
  adapterFiles: number;
  status: "selected" | "adapter_needed" | "installed" | "validated" | "gitignored" | "unavailable" | "conflict";
}

function getAgentStatus(targetDir: string, target: AgentTarget): AgentStatus {
  const def = getAgentDefinition(target);
  const manifest = readAgentManifest(targetDir);
  const selected = !!manifest.agents[target];

  // Adapter directory is determined by target name: .claude, .cline, .cursor
  const adapterDir = resolve(targetDir, `.${target}`);
  const installed = existsSync(adapterDir);

  let adapterFiles = 0;
  let validated = false;
  let conflict = false;
  let gitignored = false;

  if (installed) {
    const files = readdirSync(adapterDir);
    adapterFiles = files.length;
    validated = adapterFiles > 0;

    // Check if gitignored
    gitignored = isPathGitignored(adapterDir, targetDir);

    // Check for conflict: adapter exists but is not managed by Codewright
    // (missing managed marker) or agent uses canonical adapter but directory exists
    if (validated) {
      let hasManagedFile = false;
      for (const file of files) {
        const filePath = resolve(adapterDir, file);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf-8");
          if (content.includes(MANAGED_MARKER)) {
            hasManagedFile = true;
            break;
          }
        }
      }

      // Conflict if files exist but none are managed, or if canonical adapter has directory
      conflict = !hasManagedFile || def.adapter === "canonical";
    } else if (def.adapter === "canonical") {
      // Directory exists but empty for canonical adapter
      conflict = true;
    }
  } else if (def.adapter !== "canonical") {
    // Expected adapter directory missing for non-canonical adapter
    conflict = selected;
  }

  // Determine status
  let status: AgentStatus["status"];
  if (!selected) {
    status = "unavailable";
  } else if (conflict) {
    status = "conflict";
  } else if (gitignored) {
    status = "gitignored";
  } else if (validated) {
    status = "validated";
  } else if (installed) {
    status = "installed";
  } else {
    status = "adapter_needed";
  }

  return {
    target,
    label: def.label,
    adapter: def.adapter,
    selected,
    installed,
    validated,
    gitignored,
    unavailable: !selected,
    conflict,
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

  // Use v2 manifest format
  const targets = Object.keys(manifest.agents).filter((t): t is AgentTarget =>
    AGENT_DEFINITIONS.some(d => d.id === t)
  );

  const agents = targets.map(t => getAgentStatus(targetDir, t));

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
    const icon = agent.status === "installed" || agent.status === "validated" ? "✓" :
                 agent.status === "adapter_needed" ? "⚠" : "✗";
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
  validation?: { valid: boolean; errors: string[] };
}

export function agentsAddCommand(cwd: string, targets: AgentTarget[], dryRun = false): AgentsAddResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);
  const errors: string[] = [];

  // Validation: Check if targets are valid and not already added
  const validTargets = targets.filter(t => {
    const def = getAgentDefinition(t);
    if (!def) {
      errors.push(`Unknown agent target: ${t}`);
      return false;
    }
    if (manifest.agents[t]) {
      // Already exists - not an error for dry run, but we won't add
      return false;
    }
    return true;
  });

  if (errors.length > 0) {
    return { added: [], manifestPath: "", adapterFiles: [], validation: { valid: false, errors } };
  }

  if (validTargets.length === 0) {
    return { added: [], manifestPath: "", adapterFiles: [], validation: { valid: true, errors: [] } };
  }

  if (dryRun) {
    return { added: validTargets, manifestPath: "", adapterFiles: [], validation: { valid: true, errors: [] } };
  }

  // Update manifest with new agents
  const newAgents = { ...manifest.agents };
  for (const target of validTargets) {
    const def = getAgentDefinition(target);
    newAgents[target] = {
      selected: true,
      adapter: def.adapter,
      status: "adapter_needed",
    };
  }

  const newManifest = { ...manifest, agents: newAgents };
  const manifestPath = writeAgentManifest(targetDir, newManifest);

  // Install adapter files
  const adapterResult = installAgentAdapters({
    targetDir,
    targets: validTargets,
    skillNames: readdirSync(PACKAGE_SKILLS_DIR).filter(name =>
      existsSync(resolve(PACKAGE_SKILLS_DIR, name, "SKILL.md"))
    ),
    upgrade: false,
    backupRoot: "",
  });

  return {
    added: validTargets,
    manifestPath,
    adapterFiles: adapterResult.installedFiles,
    validation: { valid: true, errors: [] },
  };
}

export function agentsAddFormatted(cwd: string, targets: AgentTarget[], dryRun = false): string {
  const result = agentsAddCommand(cwd, targets, dryRun);

  if (result.validation && !result.validation.valid) {
    return `Validation failed:\n${result.validation.errors.map(e => `- ${e}`).join("\n")}`;
  }

  if (result.added.length === 0) {
    return dryRun ? "No new agents would be added (all already exist)." : "All specified agents are already installed.";
  }

  const lines: string[] = [];
  lines.push(dryRun ? "Preview: Agents to Add" : "Added Agents");
  lines.push("=".repeat(50));
  lines.push("");

  for (const target of result.added) {
    const def = getAgentDefinition(target);
    lines.push(`+ ${def.label} (${target})`);
  }

  if (!dryRun) {
    lines.push("");
    lines.push(`Manifest: ${result.manifestPath}`);
    lines.push(`Adapter files: ${result.adapterFiles.length}`);
  }

  return lines.join("\n");
}

export interface AgentsRemoveResult {
  removed: AgentTarget[];
  manifestPath: string;
  validation?: { valid: boolean; errors: string[] };
}

export function agentsRemoveCommand(cwd: string, targets: AgentTarget[], dryRun = false): AgentsRemoveResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);
  const errors: string[] = [];

  // Validation: Check if targets exist in manifest
  const validTargets = targets.filter(t => {
    if (!manifest.agents[t]) {
      errors.push(`Agent '${t}' is not currently installed.`);
      return false;
    }
    return true;
  });

  if (errors.length > 0) {
    return { removed: [], manifestPath: "", validation: { valid: false, errors } };
  }

  if (validTargets.length === 0) {
    return { removed: [], manifestPath: "", validation: { valid: true, errors: [] } };
  }

  if (dryRun) {
    return { removed: validTargets, manifestPath: "", validation: { valid: true, errors: [] } };
  }

  // Remove adapter files
  for (const target of validTargets) {
    const adapterDir = resolve(targetDir, `.${target}`);
    if (existsSync(adapterDir)) {
      rmSync(adapterDir, { recursive: true, force: true });
    }
  }

  // Update manifest
  const newAgents = { ...manifest.agents };
  for (const target of validTargets) {
    delete newAgents[target];
  }

  const newManifest = { ...manifest, agents: newAgents };
  const manifestPath = writeAgentManifest(targetDir, newManifest);

  return {
    removed: validTargets,
    manifestPath,
    validation: { valid: true, errors: [] },
  };
}

export function agentsRemoveFormatted(cwd: string, targets: AgentTarget[], dryRun = false): string {
  const result = agentsRemoveCommand(cwd, targets, dryRun);

  if (result.validation && !result.validation.valid) {
    return `Validation failed:\n${result.validation.errors.map(e => `- ${e}`).join("\n")}`;
  }

  if (result.removed.length === 0) {
    return dryRun ? "No agents would be removed (none match)." : "None of the specified agents are currently installed.";
  }

  const lines: string[] = [];
  lines.push(dryRun ? "Preview: Agents to Remove" : "Removed Agents");
  lines.push("=".repeat(50));
  lines.push("");

  for (const target of result.removed) {
    const def = getAgentDefinition(target);
    lines.push(`- ${def.label} (${target})`);
  }

  if (!dryRun) {
    lines.push("");
    lines.push(`Manifest: ${result.manifestPath}`);
  }

  return lines.join("\n");
}

export interface AgentsSetResult {
  added: AgentTarget[];
  removed: AgentTarget[];
  manifestPath: string;
  adapterFiles: string[];
  validation?: { valid: boolean; errors: string[] };
}

export function agentsSetCommand(cwd: string, targets: AgentTarget[], dryRun = false): AgentsSetResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);
  const errors: string[] = [];

  // Validation: Check if all targets are valid
  const validTargets = targets.filter(t => {
    const def = getAgentDefinition(t);
    if (!def) {
      errors.push(`Unknown agent target: ${t}`);
      return false;
    }
    return true;
  });

  if (errors.length > 0) {
    return { added: [], removed: [], manifestPath: "", adapterFiles: [], validation: { valid: false, errors } };
  }

  const currentTargets = Object.keys(manifest.agents) as AgentTarget[];
  const toAdd = validTargets.filter(t => !currentTargets.includes(t));
  const toRemove = currentTargets.filter(t => !validTargets.includes(t));

  if (dryRun) {
    return { added: toAdd, removed: toRemove, manifestPath: "", adapterFiles: [], validation: { valid: true, errors: [] } };
  }

  // Remove adapters for removed agents
  for (const target of toRemove) {
    const adapterDir = resolve(targetDir, `.${target}`);
    if (existsSync(adapterDir)) {
      rmSync(adapterDir, { recursive: true, force: true });
    }
  }

  // Create new manifest with specified targets
  const newAgents: Record<string, any> = {};
  for (const target of validTargets) {
    const def = getAgentDefinition(target);
    newAgents[target] = manifest.agents[target] || {
      selected: true,
      adapter: def.adapter,
      status: "adapter_needed",
    };
  }

  const newManifest = { ...manifest, agents: newAgents };
  const manifestPath = writeAgentManifest(targetDir, newManifest);

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
    validation: { valid: true, errors: [] },
  };
}

export function agentsSetFormatted(cwd: string, targets: AgentTarget[], dryRun = false): string {
  const result = agentsSetCommand(cwd, targets, dryRun);

  if (result.validation && !result.validation.valid) {
    return `Validation failed:\n${result.validation.errors.map(e => `- ${e}`).join("\n")}`;
  }

  const lines: string[] = [];
  lines.push(dryRun ? "Preview: Set Agents" : "Set Agents");
  lines.push("=".repeat(50));
  lines.push("");

  if (result.added.length > 0) {
    lines.push("Add:");
    for (const target of result.added) {
      const def = getAgentDefinition(target);
      lines.push(`  + ${def.label} (${target})`);
    }
  }

  if (result.removed.length > 0) {
    lines.push("Remove:");
    for (const target of result.removed) {
      const def = getAgentDefinition(target);
      lines.push(`  - ${def.label} (${target})`);
    }
  }

  if (result.added.length === 0 && result.removed.length === 0) {
    lines.push("No changes needed.");
  }

  if (!dryRun) {
    lines.push("");
    lines.push(`Manifest: ${result.manifestPath}`);
    lines.push(`Adapter files: ${result.adapterFiles.length}`);
  }

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

  for (const target of Object.keys(manifest.agents) as AgentTarget[]) {
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
  issues: { target: AgentTarget; issue: string; recommendation: string }[];
  agentStatuses: AgentStatus[];
  summary: {
    total: number;
    healthy: number;
    issues: number;
    selected: number;
    installed: number;
    validated: number;
    gitignored: number;
    conflict: number;
    unavailable: number;
    adapter_needed: number;
  };
}

export function agentsDoctorCommand(cwd: string): AgentsDoctorResult {
  const targetDir = cwd;
  const manifest = readAgentManifest(targetDir);
  const issues: { target: AgentTarget; issue: string; recommendation: string }[] = [];

  // Get status for all agents in manifest
  const targets = Object.keys(manifest.agents) as AgentTarget[];
  const agentStatuses = targets.map(t => getAgentStatus(targetDir, t));

  // Analyze each agent for issues
  for (const status of agentStatuses) {
    const { target, installed, validated, gitignored, conflict, adapter, adapterFiles } = status;

    if (conflict) {
      let issue = "";
      let recommendation = "";

      if (adapter === "canonical" && installed) {
        issue = "Canonical adapter has unexpected adapter directory";
        recommendation = "Run 'codewright agents remove " + target + "' to clean up, or use 'codewright agents repair'";
      } else if (installed && adapterFiles > 0) {
        issue = "Adapter files exist but are not managed by Codewright";
        recommendation = "Run 'codewright agents repair " + target + "' to overwrite with managed adapters, or manually manage adapters";
      } else {
        issue = "Adapter configuration conflict detected";
        recommendation = "Run 'codewright agents repair " + target + "' to resolve";
      }

      issues.push({ target, issue, recommendation });
    } else if (gitignored) {
      issues.push({
        target,
        issue: "Adapter directory is gitignored",
        recommendation: "Remove directory from .gitignore or use 'codewright agents remove " + target + "'"
      });
    } else if (!installed && adapter !== "canonical") {
      issues.push({
        target,
        issue: "Adapter directory missing",
        recommendation: "Run 'codewright agents repair " + target + "' to install adapters"
      });
    } else if (installed && !validated) {
      issues.push({
        target,
        issue: "Adapter directory empty",
        recommendation: "Run 'codewright agents repair " + target + "' to populate adapter files"
      });
    }
  }

  // Calculate summary
  const summary = {
    total: agentStatuses.length,
    healthy: agentStatuses.filter(s => !s.conflict && !s.gitignored && (s.validated || s.adapter === "canonical")).length,
    issues: issues.length,
    selected: agentStatuses.filter(s => s.selected).length,
    installed: agentStatuses.filter(s => s.installed).length,
    validated: agentStatuses.filter(s => s.validated).length,
    gitignored: agentStatuses.filter(s => s.gitignored).length,
    conflict: agentStatuses.filter(s => s.conflict).length,
    unavailable: agentStatuses.filter(s => s.unavailable).length,
    adapter_needed: agentStatuses.filter(s => s.status === "adapter_needed").length,
  };

  return {
    healthy: issues.length === 0,
    issues,
    agentStatuses,
    summary,
  };
}

export function agentsDoctorFormatted(cwd: string): string {
  const result = agentsDoctorCommand(cwd);

  const lines: string[] = [];
  lines.push("Agent Doctor");
  lines.push("=".repeat(50));
  lines.push("");

  // Summary
  lines.push("Summary:");
  lines.push(`  Total agents: ${result.summary.total}`);
  lines.push(`  Healthy: ${result.summary.healthy}`);
  lines.push(`  With issues: ${result.summary.issues}`);
  lines.push(`  Selected: ${result.summary.selected}`);
  lines.push(`  Installed: ${result.summary.installed}`);
  lines.push(`  Validated: ${result.summary.validated}`);
  lines.push(`  Gitignored: ${result.summary.gitignored}`);
  lines.push(`  Conflict: ${result.summary.conflict}`);
  lines.push(`  Unavailable: ${result.summary.unavailable}`);
  lines.push(`  Adapter needed: ${result.summary.adapter_needed}`);
  lines.push("");

  // Detailed status for each agent
  lines.push("Detailed Status:");
  lines.push("-".repeat(50));
  for (const status of result.agentStatuses) {
    const icon = status.conflict ? "✗" :
                 status.gitignored ? "⚠" :
                 status.validated ? "✓" :
                 status.installed ? "○" : "○";

    lines.push(`${icon} ${status.label} (${status.target})`);
    lines.push(`  Status: ${status.status}`);
    lines.push(`  Adapter: ${status.adapter}`);
    lines.push(`  Files: ${status.adapterFiles}`);
    lines.push(`  Selected: ${status.selected ? "Yes" : "No"}`);
    lines.push(`  Installed: ${status.installed ? "Yes" : "No"}`);
    lines.push(`  Validated: ${status.validated ? "Yes" : "No"}`);
    lines.push(`  Gitignored: ${status.gitignored ? "Yes" : "No"}`);
    lines.push(`  Conflict: ${status.conflict ? "Yes" : "No"}`);
    lines.push("");
  }

  // Issues and recommendations
  if (result.healthy) {
    lines.push("✓ All agents are healthy");
  } else {
    lines.push(`✗ Found ${result.issues.length} issue(s):`);
    lines.push("");
    for (const { target, issue, recommendation } of result.issues) {
      const def = getAgentDefinition(target);
      lines.push(`  ${def.label} (${target}):`);
      lines.push(`    Issue: ${issue}`);
      lines.push(`    Recommendation: ${recommendation}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}