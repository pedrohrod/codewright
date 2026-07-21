#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initCommand } from "./commands/init.js";
import { specCreateCommand, specUpdateCommand, specHistoryCommand, specDiffCommand, specVersionCommand, specSyncCommand } from "./commands/spec.js";
import { storyCreateCommand, storyListCommand } from "./commands/story.js";
import { contextGenerateCommand, contextLlmsCommand } from "./commands/context.js";
import { devStartCommand, reviewPrepareCommand } from "./commands/review.js";
import { hookInstallCommand, hookListCommand } from "./commands/hook.js";
import { ciGenerateCommand } from "./commands/ci.js";
import { depsCheckCommand } from "./commands/deps.js";
import { testGenFromSpecCommand } from "./commands/testgen.js";
import { envSetupCommand, envListCommand } from "./commands/env.js";
import { deployDockerfileCommand, deployDockerignoreCommand } from "./commands/deploy.js";
import { perfSetupCommand, perfRunCommand } from "./commands/perf.js";
import { helpCommand } from "./commands/help.js";
import { statusCommand } from "./commands/status.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf-8"));
    return pkg.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

const program = new Command();

program
  .name("codewright")
  .description("AI-assisted specification and implementation system")
  .version(getVersion());

// ─── init ───────────────────────────────────────────────
program
  .command("init")
  .description("Initialize codewright in the project")
  .option("--dir <path>", "Target directory", ".")
  .action((opts) => {
    const result = initCommand(process.cwd(), opts.dir);
    console.log(`✓ Codewright initialized at ${result.codewrightDir}`);
    console.log(`  Output: ${result.outputDir}`);
    console.log(`  Skills: .agents/skills/`);
    const d = result.detected;
    if (d.framework) console.log(`  Framework: ${d.framework}`);
    if (d.test_runner) console.log(`  Test runner: ${d.test_runner}`);
    if (d.project_language) console.log(`  Language: ${d.project_language}`);
  });

// ─── spec ───────────────────────────────────────────────
program
  .command("spec")
  .description("Create or update a specification")
  .argument("[slug]", "Spec slug (create if new, update if exists)")
  .option("--update", "Re-derive SPEC.md from memlog")
  .option("--input <path>", "Seed spec from a file")
  .option("--history", "View spec version history")
  .option("--diff [from] [to]", "Diff between spec versions")
  .option("--snapshot", "Create a new version snapshot")
  .option("--sync", "Sync spec with code (compare requirements vs implementation)")
  .action((slug: string, opts) => {
    if (!slug) {
      console.log("Usage: codewright spec <slug>");
      console.log("       codewright spec <slug> --update");
      console.log("       codewright spec <slug> --history");
      console.log("       codewright spec <slug> --diff [from] [to]");
      console.log("       codewright spec <slug> --snapshot");
      console.log("       codewright spec <slug> --sync");
      return;
    }
    if (opts.update) {
      const result = specUpdateCommand(process.cwd(), slug);
      console.log(`✓ Spec updated at ${result.specDir}`);
    } else if (opts.history) {
      const result = specHistoryCommand(process.cwd(), slug);
      console.log(result);
    } else if (opts.diff) {
      const from = typeof opts.diff === 'string' ? opts.diff : undefined;
      const result = specDiffCommand(process.cwd(), slug, from);
      console.log(result);
    } else if (opts.snapshot) {
      const result = specVersionCommand(process.cwd(), slug);
      console.log(result);
    } else if (opts.sync) {
      const result = specSyncCommand(process.cwd(), slug);
      console.log(result);
    } else {
      const result = specCreateCommand({ cwd: process.cwd(), slug, input: opts.input });
      console.log(`✓ Spec created at ${result.specDir}`);
    }
  });

// ─── story ──────────────────────────────────────────────
program
  .command("story")
  .description("Create or list stories")
  .argument("[spec]", "Spec slug (if only spec given → list stories)")
  .argument("[id]", "Story ID (e.g. S001)")
  .argument("[title]", "Story title")
  .option("--phase <n>", "Phase number", "1")
  .action((spec: string, id: string, title: string, opts) => {
    if (!spec) {
      console.log("Usage: codewright story <spec>              (list stories)");
      console.log("       codewright story <spec> <id> <title> (create story)");
      return;
    }
    if (id && title) {
      // Create story
      const result = storyCreateCommand({
        cwd: process.cwd(), spec, id, title,
        phase: opts.phase,
      });
      console.log(`✓ Story created at ${result.path}`);
    } else if (spec) {
      // List stories
      const stories = storyListCommand(process.cwd(), spec);
      if (stories.length === 0) { console.log("No stories found."); return; }
      console.log("Stories:");
      for (const s of stories) console.log(`  ${s.id} | ${s.status} | ${s.title}`);
    }
  });

