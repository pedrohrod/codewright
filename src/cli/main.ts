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

program
  .command("init")
  .description("Initialize codewright structure in the project")
  .option("--dir <path>", "Target directory", ".")
  .action((opts) => {
    const result = initCommand(process.cwd(), opts.dir);
    console.log(`✓ Codewright initialized at ${result.codewrightDir}`);
    console.log(`  Output directory: ${result.outputDir}`);
  });

const specCmd = program.command("spec").description("Manage specifications");
specCmd
  .command("create")
  .description("Create a new specification")
  .requiredOption("--slug <slug>", "Specification slug")
  .option("--input <path>", "Input file path")
  .action((opts) => {
    const result = specCreateCommand({ cwd: process.cwd(), slug: opts.slug, input: opts.input });
    console.log(`✓ Spec created at ${result.specDir}`);
  });
specCmd
  .command("update")
  .description("Update specification from memlog")
  .requiredOption("--slug <slug>", "Specification slug")
  .action((opts) => {
    const result = specUpdateCommand(process.cwd(), opts.slug);
    console.log(`✓ Spec updated at ${result.specDir}`);
  });

const storyCmd = program.command("story").description("Manage stories");
storyCmd
  .command("create")
  .description("Create a new story")
  .requiredOption("--spec <spec>", "Spec slug")
  .requiredOption("--id <id>", "Story ID (e.g., S001)")
  .requiredOption("--title <title>", "Story title")
  .option("--phase <phase>", "Phase number", "1")
  .action((opts) => {
    const result = storyCreateCommand({
      cwd: process.cwd(), spec: opts.spec, id: opts.id,
      title: opts.title, phase: opts.phase,
    });
    console.log(`✓ Story created at ${result.path}`);
  });
storyCmd
  .command("list")
  .description("List stories of a spec")
  .requiredOption("--spec <spec>", "Spec slug")
  .action((opts) => {
    const stories = storyListCommand(process.cwd(), opts.spec);
    if (stories.length === 0) { console.log("No stories found."); return; }
    console.log("Stories:");
    for (const s of stories) console.log(`  ${s.id} | ${s.status} | ${s.title}`);
  });

program
  .command("context")
  .description("Generate project context")
  .command("generate")
  .description("Scan project and generate context file")
  .action(() => {
    const result = contextGenerateCommand(process.cwd());
    console.log(`✓ Project context generated at ${result.path}`);
  });

const devCmd = program.command("dev").description("Development commands");
devCmd
  .command("start")
  .description("Start implementing a story")
  .requiredOption("--spec <spec>", "Spec slug")
  .requiredOption("--story <id>", "Story ID")
  .action((opts) => {
    const result = devStartCommand(process.cwd(), opts.spec, opts.story);
    console.log(`✓ Story ${result.story} marked as in-progress`);
    console.log(`  Baseline commit: ${result.baseline_commit}`);
    console.log(`\n${result.instructions}`);
  });

const reviewCmd = program.command("review").description("Review commands");
reviewCmd
  .command("prepare")
  .description("Prepare review for a story")
  .requiredOption("--spec <spec>", "Spec slug")
  .requiredOption("--story <id>", "Story ID")
  .action((opts) => {
    const result = reviewPrepareCommand(process.cwd(), opts.spec, opts.story);
    console.log(`✓ Review prepared at ${result.reviewFile}`);
    console.log(`  Baseline commit: ${result.baseline}`);
  });

program.parse(process.argv);
