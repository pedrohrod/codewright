/**
 * develop.ts — Orchestrate multiple stories for a spec with parallel subagents.
 *
 * codewright develop <spec> [--parallel] [--sequential] [--max N] [storyIds...]
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { storyListCommand } from "./story.js";
import { AgentPool, type PoolConfig } from "../../runtime/agent-pool.js";
import {
  type DevelopOptions,
  type DevelopResult,
  type AgentResult,
  createExecutionReport,
} from "../../runtime/agent-types.js";
import {
  type StoryAgentManifest,
  generateManifestId,
} from "../../agents/manifest.js";

function parseIOFromStory(content: string): Array<{ scenario: string; input: string; expectedOutput: string }> {
  const rows: Array<{ scenario: string; input: string; expectedOutput: string }> = [];
  const tableMatch = content.match(/## I\/O & Edge-Case Matrix\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!tableMatch) return rows;

  const tableContent = tableMatch[1];
  // Parse markdown table rows: | # | Scenario | Input | Expected Output |
  const lines = tableContent.split("\n").filter(l => l.trim() && !l.match(/^\|[-\s]+\|[-\s]+\|[-\s]+\|$/));
  for (const line of lines) {
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 4 && cells[0] && !isNaN(Number(cells[0]))) {
      rows.push({
        scenario: cells[1] || "",
        input: cells[2] || "",
        expectedOutput: cells[3] || "",
      });
    }
  }
  return rows;
}

function parseTasksFromStory(content: string): Array<{ id: string; description: string; subtasks: string[]; status: "pending" | "in-progress" | "done" }> {
  const tasks: Array<{ id: string; description: string; subtasks: string[]; status: "pending" | "in-progress" | "done" }> = [];
  const taskMatch = content.match(/## Tasks\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!taskMatch) return tasks;

  const taskContent = taskMatch[1];
  const lines = taskContent.split("\n");
  let currentTask: { id: string; description: string; subtasks: string[]; status: "pending" | "in-progress" | "done" } | null = null;

  for (const line of lines) {
    const mainMatch = line.match(/^-\s*\[([ x])\]\s*(.+)/);
    if (mainMatch) {
      if (currentTask) tasks.push(currentTask);
      const checked = mainMatch[1] === "x";
      currentTask = {
        id: `task-${tasks.length + 1}`,
        description: mainMatch[2].trim(),
        subtasks: [],
        status: checked ? "done" : "pending",
      };
    } else if (line.match(/^\s+-\s+\[([ x])\]\s*(.+)/) && currentTask) {
      currentTask.subtasks.push(line.trim());
    }
  }
  if (currentTask) tasks.push(currentTask);

  return tasks;
}

function parseCodeMap(content: string): Array<{ file: string; action: "CREATE" | "MODIFY" | "DELETE" }> {
  const entries: Array<{ file: string; action: "CREATE" | "MODIFY" | "DELETE" }> = [];
  const codeMapMatch = content.match(/## Code Map\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!codeMapMatch) return entries;

  const codeMapContent = codeMapMatch[1];
  for (const line of codeMapContent.split("\n")) {
    const match = line.match(/^\s*-\s+(.+?)\s+\((CREATE|MODIFY|DELETE)\)\s*$/);
    if (match) {
      entries.push({ file: match[1].trim(), action: match[2] as "CREATE" | "MODIFY" | "DELETE" });
    }
  }
  return entries;
}

function parseIntentFromStory(content: string): { problem: string; approach: string } {
  const problemMatch = content.match(/Problem:\s*(.+)/);
  const approachMatch = content.match(/Approach:\s*(.+)/);
  return {
    problem: problemMatch?.[1]?.trim() || "",
    approach: approachMatch?.[1]?.trim() || "",
  };
}

function parseBoundaries(content: string): { always: string[]; askFirst: string[]; never: string[] } {
  const always: string[] = [];
  const askFirst: string[] = [];
  const never: string[] = [];

  const boundariesMatch = content.match(/## Boundaries & Constraints\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!boundariesMatch) return { always, askFirst, never };

  for (const line of boundariesMatch[1].split("\n")) {
    if (line.includes("Always:")) {
      const m = line.match(/Always:\s*(.+)/);
      if (m) always.push(m[1].trim());
    } else if (line.includes("Ask First:")) {
      const m = line.match(/Ask First:\s*(.+)/);
      if (m) askFirst.push(m[1].trim());
    } else if (line.includes("Never:")) {
      const m = line.match(/Never:\s*(.+)/);
      if (m) never.push(m[1].trim());
    }
  }
  return { always, askFirst, never };
}

function buildManifest(
  cwd: string,
  config: ReturnType<typeof loadConfig>,
  story: { id: string; title: string; file: string },
  specSlug: string,
): StoryAgentManifest {
  const specDir = resolveSpecDir(cwd, config, specSlug);
  const storyPath = resolve(specDir, "stories", story.file);
  const specPath = resolve(specDir, "SPEC.md");
  const storyContent = readFileSync(storyPath, "utf-8");
  const specContent = existsSync(specPath) ? readFileSync(specPath, "utf-8") : "";

  const titleMatch = storyContent.match(/^#\s+(.+)/m);
  const phaseMatch = storyContent.match(/^phase:\s*(.+)/m);
  const baselineMatch = storyContent.match(/^baseline_commit:\s*(.+)/m);

  return {
    id: generateManifestId(specSlug, story.id),
    specSlug,
    storyId: story.id,
    skillName: "codewright-dev",
    storyTitle: titleMatch?.[1]?.trim() || story.title,
    storyContent,
    specContent,
    codeMap: parseCodeMap(storyContent),
    ioMatrix: parseIOFromStory(storyContent),
    tasks: parseTasksFromStory(storyContent),
    intent: parseIntentFromStory(storyContent),
    boundaries: parseBoundaries(storyContent),
    phase: phaseMatch?.[1]?.trim() || "1",
    baselineCommit: baselineMatch?.[1]?.trim() || "none",
    workingDir: cwd,
    agentConfig: {
      skillName: "codewright-dev",
      spawnOnCreate: false,
    },
    createdAt: new Date().toISOString(),
  };
}

export async function developCommand(cwd: string, spec: string, options: DevelopOptions = {}): Promise<DevelopResult> {
  const config = loadConfig(cwd);
  const startTime = new Date();

  // 1. List all stories for the spec
  const allStories = storyListCommand(cwd, spec);

  if (allStories.length === 0) {
    return {
      report: createExecutionReport(startTime, []),
      message: `No stories found for spec '${spec}'`,
    };
  }

  // 2. Filter stories
  let targetStories = allStories.filter(s => s.status === "pending" || s.status === "ready");
  if (options.storyIds && options.storyIds.length > 0) {
    targetStories = targetStories.filter(s => options.storyIds!.includes(s.id));
  }

  if (targetStories.length === 0) {
    return {
      report: createExecutionReport(startTime, []),
      message: `No ready stories to develop for spec '${spec}'`,
    };
  }

  // 3. Build manifests
  const manifests = targetStories.map(story => buildManifest(cwd, config, story, spec));

  // 4. Execute agents
  const maxConcurrent = options.maxConcurrent ?? 4;
  const results: AgentResult[] = [];

  if (options.sequential) {
    // Sequential execution — one agent at a time, stop on failure
    for (const manifest of manifests) {
      const result = runAgentSync(cwd, manifest);
      results.push(result);
      if (!result.success) {
        break;
      }
    }
  } else {
    // Parallel execution via AgentPool
    const poolConfig: PoolConfig = {
      maxConcurrent,
      onAgentStart: (id, storyId) => {
        console.log(`[agent] Starting: ${storyId}`);
      },
      onAgentComplete: (result) => {
        const emoji = result.success ? "✓" : "✗";
        console.log(`[agent] ${emoji} ${result.storyId} — ${result.durationMs}ms`);
      },
      onAgentError: (id, storyId, error) => {
        console.error(`[agent] ✗ ${storyId}: ${error}`);
      },
    };

    const pool = new AgentPool(cwd, poolConfig);
    results.push(...await pool.submitAll(manifests));
  }

  const report = createExecutionReport(startTime, results);
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  let message = "";
  if (failCount === 0) {
    message = `✓ Completed ${successCount} story(ies) for spec '${spec}'`;
  } else {
    message = `⚠ ${successCount}/${targetStories.length} stories completed. ${failCount} failed.`;
  }

  return { report, message };
}

/**
 * Synchronous agent execution for sequential mode.
 */
