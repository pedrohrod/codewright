import { resolve } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { loadConfig, resolveSpecDir } from "../../config/loader.js";
import { writeArtifact } from "../../artifacts/writer.js";
import { storyTemplate } from "../../templates/story-template.js";
import { AgentPool } from "../../runtime/agent-pool.js";
import type { PoolConfig } from "../../runtime/agent-pool.js";
import type { DevelopOptions } from "../../runtime/agent-types.js";
import type { StoryAgentManifest } from "../../agents/manifest.js";

export interface StoryCreateOptions {
  cwd: string;
  spec: string;
  id: string;
  title: string;
  phase?: string;
}

export function storyCreateCommand(opts: StoryCreateOptions) {
  const config = loadConfig(opts.cwd);

  const storyId = opts.id;
  const filename = `${storyId}-${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.md`;

  const content = storyTemplate({
    story_id: storyId,
    story_title: opts.title,
    phase: opts.phase || "1",
    spec_name: opts.spec,
  });

  const path = writeArtifact({
    cwd: opts.cwd,
    outputFolder: config.output_folder,
    subpath: `specs/spec-${opts.spec}/stories`,
    filename,
    content,
  });

  return { path, filename };
}

export function storyListCommand(cwd: string, spec: string) {
  const config = loadConfig(cwd);
  const specDir = resolveSpecDir(cwd, config, spec);
  const storiesDir = resolve(specDir, "stories");

  if (!existsSync(storiesDir)) return [];

  const stories: Array<{ id: string; title: string; status: string; file: string }> = [];
  for (const file of readdirSync(storiesDir).filter((f: string) => f.endsWith(".md"))) {
    const content = readFileSync(resolve(storiesDir, file), "utf-8");
    const idMatch = content.match(/^id:\s*(.+)/m);
    const statusMatch = content.match(/^status:\s*(\S+)/m);
    const titleMatch = content.match(/^#\s+(.+)/m);
    stories.push({
      id: idMatch?.[1] || "unknown",
      title: titleMatch?.[1] || file,
      status: statusMatch?.[1]?.trim() || "unknown",
      file,
    });
  }

  return stories;
}

// ── Parallel Spawn ─────────────────────────────────────────────────────────

function parseIOFromStory(content: string): Array<{ scenario: string; input: string; expectedOutput: string }> {
  const rows: Array<{ scenario: string; input: string; expectedOutput: string }> = [];
  const tableMatch = content.match(/## I\/O & Edge-Case Matrix\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!tableMatch) return rows;
  const lines = tableMatch[1].split("\n").filter(l => l.trim() && !l.match(/^\|[-\s]+\|[-\s]+\|[-\s]+\|$/));
  for (const line of lines) {
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length >= 4 && cells[0] && !isNaN(Number(cells[0]))) {
      rows.push({ scenario: cells[1] || "", input: cells[2] || "", expectedOutput: cells[3] || "" });
    }
  }
  return rows;
}

function parseTasksFromStory(content: string): Array<{ id: string; description: string; subtasks: string[]; status: "pending" | "in-progress" | "done" }> {
  const tasks: Array<{ id: string; description: string; subtasks: string[]; status: "pending" | "in-progress" | "done" }> = [];
  const taskMatch = content.match(/## Tasks\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!taskMatch) return tasks;
  const lines = taskMatch[1].split("\n");
  let current: { id: string; description: string; subtasks: string[]; status: "pending" | "in-progress" | "done" } | null = null;
  for (const line of lines) {
    const mainMatch = line.match(/^-\s*\[([ x])\]\s*(.+)/);
    if (mainMatch) {
      if (current) tasks.push(current);
      current = { id: `task-${tasks.length + 1}`, description: mainMatch[2].trim(), subtasks: [], status: mainMatch[1] === "x" ? "done" : "pending" };
    } else if (line.match(/^\s+-\s+/) && current) {
      current.subtasks.push(line.trim());
    }
  }
  if (current) tasks.push(current);
  return tasks;
}

function parseCodeMap(content: string): Array<{ file: string; action: "CREATE" | "MODIFY" | "DELETE" }> {
  const entries: Array<{ file: string; action: "CREATE" | "MODIFY" | "DELETE" }> = [];
  const codeMapMatch = content.match(/## Code Map\s*\n([\s\S]*?)(?=\n## |\s*$)/);
  if (!codeMapMatch) return entries;
  for (const line of codeMapMatch[1].split("\n")) {
    const match = line.match(/^\s*-\s+(.+?)\s+\((CREATE|MODIFY|DELETE)\)\s*$/);
    if (match) entries.push({ file: match[1].trim(), action: match[2] as "CREATE" | "MODIFY" | "DELETE" });
  }
  return entries;
}

function buildStoryManifest(
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
  const problemMatch = storyContent.match(/Problem:\s*(.+)/);
  const approachMatch = storyContent.match(/Approach:\s*(.+)/);
  return {
    id: `agent-${specSlug}-${story.id}-${Date.now()}`,
    specSlug,
    storyId: story.id,
    skillName: "codewright-dev",
    storyTitle: titleMatch?.[1]?.trim() || story.title,
    storyContent,
    specContent,
    codeMap: parseCodeMap(storyContent),
    ioMatrix: parseIOFromStory(storyContent),
    tasks: parseTasksFromStory(storyContent),
    intent: { problem: problemMatch?.[1]?.trim() || "", approach: approachMatch?.[1]?.trim() || "" },
    boundaries: { always: [], askFirst: [], never: [] },
    phase: phaseMatch?.[1]?.trim() || "1",
    baselineCommit: baselineMatch?.[1]?.trim() || "none",
    workingDir: cwd,
    agentConfig: { skillName: "codewright-dev", spawnOnCreate: false },
    createdAt: new Date().toISOString(),
  };
}

export interface StorySpawnOptions {
  cwd: string;
  spec: string;
  storyIds?: string[];
  parallel?: boolean;
  maxConcurrent?: number;
}

export interface SpawnResult {
  total: number;
  spawned: number;
  failed: number;
  message: string;
}

export async function storySpawnCommand(opts: StorySpawnOptions): Promise<SpawnResult> {
  const config = loadConfig(opts.cwd);
  const allStories = storyListCommand(opts.cwd, opts.spec);

  let targetStories = allStories.filter(s => s.status === "pending" || s.status === "ready");
  if (opts.storyIds && opts.storyIds.length > 0) {
    targetStories = targetStories.filter(s => opts.storyIds!.includes(s.id));
  }

  if (targetStories.length === 0) {
    return { total: 0, spawned: 0, failed: 0, message: "No ready stories to spawn" };
  }

  const manifests = targetStories.map(s => buildStoryManifest(opts.cwd, config, s, opts.spec));
  const maxConcurrent = opts.maxConcurrent ?? Math.min(targetStories.length, 4);

  console.log(`Spawning ${manifests.length} agent(s) for spec '${opts.spec}' (max ${maxConcurrent} concurrent)...`);

  const poolConfig: PoolConfig = {
    maxConcurrent,
    onAgentStart: (id, storyId) => console.log(`  [start] ${storyId}`),
    onAgentComplete: (result) => console.log(`  [${result.success ? "ok" : "fail"}] ${result.storyId} — ${result.durationMs}ms`),
    onAgentError: (id, storyId, error) => console.error(`  [error] ${storyId}: ${error}`),
  };

  const pool = new AgentPool(opts.cwd, poolConfig);
  const results = await pool.submitAll(manifests);

  const spawned = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    total: manifests.length,
    spawned,
    failed,
    message: failed === 0
      ? `Spawned ${spawned} agent(s) for spec '${opts.spec}'`
      : `Spawned ${spawned}/${manifests.length} agent(s). ${failed} failed.`,
  };
}
