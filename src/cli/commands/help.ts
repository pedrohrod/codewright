import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";

interface SkillInfo {
  name: string;
  description: string;
  phase: string;
}

const PHASE_DISPLAY: Record<string, string> = {
  planning: "Planning",
  preparation: "Preparation",
  implementation: "Implementation",
  review: "Review",
  operations: "Operations",
  retrospective: "Retrospective",
};
const PHASE_ORDER = ["planning", "preparation", "implementation", "review", "operations", "retrospective"];
const SKILL_PHASES: Record<string, string> = {
  "codewright-init": "planning", "codewright-spec": "planning", "codewright-architecture": "planning",
  "codewright-epic": "planning", "codewright-story": "preparation", "codewright-readiness": "preparation",
  "codewright-dev": "implementation", "codewright-develop": "implementation", "codewright-quick-dev": "implementation",
  "codewright-test": "implementation", "codewright-testgen": "implementation", "codewright-quality": "implementation",
  "codewright-refactor": "implementation", "codewright-review": "review", "codewright-commit": "review",
  "codewright-context": "operations", "codewright-document": "operations", "codewright-rules": "operations",
  "codewright-hook": "operations", "codewright-ci": "operations", "codewright-deps": "operations",
  "codewright-env": "operations", "codewright-deploy": "operations", "codewright-perf": "operations",
  "codewright-retrospective": "retrospective",
};

function parseSkill(filePath: string, folderName: string): SkillInfo {
  try {
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    const frontmatter = match ? (load(match[1]) as Record<string, unknown>) : {};
    const name = typeof frontmatter?.name === "string" ? frontmatter.name : folderName;
    return {
      name,
      description: typeof frontmatter?.description === "string" ? frontmatter.description : "",
      phase: SKILL_PHASES[name] || "operations",
    };
  } catch {
    return { name: folderName, description: "", phase: SKILL_PHASES[folderName] || "operations" };
  }
}

function getAllSkills(cwd: string): SkillInfo[] {
  const installed = resolve(cwd, ".agents", "skills");
  const bundled = resolve(cwd, "skills");
  const skillsDir = existsSync(installed) ? installed : bundled;
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(resolve(skillsDir, entry.name, "SKILL.md")))
    .map((entry) => parseSkill(resolve(skillsDir, entry.name, "SKILL.md"), entry.name));
}

function aliases(name: string): string[] {
  const short = name.replace(/^codewright-/, "");
  return [name, short, `codewright:${short}`, `codewright ${short}`];
}

function findSkill(skills: SkillInfo[], query: string): SkillInfo | undefined {
  const normalized = query.trim().toLowerCase();
  return skills.find((skill) => aliases(skill.name).includes(normalized));
}

export function helpCommand(cwd: string, skillName?: string, phaseFilter?: string, next?: string): string {
  const skills = getAllSkills(cwd);
  if (skills.length === 0) return "No skills found. Run codewright init first.";

  if (skillName) {
    const skill = findSkill(skills, skillName);
    if (!skill) return `Skill '${skillName}' not found. Use codewright help to list all skills.`;
    const nextPhase = PHASE_ORDER[PHASE_ORDER.indexOf(skill.phase) + 1];
    const nextSkills = nextPhase ? skills.filter((candidate) => candidate.phase === nextPhase).slice(0, 3) : [];
    const lines = [`## ${skill.name}`, skill.description, "", `Phase: ${PHASE_DISPLAY[skill.phase] || skill.phase}`];
    if (nextSkills.length > 0) {
      lines.push("", `Next steps (${PHASE_DISPLAY[nextPhase]}):`);
      lines.push(...nextSkills.map((candidate) => `  - ${candidate.name}: ${candidate.description}`));
    }
    return lines.join("\n");
  }

  if (next) {
    const skill = findSkill(skills, next);
    if (!skill) return `Skill '${next}' not found.`;
    const nextPhase = PHASE_ORDER[PHASE_ORDER.indexOf(skill.phase) + 1];
    if (!nextPhase) return `No next steps for '${skill.name}'.`;
    return [`After ${skill.name}, consider:`,
      ...skills.filter((candidate) => candidate.phase === nextPhase).slice(0, 5)
        .map((candidate) => `  - ${candidate.name}: ${candidate.description}`),
    ].join("\n");
  }

  const phases = phaseFilter ? [phaseFilter.toLowerCase()] : PHASE_ORDER;
  const lines = ["## Codewright Skills", ""];
  for (const phaseName of phases) {
    const phaseSkills = skills.filter((skill) => skill.phase === phaseName);
    if (phaseSkills.length === 0) continue;
    lines.push(`### ${PHASE_DISPLAY[phaseName] || phaseName}`);
    lines.push(...phaseSkills.map((skill) => `  - ${skill.name}: ${skill.description}`), "");
  }
  lines.push("Usage:", "  codewright help <skill>", "  codewright help --next <skill>", "  codewright help --phase <phase>");
  return lines.join("\n");
}