// ─── dev ────────────────────────────────────────────────
program
  .command("dev")
  .description("Start implementing a story")
  .argument("<spec>", "Spec slug")
  .argument("<id>", "Story ID")
  .action((spec: string, id: string) => {
    const result = devStartCommand(process.cwd(), spec, id);
    console.log(`✓ Story ${result.story} marked as in-progress`);
    console.log(`  Baseline commit: ${result.baseline_commit}`);
    console.log(`\n${result.instructions}`);
  });

// ─── review ─────────────────────────────────────────────
program
  .command("review")
  .description("Prepare review for a story")
  .argument("<spec>", "Spec slug")
  .argument("<id>", "Story ID")
  .action((spec: string, id: string) => {
    const result = reviewPrepareCommand(process.cwd(), spec, id);
    console.log(`✓ Review prepared at ${result.reviewFile}`);
    console.log(`  Baseline commit: ${result.baseline}`);
  });

// ─── context ────────────────────────────────────────────
program
  .command("context")
  .description("Generate project context files")
  .option("--llms", "Generate llms.txt for AI agents")
  .action((opts) => {
    if (opts.llms) {
      const result = contextLlmsCommand(process.cwd());
      console.log(`✓ llms.txt generated at ${result.path}`);
    } else {
      const result = contextGenerateCommand(process.cwd());
      console.log(`✓ Project context generated at ${result.path}`);
    }
  });

// ─── hook ───────────────────────────────────────────────
program
  .command("hook")
  .description("Manage git hooks for the project")
  .argument("[action]", "Action: install or list", "list")
  .action((action: string) => {
    if (action === "install") {
      const result = hookInstallCommand(process.cwd());
      console.log(result);
    } else {
      const result = hookListCommand(process.cwd());
      console.log(result);
    }
  });

// ─── ci ─────────────────────────────────────────────────
program
  .command("ci")
  .description("Generate CI workflow for the project")
  .action(() => {
    const result = ciGenerateCommand(process.cwd());
    console.log(result);
  });

// ─── deps ────────────────────────────────────────────────
program
  .command("deps")
  .description("Check project dependencies for outdated packages")
  .action(() => {
    const result = depsCheckCommand(process.cwd());
    console.log(result);
  });

// ─── test ────────────────────────────────────────────────
program
  .command("test")
  .description("Generate tests from spec stories")
  .argument("<spec>", "Spec slug")
  .argument("[story]", "Story ID (optional, generates for all if omitted)")
  .action((spec: string, story: string) => {
    const result = testGenFromSpecCommand(process.cwd(), spec, story);
    console.log(result);
  });

// ─── env ─────────────────────────────────────────────────
program
  .command("env")
  .description("Manage environment variables")
  .argument("[action]", "Action: setup or list", "list")
  .action((action: string) => {
    if (action === "setup") {
      const result = envSetupCommand(process.cwd());
      console.log(result);
    } else {
      const result = envListCommand(process.cwd());
      console.log(result);
    }
  });

// ─── deploy ──────────────────────────────────────────────
const deployCmd = program.command("deploy").description("Generate deployment configuration");
deployCmd
  .command("dockerfile")
  .description("Generate Dockerfile for the project")
  .action(() => {
    const result = deployDockerfileCommand(process.cwd());
    console.log(result);
  });
deployCmd
  .command("dockerignore")
  .description("Generate .dockerignore")
  .action(() => {
    const result = deployDockerignoreCommand(process.cwd());
    console.log(result);
  });

// ─── perf ───────────────────────────────────────────────
program
  .command("perf")
  .description("Performance testing with k6")
  .argument("[action]", "Action: setup or run", "setup")
  .argument("[tool]", "Tool: k6", "k6")
  .action((action: string, tool: string) => {
    if (action === "run") {
      const result = perfRunCommand(process.cwd(), tool);
      console.log(result);
    } else {
      const result = perfSetupCommand(process.cwd(), tool);
      console.log(result);
    }
  });

// ─── help ───────────────────────────────────────────────
program
  .command("help")
  .description("List skills by phase, get details on a skill, or find next steps")
  .argument("[skill]", "Skill name for details")
  .option("--next <skill>", "Show next steps after a skill")
  .option("--phase <phase>", "Filter by phase (ideation, planning, etc.)")
  .action((skill: string, opts) => {
    const result = helpCommand(process.cwd(), skill, opts.phase, opts.next);
    console.log(result);
  });

// ─── status ─────────────────────────────────────────────
program
  .command("status")
  .description("Show project health overview")
  .action(() => {
    const result = statusCommand(process.cwd());
    console.log(result);
  });

program.parse(process.argv);
