import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/loader.js";
import { installAgentAdapters, readAgentManifest, writeAgentManifest } from "../../agents/install.js";
import type { AgentTarget } from "../../agents/registry.js";
import { contextGenerateCommand, contextLlmsCommand } from "./context.js";

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
}

interface DetectedStack {
  framework?: string;
  test_runner?: string;
  lint_tools: string[];
  project_language?: string;
  strict_mode?: boolean;
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

export function initCommand(cwd: string, dir?: string, options: InitOptions = {}) {
  const targetDir = dir ? resolve(cwd, dir) : cwd;
  const codewrightDir = resolve(targetDir, ".codewright");
  const outputDir = resolve(targetDir, ".codewright-output");
  const agentsSkillsDir = resolve(targetDir, ".agents", "skills");
  const customDir = resolve(codewrightDir, "custom");
  const rulesDir = resolve(codewrightDir, "rules");
  const upgradeSkills = options.upgradeSkills === true;
  const backupRoot = resolve(
    codewrightDir,
    "skill-backups",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );

  // Create directories
  for (const d of [codewrightDir, outputDir, agentsSkillsDir, customDir, rulesDir]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }

  // Auto-detect project stack
  const detected = detectProjectStack(targetDir);

  // Create .gitkeep in custom/
  const gitkeepPath = resolve(customDir, ".gitkeep");
  if (!existsSync(gitkeepPath)) writeFileSync(gitkeepPath, "", "utf-8");

  // Create .gitkeep in rules/
  const rulesGitkeep = resolve(rulesDir, ".gitkeep");
  if (!existsSync(rulesGitkeep)) writeFileSync(rulesGitkeep, "", "utf-8");

  // Create default rules file
  const rulesPath = resolve(rulesDir, "DEFAULT.md");
  if (!existsSync(rulesPath)) {
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
    writeFileSync(rulesPath, rules, "utf-8");
  }

  // Create config.yaml with detected values
  const configPath = resolve(codewrightDir, "config.yaml");
  if (!existsSync(configPath)) {
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
    writeFileSync(configPath, yaml, "utf-8");
  }

  // Create config.user.yaml (overrides, gitignored)
  const userConfigPath = resolve(codewrightDir, "config.user.yaml");
  if (!existsSync(userConfigPath)) {
    const userYaml = `# User config overrides — not committed to git
# Add this line to .gitignore: .codewright/config.user.yaml
# Settings here override .codewright/config.yaml
#
# Example:
# communication_language: "en"
# project_name: "my-project-override"
`;
    writeFileSync(userConfigPath, userYaml, "utf-8");
  }

  // Create discoverable root AGENTS.md only when the project has none.
  const agentsPath = resolve(targetDir, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    const agents = `# Codewright Agent Instructions

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
    writeFileSync(agentsPath, agents, "utf-8");
  }

  // Install skills into .agents/skills/
  installSkills(agentsSkillsDir, upgradeSkills, backupRoot);

  // Persist target selection without silently removing adapters from earlier runs.
  const previousManifest = readAgentManifest(targetDir);
  const agentTargets = [...new Set([...previousManifest.targets, ...(options.agents || [])])];
  const manifestPath = writeAgentManifest(targetDir, agentTargets);
  const adapterResult = installAgentAdapters({
    targetDir,
    targets: agentTargets,
    skillNames: SKILL_NAMES,
    upgrade: upgradeSkills,
    backupRoot,
  });

  // Auto-generate project context
  const contextResult = contextGenerateCommand(targetDir);
  const llmsResult = contextLlmsCommand(targetDir);

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
}

function installSkills(agentsSkillsDir: string, upgrade: boolean, backupRoot: string) {
  for (const skillName of SKILL_NAMES) {
    const srcSkillDir = resolve(PACKAGE_SKILLS_DIR, skillName);
    const srcSkillFile = resolve(srcSkillDir, "SKILL.md");
    const destSkillDir = resolve(agentsSkillsDir, skillName);

    if (!existsSync(srcSkillFile)) continue;
    if (existsSync(destSkillDir) && !upgrade) continue;
    if (existsSync(destSkillDir) && upgrade) {
      const backupDir = resolve(backupRoot, skillName);
      mkdirSync(backupDir, { recursive: true });
      cpSync(destSkillDir, backupDir, { recursive: true, force: true });
    }
    if (!existsSync(destSkillDir)) mkdirSync(destSkillDir, { recursive: true });

    const entries = readdirSync(srcSkillDir);
    for (const entry of entries) {
      const src = resolve(srcSkillDir, entry);
      const dest = resolve(destSkillDir, entry);
      cpSync(src, dest, { recursive: true, force: true });
    }
  }
}
