import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { readAgentManifest } from "../../agents/install.js";
import { getAgentDefinition } from "../../agents/registry.js";
import { loadConfig } from "../../config/loader.js";

export function statusCommand(cwd: string): string {
  const config = loadConfig(cwd);
  const lines: string[] = [];
  lines.push("## Codewright Status");
  lines.push("");

  // 1. Skills
  const skillsDir = resolve(cwd, ".agents", "skills");
  if (existsSync(skillsDir)) {
    const skills = readdirSync(skillsDir).filter((f) => {
      try {
        return readdirSync(resolve(skillsDir, f)).includes("SKILL.md");
      } catch {
        return false;
      }
    });
    lines.push("**Skills:** " + skills.length + " installed");
    lines.push("");
  } else {
    lines.push("**Skills:** not installed (run codewright init)");
    lines.push("");
  }

  const agentManifest = readAgentManifest(cwd);
  const agentLabels = agentManifest.targets.map((target) => getAgentDefinition(target).label);
  lines.push("**Agents:** " + (agentLabels.length > 0 ? agentLabels.join(", ") : "universal core only"));
  lines.push("");

  // 2. Specs
  const specsDir = resolve(cwd, config.output_folder, "specs");
  if (existsSync(specsDir)) {
    const specs = readdirSync(specsDir).filter((f) => f.startsWith("spec-"));
    if (specs.length > 0) {
      lines.push("**Specs:** " + specs.length);
      for (const spec of specs) {
        const name = spec.replace("spec-", "");
        const storiesDir = resolve(specsDir, spec, "stories");
        const stories = existsSync(storiesDir) ? readdirSync(storiesDir).length : 0;
        lines.push("  - " + name + " (" + stories + " stories)");
      }
      lines.push("");
    }
  }

  // 3. Hooks
  const hookDir = resolve(cwd, ".git", "hooks");
  if (existsSync(hookDir)) {
    const hooks = ["pre-commit", "commit-msg", "pre-push"];
    const installed = hooks.filter((h) => existsSync(resolve(hookDir, h)));
    if (installed.length > 0) {
      lines.push("**Hooks:** " + installed.join(", "));
      lines.push("");
    }
  }

  // 4. Env
  const envExists = existsSync(resolve(cwd, ".env"));
  const envExampleExists = existsSync(resolve(cwd, ".env.example"));
  lines.push("**Env:** " + (envExists ? ".env yes" : ".env no") + ", " + (envExampleExists ? ".env.example yes" : ".env.example no"));
  lines.push("");

  // 5. Context files
  const ctxPath = resolve(cwd, config.output_folder, "project-context.md");
  const llmsPath = resolve(cwd, "llms.txt");
  lines.push("**Context:** " + (existsSync(ctxPath) ? "project-context.md yes" : "project-context.md no") + ", " + (existsSync(llmsPath) ? "llms.txt yes" : "llms.txt no"));
  lines.push("");

  // 6. Git
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8" }).trim();
    const gitStatus = execSync("git status --porcelain", { cwd, encoding: "utf-8" }).trim();
    const changes = gitStatus ? gitStatus.split("\n").length : 0;
    lines.push("**Git:** branch " + branch + ", " + changes + " uncommitted changes");
  } catch {
    lines.push("**Git:** not a git repository");
  }

  return lines.join("\n");
}
