import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/loader.js";
import {
  installAgentAdapters,
  installManagedRootRules,
  readAgentManifest,
  writeAgentManifest,
} from "../../agents/install.js";
import type { AgentTarget } from "../../agents/registry.js";
import { contextGenerateCommand, contextLlmsCommand } from "./context.js";
import { isPathGitignored } from "../../utils/gitignore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Skills directory inside the installed package
const PACKAGE_SKILLS_DIR = resolve(__dirname, "../../skills");

export const SKILL_NAMES = [
  "codewright-init",
  "codewright-spec",
  "codewright-architecture",
  "codewright-story",
  "codewright-dev",
  "codewright-review",
  "codewright-quality",
  "codewright-test",
  "codewright-refactor",
  "codewright-readiness",
  "codewright-quick-dev",
  "codewright-document",
  "codewright-retrospective",
  "codewright-epic",
  "codewright-develop",
  "codewright-rules",
  "codewright-hook",
  "codewright-ci",
  "codewright-commit",
  "codewright-context",
  "codewright-deps",
  "codewright-testgen",
  "codewright-env",
  "codewright-deploy",
  "codewright-perf",
] as const;

export interface InitOptions {
  upgradeSkills?: boolean;
  agents?: AgentTarget[];
  dryRun?: boolean;
}

export interface DryRunAction {
  type: "create" | "update" | "preserve" | "remove";
  path: string;
  reason: string;
}

export interface DryRunResult {
  actions: DryRunAction[];
  skills: string[];
  agentAdapters: string[];
  detected: DetectedStack;
}

interface DetectedStack {
  framework?: string;
  test_runner?: string;
  lint_tools: string[];
  project_language?: string;
  strict_mode?: boolean;
}

// Staging entry for atomic operations
interface StagingEntry {
  source: string;
  destination: string;
  existedBefore: boolean;
  backupPath?: string;
}

function detectProjectStack(targetDir: string): DetectedStack {
  const detected: DetectedStack = { lint_tools: [] };
  const pkgPath = resolve(targetDir, "package.json");

  if (!existsSync(pkgPath)) {
    // Check for other languages
    if (existsSync(resolve(targetDir, "requirements.txt")) || existsSync(resolve(targetDir, "setup.py")) || existsSync(resolve(targetDir, "pyproject.toml"))) {
      detected.project_language = "python";
      detected.framework = "python";
    } else if (existsSync(resolve(targetDir, "go.mod"))) {
      detected.project_language = "go";
      detected.framework = "go";
    }
    return detected;
  }

  detected.project_language = "javascript";

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const allDeps = Object.keys(deps);

    // Detect framework
    if (allDeps.some((d) => d === "next" || d.startsWith("next-"))) detected.framework = "next";
    else if (allDeps.some((d) => d === "react" || d.startsWith("react-"))) detected.framework = "react";
    else if (allDeps.some((d) => d === "vue" || d.startsWith("vue-"))) detected.framework = "vue";
    else if (allDeps.some((d) => d === "express" || d.startsWith("express-"))) detected.framework = "express";
    else if (allDeps.some((d) => d === "nest" || d.startsWith("@nestjs/"))) detected.framework = "nestjs";
    else if (allDeps.some((d) => d === "svelte" || d.startsWith("@sveltejs/"))) detected.framework = "svelte";
    else if (allDeps.includes("typescript")) detected.project_language = "typescript";

    // Detect test runner
    if (allDeps.some((d) => d.includes("vitest"))) detected.test_runner = "vitest";
    else if (allDeps.some((d) => d.includes("jest"))) detected.test_runner = "jest";
    else if (allDeps.some((d) => d.includes("mocha"))) detected.test_runner = "mocha";
    else if (allDeps.some((d) => d.includes("playwright"))) detected.test_runner = "playwright";
    else if (allDeps.some((d) => d.includes("cypress"))) detected.test_runner = "cypress";

    // Detect lint tools
    if (allDeps.some((d) => d.includes("eslint"))) detected.lint_tools.push("eslint");
    if (allDeps.some((d) => d.includes("prettier"))) detected.lint_tools.push("prettier");
    if (allDeps.some((d) => d.includes("biome"))) detected.lint_tools.push("biome");
    if (allDeps.some((d) => d.includes("stylelint"))) detected.lint_tools.push("stylelint");
  } catch {
    // ignore parse errors
  }

  // TypeScript strict mode
  const tsconfigPath = resolve(targetDir, "tsconfig.json");
  if (existsSync(tsconfigPath)) {
    detected.project_language = "typescript";
    try {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
      detected.strict_mode = tsconfig.compilerOptions?.strict === true;
    } catch {
      // ignore
    }
  }

  return detected;
}

