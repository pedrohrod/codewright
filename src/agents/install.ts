import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { dump, load } from "js-yaml";
import {
  AGENT_TARGETS,
  type AgentTarget,
  getAgentDefinition,
} from "./registry.js";

const MANAGED_MARKER = "<!-- codewright-managed: agent-adapter v1 -->";

export interface AgentManifest {
  version: 1;
  targets: AgentTarget[];
}

export interface AdapterInstallResult {
  installedFiles: string[];
  warnings: string[];
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

export function readAgentManifest(targetDir: string): AgentManifest {
  const path = resolve(targetDir, ".codewright", "agents.yaml");
  if (!existsSync(path)) return { version: 1, targets: [] };
  try {
    const parsed = load(readFileSync(path, "utf-8")) as { targets?: unknown } | null;
    const targets = Array.isArray(parsed?.targets)
      ? parsed.targets.filter((target): target is AgentTarget => AGENT_TARGETS.includes(target as AgentTarget))
      : [];
    return { version: 1, targets: [...new Set(targets)] };
  } catch {
    return { version: 1, targets: [] };
  }
}

export function writeAgentManifest(targetDir: string, targets: AgentTarget[]): string {
  const path = resolve(targetDir, ".codewright", "agents.yaml");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, dump({ version: 1, targets }, { noRefs: true, lineWidth: -1 }), "utf-8");
  return path;
}

function readSkillDescription(skillPath: string): string {
  const content = readFileSync(skillPath, "utf-8");
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return "Run the corresponding Codewright workflow.";
  const frontmatter = load(match[1]) as { description?: unknown } | null;
  return typeof frontmatter?.description === "string"
    ? frontmatter.description
    : "Run the corresponding Codewright workflow.";
}

function skillWrapper(skillName: string, description: string, canonicalPath: string): string {
  return `---
name: ${skillName}
description: ${JSON.stringify(description)}
---

${MANAGED_MARKER}

# Codewright adapter

Read and follow the complete canonical skill at \`${canonicalPath}\`. Treat its directory as the skill root when resolving references, scripts, assets, and customization. The canonical skill is authoritative.
`;
}

function cursorCommand(skillName: string, canonicalPath: string): string {
  return `${MANAGED_MARKER}

# ${skillName}

Read and follow the complete canonical skill at \`${canonicalPath}\`. Treat its directory as the skill root when resolving references, scripts, assets, and customization. Apply the workflow to the user's current request.
`;
}

function writeManagedAdapter(
  targetDir: string,
  destination: string,
  content: string,
  upgrade: boolean,
  backupRoot: string,
  result: AdapterInstallResult,
): void {
  const relativePath = normalizePath(relative(targetDir, destination));
  if (existsSync(destination)) {
    const existing = readFileSync(destination, "utf-8");
    if (!existing.includes(MANAGED_MARKER)) {
      result.warnings.push(`Preserved user-managed adapter: ${relativePath}`);
      return;
    }
    if (!upgrade) return;
    const backupPath = resolve(backupRoot, "adapters", relativePath);
    mkdirSync(dirname(backupPath), { recursive: true });
    cpSync(destination, backupPath, { force: true });
  }
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, content, "utf-8");
  result.installedFiles.push(relativePath);
}

export function installAgentAdapters(options: {
  targetDir: string;
  targets: AgentTarget[];
  skillNames: readonly string[];
  upgrade: boolean;
  backupRoot: string;
}): AdapterInstallResult {
  const result: AdapterInstallResult = { installedFiles: [], warnings: [] };
  for (const target of options.targets) {
    const definition = getAgentDefinition(target);
    if (definition.adapter === "canonical") continue;

    for (const skillName of options.skillNames) {
      const canonicalSkill = resolve(options.targetDir, ".agents", "skills", skillName, "SKILL.md");
      if (!existsSync(canonicalSkill)) continue;
      const description = readSkillDescription(canonicalSkill);

      if (target === "claude" || target === "cline") {
        const destination = resolve(options.targetDir, `.${target}`, "skills", skillName, "SKILL.md");
        const canonicalPath = normalizePath(relative(dirname(destination), canonicalSkill));
        writeManagedAdapter(
          options.targetDir,
          destination,
          skillWrapper(skillName, description, canonicalPath),
          options.upgrade,
          options.backupRoot,
          result,
        );
      } else if (target === "cursor") {
        const destination = resolve(options.targetDir, ".cursor", "commands", `${skillName}.md`);
        const canonicalPath = normalizePath(relative(dirname(destination), canonicalSkill));
        writeManagedAdapter(
          options.targetDir,
          destination,
          cursorCommand(skillName, canonicalPath),
          options.upgrade,
          options.backupRoot,
          result,
        );
      }
    }
  }
  return result;
}
