import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { dump, load } from "js-yaml";
import {
  AGENT_TARGETS,
  type AgentTarget,
  getAgentDefinition,
} from "./registry.js";

export const MANAGED_MARKER = "<!-- codewright-managed: agent-adapter v1 -->";

// Managed section markers for root rules
export const MANAGED_SECTION_START = "<!-- codewright-managed:start -->";
export const MANAGED_SECTION_END = "<!-- codewright-managed:end -->";

// Root rule content
const ROOT_RULE_CONTENT = "Use the applicable Codewright skill for every code-related task.";

export interface AgentManifest {
  version: 1;
  targets: AgentTarget[];
}

export interface AgentManifestV2 {
  version: 2;
  agents: Record<string, AgentInfo>;
  graphify?: {
    enabled: boolean;
    mode: "off" | "advisory" | "required";
    graph_path: string;
    last_validation: string | null;
  };
}

export interface AgentInfo {
  selected: boolean;
  adapter: string;
  status: "selected" | "adapter_needed" | "installed" | "validated" | "gitignored" | "unavailable" | "conflict";
  adapterVersion?: number;
  installedSkills?: number;
}

export interface AdapterInstallResult {
  installedFiles: string[];
  warnings: string[];
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function migrateV1ToV2(v1: { version: number; targets: string[] }): AgentManifestV2 {
  const agents: Record<string, AgentInfo> = {};
  for (const target of v1.targets) {
    agents[target] = {
      selected: true,
      adapter: target === "claude" || target === "cline" ? "skill-wrapper" :
               target === "cursor" ? "cursor-command" : "canonical",
      status: "installed",
    };
  }
  return {
    version: 2,
    agents,
  };
}

export function readAgentManifest(targetDir: string): AgentManifestV2 {
  const path = resolve(targetDir, ".codewright", "agents.yaml");
  if (!existsSync(path)) return { version: 2, agents: {} };
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = load(content) as { version?: number; targets?: unknown; agents?: unknown } | null;

    if (!parsed || typeof parsed !== "object") {
      return { version: 2, agents: {} };
    }

    // Check for v2 format
    if (parsed.version === 2) {
      // Validate v2 structure
      if (parsed.agents && typeof parsed.agents === "object") {
        return {
          version: 2,
          agents: parsed.agents as Record<string, AgentInfo>,
          graphify: (parsed as any).graphify,
        };
      }
      return { version: 2, agents: {} };
    }

    // Check for v1 format and migrate
    if (parsed.version === 1) {
      const targets = Array.isArray(parsed.targets)
        ? parsed.targets.filter((target): target is AgentTarget => AGENT_TARGETS.includes(target as AgentTarget))
        : [];
      const v1Data = { version: 1, targets: [...new Set(targets)] };
      return migrateV1ToV2(v1Data);
    }

    // Unknown version
    throw new Error("Unsupported manifest version");
  } catch (error) {
    if (error instanceof Error && error.message === "Unsupported manifest version") {
      throw error;
    }
    return { version: 2, agents: {} };
  }
}

export function writeAgentManifest(targetDir: string, manifest: AgentManifestV2): string {
  const path = resolve(targetDir, ".codewright", "agents.yaml");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, dump(manifest, { noRefs: true, lineWidth: -1 }), "utf-8");
  return path;
}

export function writeAgentManifestV1(targetDir: string, targets: AgentTarget[]): string {
  const path = resolve(targetDir, ".codewright", "agents.yaml");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, dump({ version: 1, targets }, { noRefs: true, lineWidth: -1 }), "utf-8");
  return path;
}

export function getAgentStatus(targetDir: string, target: string): AgentInfo {
  const manifest = readAgentManifest(targetDir);
  if (manifest.agents[target]) {
    return manifest.agents[target];
  }
  return {
    selected: false,
    adapter: "unknown",
    status: "unavailable",
  };
}

