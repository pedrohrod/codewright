import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

interface SkillInfo {
  name: string;
  description: string;
  phase: string;
  commands: string[];
  depends_on: string[];
}

const PHASE_DISPLAY: Record<string, string> = {
  ideation: "💡 Ideation",
  planning: "📋 Planning",
  preparation: "🔧 Preparation",
  implementation: "⚙️ Implementation",
  review: "👀 Review",
  operations: "🔁 Operations",
  retrospective: "📊 Retrospective",
};

const PHASE_ORDER = ["ideation", "planning", "preparation", "implementation", "review", "operations", "retrospective"];

function parseSkillFrontmatter(filePath: string, skillName: string): SkillInfo {
  try {
    const content = readFileSync(filePath, "utf-8");
    const nameMatch = content.match(/^name:\s*(.+)/m);
    const descMatch = content.match(/^description:\s*(.+)/m);
    const phaseMatch = content.match(/^phase:\s*(.+)/m);

    return {
      name: nameMatch?.[1]?.trim() || skillName,
      description: descMatch?.[1]?.trim()?.replace(/^"/, "").replace(/"$/, "") || "",
      phase: phaseMatch?.[1]?.trim() || "operations",
      commands: [],
      depends_on: [],
    };
  } catch {
    return { name: skillName, description: "", phase: "operations", commands: [], depends_on: [] };
  }
}

function getAllSkills(cwd: string): SkillInfo[] {
  const agentsSkills = resolve(cwd, ".agents", "skills");
  const packageSkills = resolve(cwd, "skills");

  const skillsDir = existsSync(agentsSkills) ? agentsSkills : packageSkills;

  if (!existsSync(skillsDir)) return [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  const skills: SkillInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = resolve(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillFile)) continue;

    skills.push(parseSkillFrontmatter(skillFile, entry.name));
  }

  return skills;
}

export function helpCommand(cwd: string, skillName?: string, phase?: string, next?: string): string {
  const skills = getAllSkills(cwd);

  if (skills.length === 0) {
    return "No skills found. Run `codewright init` first.";
  }

  // Help for a specific skill
  if (skillName) {
    const skill = skills.find((s) => s.name === skillName || s.name.replace("codewright:", "") === skillName);
    if (!skill) return `Skill '${skillName}' not found. Use 'codewright help' to list all skills.`;

    let help = `## ${skill.name}\n`;
    help += `${skill.description}\n\n`;
    help += `**Phase:** ${PHASE_DISPLAY[skill.phase] || skill.phase}\n`;

    // Show next steps
    const phaseIdx = PHASE_ORDER.indexOf(skill.phase);
    if (phaseIdx >= 0 && phaseIdx < PHASE_ORDER.length - 1) {
      const nextPhase = PHASE_ORDER[phaseIdx + 1];
      const nextSkills = skills.filter((s) => s.phase === nextPhase);
      if (nextSkills.length > 0) {
        help += `\n**Next steps (${PHASE_DISPLAY[nextPhase]}):**\n`;
        for (const ns of nextSkills.slice(0, 3)) {
          help += `  - ${ns.name}: ${ns.description}\n`;
        }
      }
    }

    return help;
  }

  // Next steps for a skill
  if (next) {
    const skill = skills.find((s) => s.name.includes(next));
    if (!skill) return `Skill '${next}' not found.`;

    const phaseIdx = PHASE_ORDER.indexOf(skill.phase);
    if (phaseIdx < 0 || phaseIdx >= PHASE_ORDER.length - 1) {
      return `No next steps for '${skill.name}' (last phase).`;
    }

    const nextPhase = PHASE_ORDER[phaseIdx + 1];
    const nextSkills = skills.filter((s) => s.phase === nextPhase);

    let result = `After ${skill.name}, you can run:\n`;
    for (const ns of nextSkills.slice(0, 5)) {
      result += `  - ${ns.name}: ${ns.description}\n`;
    }
    return result;
  }

  // List by phase
  let result = "## Codewright Skills\n\n";

  for (const phase of PHASE_ORDER) {
    const phaseSkills = skills.filter((s) => s.phase === phase);

    if (phase && phaseSkills.length === 0) continue;

    const phaseLabel = PHASE_DISPLAY[phase] || phase;

    if (!phase) {
      // Skills without phase
      for (const s of phaseSkills) {
        result += `  - ${s.name}: ${s.description}\n`;
      }
      continue;
    }

    result += `### ${phaseLabel}\n`;

    const filtered = phase && phaseSkills.length > 0
      ? phaseSkills
      : skills.filter((s) => s.phase === phase);

    for (const s of filtered) {
      result += `  - ${s.name}: ${s.description}\n`;
    }
    result += "\n";
  }

  // Usage tips
  result += `**Usage:**\n`;
  result += `  codewright help <skill>      # Details and next steps\n`;
  result += `  codewright help --next <skill> # What to do after this skill\n`;

  return result;
}