/**
 * Collect all files that would be created/updated during init
 */
function collectPlannedFiles(
  targetDir: string,
  upgradeSkills: boolean,
  agentTargets: AgentTarget[],
): DryRunAction[] {
  const actions: DryRunAction[] = [];
  const codewrightDir = resolve(targetDir, ".codewright");
  const outputDir = resolve(targetDir, ".codewright-output");
  const agentsSkillsDir = resolve(targetDir, ".agents", "skills");
  const customDir = resolve(codewrightDir, "custom");
  const rulesDir = resolve(codewrightDir, "rules");

  // Directory .gitkeep files
  const gitkeepFiles = [
    resolve(customDir, ".gitkeep"),
    resolve(rulesDir, ".gitkeep"),
  ];
  for (const p of gitkeepFiles) {
    if (existsSync(p)) {
      actions.push({ type: "preserve", path: relative(targetDir, p), reason: "already exists" });
    } else {
      actions.push({ type: "create", path: relative(targetDir, p), reason: "gitkeep placeholder" });
    }
  }

  // rules/DEFAULT.md
  const rulesPath = resolve(rulesDir, "DEFAULT.md");
  if (existsSync(rulesPath)) {
    actions.push({ type: "preserve", path: relative(targetDir, rulesPath), reason: "already exists" });
  } else {
    actions.push({ type: "create", path: relative(targetDir, rulesPath), reason: "default project rules" });
  }

  // config.yaml
  const configPath = resolve(codewrightDir, "config.yaml");
  if (existsSync(configPath)) {
    actions.push({ type: "preserve", path: relative(targetDir, configPath), reason: "already exists" });
  } else {
    actions.push({ type: "create", path: relative(targetDir, configPath), reason: "codewright configuration" });
  }

  // config.user.yaml
  const userConfigPath = resolve(codewrightDir, "config.user.yaml");
  if (existsSync(userConfigPath)) {
    actions.push({ type: "preserve", path: relative(targetDir, userConfigPath), reason: "already exists" });
  } else {
    actions.push({ type: "create", path: relative(targetDir, userConfigPath), reason: "user config overrides" });
  }

  // AGENTS.md
  const agentsPath = resolve(targetDir, "AGENTS.md");
  if (existsSync(agentsPath)) {
    actions.push({ type: "preserve", path: "AGENTS.md", reason: "already exists" });
  } else {
    actions.push({ type: "create", path: "AGENTS.md", reason: "agent instructions" });
  }

  // Skills
  for (const skillName of SKILL_NAMES) {
    const srcSkillDir = resolve(PACKAGE_SKILLS_DIR, skillName);
    const srcSkillFile = resolve(srcSkillDir, "SKILL.md");
    const destSkillDir = resolve(agentsSkillsDir, skillName);

    if (!existsSync(srcSkillFile)) continue;
    if (existsSync(destSkillDir) && !upgradeSkills) {
      actions.push({ type: "preserve", path: relative(targetDir, destSkillDir), reason: "skill exists, not upgrading" });
      continue;
    }
    if (existsSync(destSkillDir) && upgradeSkills) {
      actions.push({ type: "update", path: relative(targetDir, destSkillDir), reason: "skill upgrade" });
    } else {
      actions.push({ type: "create", path: relative(targetDir, destSkillDir), reason: "new skill" });
    }
  }

  // Agent adapters - check what installAgentAdapters would create
  // We check the adapter destinations for each target
  for (const target of agentTargets) {
    if (target === "claude" || target === "cline") {
      for (const skillName of SKILL_NAMES) {
        const dest = resolve(targetDir, `.${target}`, "skills", skillName, "SKILL.md");
        const canonicalSkill = resolve(agentsSkillsDir, skillName, "SKILL.md");
        if (!existsSync(canonicalSkill)) continue;
        const rel = relative(targetDir, dest);
        if (existsSync(dest)) {
          const content = readFileSync(dest, "utf-8");
          if (content.includes("codewright-managed")) {
            actions.push({ type: upgradeSkills ? "update" : "preserve", path: rel, reason: upgradeSkills ? "adapter upgrade" : "managed adapter exists" });
          } else {
            actions.push({ type: "preserve", path: rel, reason: "user-managed adapter, skipped" });
          }
        } else {
          actions.push({ type: "create", path: rel, reason: `${target} adapter` });
        }
      }
    } else if (target === "cursor") {
      for (const skillName of SKILL_NAMES) {
        const dest = resolve(targetDir, ".cursor", "commands", `${skillName}.md`);
        const canonicalSkill = resolve(agentsSkillsDir, skillName, "SKILL.md");
        if (!existsSync(canonicalSkill)) continue;
        const rel = relative(targetDir, dest);
        if (existsSync(dest)) {
          const content = readFileSync(dest, "utf-8");
          if (content.includes("codewright-managed")) {
            actions.push({ type: upgradeSkills ? "update" : "preserve", path: rel, reason: upgradeSkills ? "adapter upgrade" : "managed adapter exists" });
          } else {
            actions.push({ type: "preserve", path: rel, reason: "user-managed adapter, skipped" });
          }
        } else {
          actions.push({ type: "create", path: rel, reason: `${target} adapter` });
        }
      }
    }
  }

  return actions;
}