export function validateManifestIntegrity(targetDir: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const manifest = readAgentManifest(targetDir);

  if (manifest.version !== 2) {
    issues.push(`Manifest version is ${manifest.version}, expected 2`);
  }

  if (!manifest.agents || typeof manifest.agents !== "object") {
    issues.push("Missing or invalid agents object");
    return { valid: false, issues };
  }

  for (const [name, agent] of Object.entries(manifest.agents)) {
    if (!agent.adapter) {
      issues.push(`Agent "${name}" is missing adapter field`);
    }
    if (!agent.status) {
      issues.push(`Agent "${name}" is missing status field`);
    }
  }

  return { valid: issues.length === 0, issues };
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

// ─── Managed Section Utilities ────────────────────────────────

export interface ManagedSectionResult {
  filePath: string;
  action: "created" | "updated" | "unchanged";
}

/**
 * Build the managed section content for root rules.
 */
export function buildManagedSection(): string {
  return `${MANAGED_SECTION_START}\n${ROOT_RULE_CONTENT}\n${MANAGED_SECTION_END}`;
}

/**
 * Upsert a managed section into existing content.
 * - If section doesn't exist, appends at end
 * - If section exists, replaces it in place
 * - Never removes existing content
 */
export function upsertManagedSection(content: string, section: string): string {
  // Handle all occurrences of managed section (including duplicates)
  const regex = new RegExp(`${escapeRegex(MANAGED_SECTION_START)}[\\s\\S]*?${escapeRegex(MANAGED_SECTION_END)}`, "g");

  // Check if any managed section exists
  if (!regex.test(content)) {
    // Managed section doesn't exist - append at end
    if (content.length === 0) return `${section}\n`;
    const separator = content.endsWith("\n") ? "" : "\n";
    const extra = content.endsWith("\n\n") || content.endsWith("\n") ? "" : "\n";
    return `${content}${separator}${extra}${section}\n`;
  }

  // Reset regex
  regex.lastIndex = 0;

  // Find content before first managed section and after last managed section
  const firstMatch = regex.exec(content);
  const lastMatch = [...content.matchAll(regex)].pop();

  if (!firstMatch || !lastMatch) {
    // Should not happen, but fallback
    return content;
  }

  const before = content.slice(0, firstMatch.index);
  const after = content.slice(lastMatch.index! + lastMatch[0].length);

  // Trim trailing newlines from before and leading newlines from after
  const beforeTrimmed = before.replace(/[\n\r]+$/, "");
  const afterTrimmed = after.replace(/^[\n\r]+/, "");

  const parts = [beforeTrimmed, section, afterTrimmed].filter((part) => part.length > 0);
  return parts.join("\n\n") + "\n";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Install a managed section into a file.
 * Creates the file if it doesn't exist, or updates it if it does.
 */
export function installManagedSection(
  filePath: string,
  section: string,
  initialContent = "",
): ManagedSectionResult {
  const existing = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null;
  const updated = upsertManagedSection(existing ?? initialContent, section);

  if (existing === updated) {
    return { filePath, action: "unchanged" };
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, updated, "utf-8");
  return { filePath, action: existing === null ? "created" : "updated" };
}

/**
 * Get the native instruction file path for an agent target.
 * Returns null if the agent uses AGENTS.md as its primary file.
 */
export function getAgentInstructionPath(target: AgentTarget, targetDir: string): string | null {
  switch (target) {
    case "claude":
    case "cline":
      return resolve(targetDir, ".claude", "CLAUDE.md");
    case "gemini":
      return resolve(targetDir, "GEMINI.md");
    case "copilot":
      return resolve(targetDir, ".github", "copilot-instructions.md");
    case "windsurf":
      return resolve(targetDir, ".windsurf", "rules.md");
    case "cursor":
      return resolve(targetDir, ".cursor", "rules", "codewright.mdc");
    case "codex":
    case "opencode":
      return null; // These use AGENTS.md directly
    default:
      return null;
  }
}

/**
 * Build native instruction file content for an agent.
 * Wraps the managed section with agent-specific header.
 */
export function buildNativeInstructionContent(target: AgentTarget, section: string): string {
  switch (target) {
    case "claude":
    case "cline":
      return `# Claude Code Instructions\n\n${section}`;
    case "gemini":
      return `# Gemini Instructions\n\n${section}`;
    case "copilot":
      return `# GitHub Copilot Instructions\n\n${section}`;
    case "windsurf":
      return `# Windsurf Rules\n\n${section}`;
    case "cursor":
      return `---\ndescription: Codewright root rule\nglobs: **/*\n---\n\n${section}`;
    default:
      return section;
  }
}

/**
 * Install managed root rules for all applicable targets.
 * Handles AGENTS.md (universal) and native agent files.
 */
export function installManagedRootRules(options: {
  targetDir: string;
  targets: AgentTarget[];
  agentsTemplate?: string;
}): ManagedSectionResult[] {
  const results: ManagedSectionResult[] = [];
  const section = buildManagedSection();

  // 1. Always ensure AGENTS.md has the managed section
  const agentsPath = resolve(options.targetDir, "AGENTS.md");
  const agentsResult = installManagedSection(
    agentsPath,
    section,
    options.agentsTemplate,
  );
  results.push(agentsResult);

  // 2. Generate native instruction files for selected agents
  for (const target of options.targets) {
    const nativePath = getAgentInstructionPath(target, options.targetDir);
    if (!nativePath) continue; // Agent uses AGENTS.md directly

    const nativeContent = buildNativeInstructionContent(target, section);
    const nativeResult = installManagedSection(nativePath, nativeContent);
    results.push(nativeResult);
  }

  return results;
}

// ─── Graphify Managed Block Utilities ──────────────────────────

const GRAPHIFY_BLOCK_START = "<!-- codewright-managed:graphify:start -->";
const GRAPHIFY_BLOCK_END = "<!-- codewright-managed:graphify:end -->";

export function buildGraphifyManagedBlock(): string {
  return `${GRAPHIFY_BLOCK_START}
## Mandatory Graphify analysis

- For every task that requires understanding, analyzing, reviewing, debugging, refactoring, architecting, or changing code, consult Graphify before drawing conclusions or choosing the implementation scope.
- Start with \`graphify query "<question about the code>" --budget 4000\`.
- Use \`graphify explain\`, \`graphify affected\`, and \`graphify path\` for symbol relationships, impact analysis, and call paths.
- If the graph is missing or stale, follow the configured Graphify update policy.
- Verify all relevant Graphify conclusions against source files and tests.
- Exact searches such as \`rg\` complement Graphify but do not replace the mandatory architectural query.
- If Graphify is unavailable, follow the configured \`off\`, \`advisory\`, or \`required\` behavior.
${GRAPHIFY_BLOCK_END}`;
}

export function upsertGraphifyBlock(content: string): string {
  const block = buildGraphifyManagedBlock();
  const regex = new RegExp(`${GRAPHIFY_BLOCK_START}[\\s\\S]*?${GRAPHIFY_BLOCK_END}`, "g");

  if (regex.test(content)) {
    return content.replace(regex, block);
  }
  return content + "\n\n" + block;
}

export function removeGraphifyBlock(content: string): string {
  const regex = new RegExp(`\\n*${GRAPHIFY_BLOCK_START}[\\s\\S]*?${GRAPHIFY_BLOCK_END}\\n*`, "g");
  return content.replace(regex, "");
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
