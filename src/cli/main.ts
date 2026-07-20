#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initCommand } from "./commands/init.js";
import { specCreateCommand, specUpdateCommand } from "./commands/spec.js";
import { storyCreateCommand, storyListCommand } from "./commands/story.js";
import { contextGenerateCommand } from "./commands/context.js";
import { devStartCommand, reviewPrepareCommand } from "./commands/review.js";

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
  .action((slug: string, opts) => {
    if (!slug) {
      console.log("Usage: codewright spec <slug>");
      console.log("       codewright spec <slug> --update");
      return;
    }
    if (opts.update) {
      const result = specUpdateCommand(process.cwd(), slug);
      console.log(`✓ Spec updated at ${result.specDir}`);
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
  .description("Generate project context")
  .action(() => {
    const result = contextGenerateCommand(process.cwd());
    console.log(`✓ Project context generated at ${result.path}`);
  });

program.parse(process.argv);
