#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import {
  formatAgentMenu,
  getAgentDefinition,
  parseAgentTargets,
  parseInteractiveAgentSelection,
  type AgentTarget,
} from "../agents/registry.js";
import { initCommand } from "./commands/init.js";
import { specCreateCommand, specUpdateCommand, specHistoryCommand, specDiffCommand, specVersionCommand, specSyncCommand } from "./commands/spec.js";
import { storyCreateCommand, storyListCommand } from "./commands/story.js";
import { contextGenerateCommand, contextLlmsCommand } from "./commands/context.js";
import { devStartCommand, reviewPrepareCommand } from "./commands/review.js";
import { commitCommand } from "./commands/commit.js";
import { hookInstallCommand, hookListCommand, hookUninstallCommand } from "./commands/hook.js";
import { ciGenerateCommand } from "./commands/ci.js";
import { depsCheckCommand } from "./commands/deps.js";
import { testGenFromSpecCommand } from "./commands/testgen.js";
import { envSetupCommand, envListCommand } from "./commands/env.js";
import { deployDockerfileCommand, deployDockerignoreCommand } from "./commands/deploy.js";
import { perfInitCommand, perfValidateCommand, perfRunCommand, perfReportCommand, perfCleanupCommand } from "./commands/perf/index.js";
import { helpCommand } from "./commands/help.js";
import { statusCommand } from "./commands/status.js";
import { doctorCommandFormatted } from "./commands/doctor.js";
import {
  agentsListFormatted,
  agentsAddFormatted,
  agentsRemoveFormatted,
  agentsSetFormatted,
  agentsRepairFormatted,
  agentsDoctorFormatted,
} from "./commands/agents.js";
import {
  graphStatusCommand,
  graphUpdateCommand,
  graphQueryCommand,
  graphExplainCommand,
  graphAffectedCommand,
  graphPathCommand,
} from "./commands/graph.js";

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