function runAgentSync(cwd: string, manifest: StoryAgentManifest): AgentResult {
  const startTime = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execSync } = require("node:child_process") as typeof import("node:child_process");
  const workerPath = resolve(import.meta.dirname ?? ".", "../../runtime/agent-worker.mjs");
  const manifestDir = resolve(cwd, ".codewright-output/agent-state");
  if (!existsSync(manifestDir)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("node:fs").mkdirSync(manifestDir, { recursive: true });
  }
  const manifestPath = resolve(manifestDir, `${manifest.id}.json`);
  require("node:fs").writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

  try {
    const output = execSync(`node "${workerPath}" "${manifestPath}"`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return {
      id: manifest.id,
      storyId: manifest.storyId,
      specSlug: manifest.specSlug,
      exitCode: 0,
      stdout: output,
      stderr: "",
      success: true,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      durationMs: new Date().getTime() - new Date(startTime).getTime(),
    };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer; message?: string };
    return {
      id: manifest.id,
      storyId: manifest.storyId,
      specSlug: manifest.specSlug,
      exitCode: e.status ?? 1,
      stdout: e.stdout?.toString() ?? "",
      stderr: e.stderr?.toString() ?? e.message ?? "",
      success: false,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      durationMs: new Date().getTime() - new Date(startTime).getTime(),
    };
  }
}