/**
 * Format dry-run result for display
 */
function formatDryRunResult(result: DryRunResult): string {
  const lines: string[] = [];
  lines.push("\n=== Dry Run ===\n");

  const creates = result.actions.filter((a) => a.type === "create");
  const updates = result.actions.filter((a) => a.type === "update");
  const preserves = result.actions.filter((a) => a.type === "preserve");

  if (creates.length > 0) {
    lines.push("Files to CREATE:");
    for (const a of creates) lines.push(`  + ${a.path} (${a.reason})`);
    lines.push("");
  }

  if (updates.length > 0) {
    lines.push("Files to UPDATE:");
    for (const a of updates) lines.push(`  ~ ${a.path} (${a.reason})`);
    lines.push("");
  }

  if (preserves.length > 0) {
    lines.push("Files to PRESERVE (unchanged):");
    for (const a of preserves) lines.push(`  = ${a.path} (${a.reason})`);
    lines.push("");
  }

  if (result.skills.length > 0) {
    lines.push(`Skills to install: ${result.skills.length}`);
    lines.push("");
  }

  if (result.agentAdapters.length > 0) {
    lines.push("Agent adapters to install:");
    for (const a of result.agentAdapters) lines.push(`  - ${a}`);
    lines.push("");
  }

  const d = result.detected;
  const stackInfo: string[] = [];
  if (d.framework) stackInfo.push(`Framework: ${d.framework}`);
  if (d.test_runner) stackInfo.push(`Test runner: ${d.test_runner}`);
  if (d.project_language) stackInfo.push(`Language: ${d.project_language}`);
  if (stackInfo.length > 0) {
    lines.push("Detected stack:");
    for (const s of stackInfo) lines.push(`  ${s}`);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Move a file from staging to its final destination.
 * Creates backup of existing file if it exists and upgrade is allowed.
 */
function moveToFinal(
  stagingPath: string,
  finalPath: string,
  entries: StagingEntry[],
): void {
  mkdirSync(dirname(finalPath), { recursive: true });
  cpSync(stagingPath, finalPath, { recursive: true, force: true });
  entries.push({
    source: stagingPath,
    destination: finalPath,
    existedBefore: false,
  });
}

/**
 * Rollback: restore all files from their pre-init state.
 */
function rollbackChanges(entries: StagingEntry[]): void {
  for (const entry of entries.reverse()) {
    if (entry.existedBefore && entry.backupPath && existsSync(entry.backupPath)) {
      // Restore original
      mkdirSync(dirname(entry.destination), { recursive: true });
      cpSync(entry.backupPath, entry.destination, { recursive: true, force: true });
    } else if (!entry.existedBefore && existsSync(entry.destination)) {
      // Remove newly created file
      rmSync(entry.destination, { recursive: true, force: true });
    }
  }
}

/**
 * Remove staging directory
 */
function cleanupStaging(stagingDir: string): void {
  if (existsSync(stagingDir)) {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

/**
 * Create staging entry: backup existing file if needed, record the entry.
 */
function createStagingEntry(
  finalPath: string,
  stagingDir: string,
  targetDir: string,
  upgrade: boolean,
  entries: StagingEntry[],
): string {
  // Calculate relative path from target directory to final path
  const rel = relative(targetDir, finalPath);
  const stagingPath = resolve(stagingDir, rel);

  if (existsSync(finalPath)) {
    const backupPath = resolve(stagingDir, "__backups__", rel);
    mkdirSync(dirname(backupPath), { recursive: true });
    cpSync(finalPath, backupPath, { recursive: true, force: true });
    entries.push({
      source: finalPath,
      destination: finalPath,
      existedBefore: true,
      backupPath,
    });
  } else {
    entries.push({
      source: "",
      destination: finalPath,
      existedBefore: false,
    });
  }

  return stagingPath;
}

export function initCommand(cwd: string, dir?: string, options: InitOptions = {}) {
  const targetDir = dir ? resolve(cwd, dir) : cwd;
  const codewrightDir = resolve(targetDir, ".codewright");
  const outputDir = resolve(targetDir, ".codewright-output");
  const agentsSkillsDir = resolve(targetDir, ".agents", "skills");
  const customDir = resolve(codewrightDir, "custom");
  const rulesDir = resolve(codewrightDir, "rules");
  const upgradeSkills = options.upgradeSkills === true;
  const dryRun = options.dryRun === true;
  const backupRoot = resolve(
    codewrightDir,
    "skill-backups",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
  const stagingDir = resolve(codewrightDir, "staging");

  // Auto-detect project stack
  const detected = detectProjectStack(targetDir);

  // Read previous manifest to determine agent targets
  const previousManifest = readAgentManifest(targetDir);
  const agentTargets = [...new Set([...previousManifest.targets, ...(options.agents || [])])];

  // ─── Dry-run mode ──────────────────────────────────────
  if (dryRun) {
    const actions = collectPlannedFiles(targetDir, upgradeSkills, agentTargets);
    const skillNamesToInstall = SKILL_NAMES.filter((name) => {
      const srcSkillFile = resolve(PACKAGE_SKILLS_DIR, name, "SKILL.md");
      if (!existsSync(srcSkillFile)) return false;
      const destSkillDir = resolve(agentsSkillsDir, name);
      return !existsSync(destSkillDir) || upgradeSkills;
    });

    const adapterLabels: string[] = [];
    for (const target of agentTargets) {
      adapterLabels.push(target);
    }

    const result: DryRunResult = {
      actions,
      skills: skillNamesToInstall,
      agentAdapters: adapterLabels,
      detected,
    };

    console.log(formatDryRunResult(result));

    return {
      codewrightDir,
      outputDir,
      agentsSkillsDir,
      contextFile: "",
      llmsFile: "",
      manifestPath: "",
      agentTargets,
      adapterFiles: [],
      warnings: [],
      detected,
      dryRun: result,
    };
  }

  // ─── Atomic installation ───────────────────────────────
  const stagingEntries: StagingEntry[] = [];
  let operationSucceeded = false;

  try {
    // 1. Create staging directory
    cleanupStaging(stagingDir);
    mkdirSync(stagingDir, { recursive: true });

    // 2. Ensure target directories exist
    for (const d of [codewrightDir, outputDir, agentsSkillsDir, customDir, rulesDir]) {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    }

    // 3. Create .gitkeep in custom/
    const gitkeepPath = resolve(customDir, ".gitkeep");
    if (!existsSync(gitkeepPath)) {
      const stagingPath = createStagingEntry(gitkeepPath, stagingDir, targetDir, upgradeSkills, stagingEntries);
      mkdirSync(dirname(stagingPath), { recursive: true });
      writeFileSync(stagingPath, "", "utf-8");
    }

    // 4. Create .gitkeep in rules/
    const rulesGitkeep = resolve(rulesDir, ".gitkeep");
    if (!existsSync(rulesGitkeep)) {
      const stagingPath = createStagingEntry(rulesGitkeep, stagingDir, targetDir, upgradeSkills, stagingEntries);
      mkdirSync(dirname(stagingPath), { recursive: true });
      writeFileSync(stagingPath, "", "utf-8");
    }

    // 5. Create default rules file
    const rulesPath = resolve(rulesDir, "DEFAULT.md");
    if (!existsSync(rulesPath)) {
      const stagingPath = createStagingEntry(rulesPath, stagingDir, targetDir, upgradeSkills, stagingEntries);
      const rules = `# Project Rules

Add your project-specific rules here. These rules are loaded by codewright skills.

## Code Style
- Use consistent naming conventions
- Follow existing patterns in the codebase
- Write self-documenting code

## Testing
- Write tests for new features
- Keep tests focused and isolated
- Test edge cases

## Documentation
- Update docs when changing public APIs
- Use JSDoc/TSDoc for functions
- Keep README current
`;
      mkdirSync(dirname(stagingPath), { recursive: true });
      writeFileSync(stagingPath, rules, "utf-8");
    }

    // 6. Create config.yaml with detected values
    const configPath = resolve(codewrightDir, "config.yaml");
    if (!existsSync(configPath)) {
      const stagingPath = createStagingEntry(configPath, stagingDir, targetDir, upgradeSkills, stagingEntries);
      const config = loadConfig(targetDir);
      const framework = detected.framework ? `\nframework: "${detected.framework}"` : "";
      const testRunner = detected.test_runner ? `\ntest_runner: "${detected.test_runner}"` : "";
      const lintTools = detected.lint_tools.length > 0
        ? `\nlint_tools: [${detected.lint_tools.map((t) => `"${t}"`).join(", ")}]`
        : "";
      const lang = detected.project_language ? `\nproject_language: "${detected.project_language}"` : "";
      const strict = detected.strict_mode !== undefined ? `\nstrict_mode: ${detected.strict_mode}` : "";

      const yaml = `codewright_version: "${config.codewright_version}"
project_name: "${resolve(targetDir).split("/").pop() || "my-project"}"
stack: "${detected.framework || "node"}"
communication_language: "en"
output_folder: ".codewright-output"
context_file: ".codewright-output/project-context.md"${framework}${testRunner}${lintTools}${lang}${strict}
`;
      mkdirSync(dirname(stagingPath), { recursive: true });
      writeFileSync(stagingPath, yaml, "utf-8");
    }

    // 7. Create config.user.yaml (overrides, gitignored)
    const userConfigPath = resolve(codewrightDir, "config.user.yaml");
    if (!existsSync(userConfigPath)) {
      const stagingPath = createStagingEntry(userConfigPath, stagingDir, targetDir, upgradeSkills, stagingEntries);
      const userYaml = `# User config overrides — not committed to git
# Add this line to .gitignore: .codewright/config.user.yaml
# Settings here override .codewright/config.yaml
#
# Example:
# communication_language: "en"
# project_name: "my-project-override"
`;
      mkdirSync(dirname(stagingPath), { recursive: true });
      writeFileSync(stagingPath, userYaml, "utf-8");
    }

    // 8. Install managed root rules for AGENTS.md and native agent files
    const agentsTemplate = `# Codewright Agent Instructions

This project uses Codewright for assisted development.

## Flow

Invocation syntax varies by agent (for example \`$name\`, \`/name\`, or \`@name\`). The canonical skill identifiers are:

1. Idea → use \`codewright-spec\`
2. Spec ready → use \`codewright-architecture\`
3. Architecture ready → use \`codewright-story\`
4. Before implementing → use \`codewright-readiness\`
5. Story ready → use \`codewright-dev\`
6. Implemented → use \`codewright-review\`
7. Reviewed → use \`codewright-commit\`

## Rules

- Every implementation starts with an approved spec
- Every story has an I/O Matrix with edge cases
- Tasks are only complete with passing tests
- Never implement outside the task scope
- Load all applicable files in \`.codewright/rules/\` before Codewright work
- Never expose environment-variable values or push without explicit approval
`;

    const rootRuleResults = installManagedRootRules({
      targetDir,
      targets: agentTargets,
      agentsTemplate,
    });

    // 9. Install skills - copy to staging first, then validate, then move
    // We do skill installation via the existing function since it handles upgrades/backups
    // But we wrap it to enable rollback
    installSkillsAtomic(agentsSkillsDir, upgradeSkills, backupRoot, stagingDir, stagingEntries);

    // 10. Move all staged files to their final destinations
    for (const entry of stagingEntries) {
      if (entry.source === "") {
        // This is a new file - copy from staging to final destination
        const stagingPath = resolve(stagingDir, relative(targetDir, entry.destination));
        if (existsSync(stagingPath)) {
          mkdirSync(dirname(entry.destination), { recursive: true });
          cpSync(stagingPath, entry.destination, { recursive: true, force: true });
        }
      }
    }

    // 11. Write manifest LAST (after all files are in place)
    // We do the adapter installation now
    const adapterResult = installAgentAdapters({
      targetDir,
      targets: agentTargets,
      skillNames: SKILL_NAMES,
      upgrade: upgradeSkills,
      backupRoot,
    });

    // 11. Check for git ignored agent directories and warn
    const ignoredWarnings: string[] = [];
    for (const target of agentTargets) {
      const adapterDir = resolve(targetDir, `.${target}`);
      if (existsSync(adapterDir) && isPathGitignored(adapterDir, targetDir)) {
        ignoredWarnings.push(
          `${target} adapters were installed locally but are ignored by Git (.gitignore). Other clones will not receive them.`
        );
      }
    }
    adapterResult.warnings.push(...ignoredWarnings);

    // 12. Auto-generate project context (only after files are in place)
    const contextResult = contextGenerateCommand(targetDir);
    const llmsResult = contextLlmsCommand(targetDir);

    // 12. Write agent manifest LAST
    const manifestPath = writeAgentManifest(targetDir, agentTargets);

    // Validate: check that all staged files were written
    for (const entry of stagingEntries) {
      if (!entry.existedBefore && entry.destination && !existsSync(entry.destination)) {
        throw new Error(`Staged file missing after move: ${entry.destination}`);
      }
    }

    operationSucceeded = true;

    // Cleanup staging directory on success
    cleanupStaging(stagingDir);

    return {
      codewrightDir,
      outputDir,
      agentsSkillsDir,
      contextFile: contextResult.path,
      llmsFile: llmsResult.path,
      manifestPath,
      agentTargets,
      adapterFiles: adapterResult.installedFiles,
      warnings: adapterResult.warnings,
      detected,
    };
  } catch (error) {
    // Rollback on failure
    if (!operationSucceeded) {
      rollbackChanges(stagingEntries);
      cleanupStaging(stagingDir);
    }
    throw error;
  }
}

/**
 * Install skills atomically: write to staging first, then move to final.
 */
function installSkillsAtomic(
  agentsSkillsDir: string,
  upgrade: boolean,
  backupRoot: string,
  stagingDir: string,
  stagingEntries: StagingEntry[],
): void {
  for (const skillName of SKILL_NAMES) {
    const srcSkillDir = resolve(PACKAGE_SKILLS_DIR, skillName);
    const srcSkillFile = resolve(srcSkillDir, "SKILL.md");
    const destSkillDir = resolve(agentsSkillsDir, skillName);

    if (!existsSync(srcSkillFile)) continue;
    if (existsSync(destSkillDir) && !upgrade) continue;

    // Backup existing if upgrading
    if (existsSync(destSkillDir) && upgrade) {
      const backupDir = resolve(backupRoot, skillName);
      mkdirSync(backupDir, { recursive: true });
      cpSync(destSkillDir, backupDir, { recursive: true, force: true });
    }

    // Write to staging first
    const stagingSkillDir = resolve(stagingDir, "skills", skillName);
    mkdirSync(stagingSkillDir, { recursive: true });

    const entries = readdirSync(srcSkillDir);
    for (const entry of entries) {
      const src = resolve(srcSkillDir, entry);
      const dest = resolve(stagingSkillDir, entry);
      cpSync(src, dest, { recursive: true, force: true });
    }

    // Validate staging
    for (const entry of entries) {
      const staged = resolve(stagingSkillDir, entry);
      if (!existsSync(staged)) {
        throw new Error(`Staging validation failed: ${staged} not found`);
      }
    }

    // Move from staging to final
    if (!existsSync(destSkillDir)) mkdirSync(destSkillDir, { recursive: true });

    for (const entry of entries) {
      const src = resolve(stagingSkillDir, entry);
      const dest = resolve(destSkillDir, entry);
      // Record backup entry for rollback
      const rel = relative(destSkillDir, dest);
      const backupPath = resolve(stagingDir, "__backups__", "skills", skillName, rel);
      mkdirSync(dirname(backupPath), { recursive: true });
      if (existsSync(dest)) {
        cpSync(dest, backupPath, { recursive: true, force: true });
        stagingEntries.push({
          source: dest,
          destination: dest,
          existedBefore: true,
          backupPath,
        });
      } else {
        stagingEntries.push({
          source: "",
          destination: dest,
          existedBefore: false,
        });
      }
      // Copy from staging to final
      cpSync(src, dest, { recursive: true, force: true });
    }
  }
}
