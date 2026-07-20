import { existsSync, mkdirSync, writeFileSync, cpSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../config/loader.js";
import { contextGenerateCommand } from "./context.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Skills directory inside the installed package: skills/<name>/SKILL.md
const PACKAGE_SKILLS_DIR = resolve(__dirname, "../../skills");

const SKILL_NAMES = [
  "codewright-init",
  "codewright-spec",
  "codewright-architecture",
  "codewright-story",
  "codewright-dev",
  "codewright-review",
];

export function initCommand(cwd: string, dir?: string) {
  const targetDir = dir ? resolve(cwd, dir) : cwd;
  const codewrightDir = resolve(targetDir, ".codewright");
  const outputDir = resolve(targetDir, ".codewright-output");
  const agentsSkillsDir = resolve(targetDir, ".agents", "skills");

  // Create .codewright and .codewright-output directories
  for (const d of [codewrightDir, outputDir, agentsSkillsDir]) {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  }

  // Create config.yaml
  const configPath = resolve(codewrightDir, "config.yaml");
  if (!existsSync(configPath)) {
    const config = loadConfig(cwd);
    const yaml = `codewright_version: "${config.codewright_version}"
project_name: "${resolve(targetDir).split("/").pop() || "my-project"}"
stack: "node"
communication_language: "en"
output_folder: ".codewright-output"
context_file: ".codewright-output/project-context.md"
`;
    writeFileSync(configPath, yaml, "utf-8");
  }

  // Create AGENTS.md (English)
  const agentsPath = resolve(codewrightDir, "AGENTS.md");
  if (!existsSync(agentsPath)) {
    const agents = `# Codewright Agent Instructions

This project uses Codewright for assisted development.

## Flow

1. Idea → run \`codewright:spec\`
2. Spec ready → run \`codewright:architecture\`
3. Architecture ready → run \`codewright:story\`
4. Story ready → run \`codewright:dev\`
5. Implemented → run \`codewright:review\`

## Rules

- Every implementation starts with an approved spec
- Every story has an I/O Matrix with edge cases
- Tasks are only complete with passing tests
- Never implement outside the task scope
`;
    writeFileSync(agentsPath, agents, "utf-8");
  }

  // Install skills into .agents/skills/
  installSkills(agentsSkillsDir);

  // Auto-generate project context
  const contextResult = contextGenerateCommand(cwd);

  return { codewrightDir, outputDir, agentsSkillsDir, contextFile: contextResult.path };
}

function installSkills(agentsSkillsDir: string) {
  for (const skillName of SKILL_NAMES) {
    const srcSkillDir = resolve(PACKAGE_SKILLS_DIR, skillName);
    const srcSkillFile = resolve(srcSkillDir, "SKILL.md");
    const destSkillDir = resolve(agentsSkillsDir, skillName);

    if (!existsSync(srcSkillFile)) continue;
    if (!existsSync(destSkillDir)) mkdirSync(destSkillDir, { recursive: true });

    const entries = readdirSync(srcSkillDir);
    for (const entry of entries) {
      const src = resolve(srcSkillDir, entry);
      const dest = resolve(destSkillDir, entry);
      cpSync(src, dest, { recursive: true, force: true });
    }
  }
}