async function selectAgentTargets(option?: string): Promise<AgentTarget[]> {
  if (option !== undefined) return parseAgentTargets(option);
  if (!process.stdin.isTTY || !process.stdout.isTTY) return [];

  console.log(formatAgentMenu());
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question("> ");
    return parseInteractiveAgentSelection(answer);
  } finally {
    prompt.close();
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
  .option("--agents <targets>", "Comma-separated agents, 'all', or 'core'")
  .option("--upgrade-skills", "Replace installed bundled skills while preserving project customization")
  .option("--dry-run", "Show what would be done without making changes")
  .option("--yes", "Skip confirmation prompts")
  .option("--with-graphify", "Enable Graphify integration (advisory mode)")
  .option("--graphify-mode <mode>", "Graphify mode: off, advisory, or required")
  .action(async (opts) => {
    try {
      const agents = await selectAgentTargets(opts.agents);
      const result = initCommand(process.cwd(), opts.dir, {
        upgradeSkills: opts.upgradeSkills,
        agents,
        dryRun: opts.dryRun,
        withGraphify: opts.withGraphify,
        graphifyMode: opts.graphifyMode,
      });
      // Dry-run output is printed by initCommand, so we skip normal output
      if (opts.dryRun) return;
      console.log(`✓ Codewright initialized at ${result.codewrightDir}`);
      console.log(`  Output: ${result.outputDir}`);
      console.log("  Skills: .agents/skills/ (universal core)");
      const labels = result.agentTargets.map((target) => getAgentDefinition(target).label);
      console.log(`  Agents: ${labels.length > 0 ? labels.join(", ") : "core only"}`);
      if (result.adapterFiles.length > 0) console.log(`  Adapters: ${result.adapterFiles.length} files generated`);
      for (const warning of result.warnings) console.warn(`  Warning: ${warning}`);
      if (result.graphifyEnabled) console.log(`  Graphify: ${result.graphifyMode} mode`);
      const d = result.detected;
      if (d.framework) console.log(`  Framework: ${d.framework}`);
      if (d.test_runner) console.log(`  Test runner: ${d.test_runner}`);
      if (d.project_language) console.log(`  Language: ${d.project_language}`);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
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
  .option("--yes", "Confirm snapshot commits in non-interactive use")
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
      if (!opts.yes) {
        console.log("Snapshot would create a Git commit. Rerun with --snapshot --yes to confirm.");
        return;
      }
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

// ─── commit ─────────────────────────────────────────────
program
  .command("commit")
  .description("Preview or create a story-scoped commit")
  .argument("<spec>", "Spec slug")
  .argument("<id>", "Story ID")
  .option("--branch <name>", "Custom branch name")
  .option("--amend", "Amend to last commit instead of new commit")
  .option("--push", "Push the branch to origin after committing")
  .option("--yes", "Confirm the local commit in non-interactive use")
  .option("--dry-run", "Show the branch and files without committing")
  .action((spec: string, id: string, opts) => {
    const previewOnly = opts.dryRun || !opts.yes;
    const result = commitCommand(process.cwd(), spec, id, {
      branch: opts.branch,
      amend: opts.amend,
      push: opts.push,
      dryRun: previewOnly,
    });
    if (previewOnly && result.filesChanged > 0) {
      console.log(`Commit preview for ${result.branch}:`);
      for (const file of result.plannedFiles) console.log(`  - ${file}`);
      if (!opts.dryRun) console.log("Rerun with --yes to create the local commit; add --push to push it.");
      return;
    }
    if (result.commitHash) {
      console.log(`✓ Story committed to branch ${result.branch}`);
      console.log(`  Commit: ${result.commitHash}`);
      console.log(`  Files changed: ${result.filesChanged}`);
      if (result.pushed) {
        console.log(`  Pushed to origin/${result.branch}`);
      } else {
        console.log(`  ⚠ Branch not pushed (no remote configured or push failed)`);
      }
      if (result.storyUpdated) console.log(`  Story status updated to "done"`);
    } else {
      console.log(`⚠ No changes to commit for story ${id}`);
    }
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
  .argument("[action]", "Action: install, uninstall, or list", "list")
  .action((action: string) => {
    if (action === "install") {
      const result = hookInstallCommand(process.cwd());
      console.log(result);
    } else if (action === "uninstall") {
      console.log(hookUninstallCommand(process.cwd()));
    } else {
      const result = hookListCommand(process.cwd());
      console.log(result);
    }
  });

// ─── ci ─────────────────────────────────────────────────
program
  .command("ci")
  .description("Generate CI workflow for the project")
  .option("--force", "Replace an existing generated workflow after review")
  .action((opts) => {
    const result = ciGenerateCommand(process.cwd(), { force: opts.force });
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
const perfCmd = program.command("perf").description("Performance testing with k6 or Artillery");

perfCmd
  .command("init")
  .description("Initialize performance testing configuration")
  .action(() => {
    const result = perfInitCommand(process.cwd());
    console.log(result);
  });

perfCmd
  .command("validate")
  .description("Validate performance testing configuration")
  .action(async () => {
    const result = await perfValidateCommand(process.cwd());
    console.log(result);
  });

perfCmd
  .command("run")
  .description("Run performance test scenario")
  .argument("<scenario>", "Scenario: smoke, load, or stress")
  .option("--environment <env>", "Override environment (dev, staging, production)")
  .option("--dry-run", "Show what would be executed without running")
  .action(async (scenario: string, opts) => {
    const result = await perfRunCommand(process.cwd(), scenario, {
      environment: opts.environment,
      dryRun: opts.dryRun,
    });
    // If result is a string (error/dry-run), print it directly
    if (typeof result === "string") {
      console.log(result);
    } else {
      // ProcessResult from runProcess
      console.log(result.stdout);
      if (result.stderr) console.error(result.stderr);
      if (result.failed) {
        process.exitCode = result.exitCode || 1;
      }
    }
  });

perfCmd
  .command("report")
  .description("Generate performance test report")
  .option("--format <format>", "Output format: json or html", "json")
  .option("--output <path>", "Output file path")
  .action((opts) => {
    const result = perfReportCommand(process.cwd(), {
      format: opts.format,
      output: opts.output,
    });
    console.log(result);
  });

perfCmd
  .command("cleanup")
  .description("Clean up performance test results")
  .action(() => {
    const result = perfCleanupCommand(process.cwd());
    console.log(result);
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

// ─── doctor ─────────────────────────────────────────────
program
  .command("doctor")
  .description("Validate project health and installation state")
  .option("--json", "Output result as JSON")
  .option("--fix", "Automatically fix fixable issues")
  .option("--dry-run", "Show what would be fixed without making changes")
  .action(async (opts) => {
    try {
      const { doctorCommand, doctorCommandFormatted, applyFixes } = await import("./commands/doctor.js");

      if (opts.json) {
        const result = doctorCommand(process.cwd());
        console.log(JSON.stringify(result, null, 2));
      } else if (opts.fix) {
        const initialResult = doctorCommand(process.cwd());
        await applyFixes(initialResult, process.cwd(), opts.dryRun);
        console.log(doctorCommandFormatted(process.cwd()));
      } else {
        console.log(doctorCommandFormatted(process.cwd()));
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });

// ─── agents ─────────────────────────────────────────────
const agentsCmd = program.command("agents").description("Manage agent adapters");

agentsCmd
  .command("list")
  .description("List installed agents")
  .action(() => {
    const result = agentsListFormatted(process.cwd());
    console.log(result);
  });

agentsCmd
  .command("add")
  .description("Add agent adapters")
  .argument("<targets>", "Comma-separated agent names")
  .action((targets: string) => {
    const agentTargets = parseAgentTargets(targets);
    const result = agentsAddFormatted(process.cwd(), agentTargets);
    console.log(result);
  });

agentsCmd
  .command("remove")
  .description("Remove agent adapters")
  .argument("<targets>", "Comma-separated agent names")
  .action((targets: string) => {
    const agentTargets = parseAgentTargets(targets);
    const result = agentsRemoveFormatted(process.cwd(), agentTargets);
    console.log(result);
  });

agentsCmd
  .command("set")
  .description("Set exactly these agents (replaces current selection)")
  .argument("<targets>", "Comma-separated agent names, 'all', or 'core'")
  .action((targets: string) => {
    const agentTargets = parseAgentTargets(targets);
    const result = agentsSetFormatted(process.cwd(), agentTargets);
    console.log(result);
  });

agentsCmd
  .command("repair")
  .description("Reinstall adapters for all selected agents")
  .action(() => {
    const result = agentsRepairFormatted(process.cwd());
    console.log(result);
  });

agentsCmd
  .command("doctor")
  .description("Validate agent installation state")
  .action(() => {
    const result = agentsDoctorFormatted(process.cwd());
    console.log(result);
  });

// ─── graph ─────────────────────────────────────────────
const graphCmd = program.command("graph").description("Graphify integration commands");

graphCmd
  .command("status")
  .description("Check Graphify status")
  .action(async () => {
    const result = await graphStatusCommand(process.cwd());
    console.log(result.output);
    if (!result.success) process.exitCode = 1;
  });

graphCmd
  .command("update")
  .description("Update the code graph")
  .action(async () => {
    const result = await graphUpdateCommand(process.cwd());
    console.log(result.output);
    if (!result.success) process.exitCode = 1;
  });

graphCmd
  .command("query")
  .description("Query the code graph")
  .argument("<question>", "Architectural question to ask")
  .option("--budget <n>", "Token budget", "4000")
  .action(async (question: string, opts) => {
    const result = await graphQueryCommand(process.cwd(), question, parseInt(opts.budget));
    console.log(result.output);
    if (!result.success) process.exitCode = 1;
  });

graphCmd
  .command("explain")
  .description("Explain a symbol")
  .argument("<symbol>", "Symbol to explain")
  .action(async (symbol: string) => {
    const result = await graphExplainCommand(process.cwd(), symbol);
    console.log(result.output);
    if (!result.success) process.exitCode = 1;
  });

graphCmd
  .command("affected")
  .description("Impact analysis for a symbol")
  .argument("<symbol>", "Symbol to analyze")
  .option("--depth <n>", "Depth of analysis", "3")
  .action(async (symbol: string, opts) => {
    const result = await graphAffectedCommand(process.cwd(), symbol, parseInt(opts.depth));
    console.log(result.output);
    if (!result.success) process.exitCode = 1;
  });

graphCmd
  .command("path")
  .description("Find call path between symbols")
  .argument("<from>", "Source symbol")
  .argument("<to>", "Target symbol")
  .action(async (from: string, to: string) => {
    const result = await graphPathCommand(process.cwd(), from, to);
    console.log(result.output);
    if (!result.success) process.exitCode = 1;
  });

await program.parseAsync(process.argv);
