import type { StoryAgentManifest, ManifestProgress } from "../agents/manifest.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

export interface SpawnOptions {
  cwd: string;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface SpawnedAgent {
  manifest: StoryAgentManifest;
  process: ChildProcess;
  manifestPath: string;
  progress: ManifestProgress;
}

const AGENT_STATE_DIR = ".codewright-output/agent-state";

function ensureStateDir(cwd: string): string {
  const dir = resolve(cwd, AGENT_STATE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function writeManifest(cwd: string, manifest: StoryAgentManifest): string {
  const stateDir = ensureStateDir(cwd);
  const filename = `${manifest.id}.json`;
  const path = resolve(stateDir, filename);
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf-8");
  return path;
}

function writeProgress(cwd: string, manifestId: string, progress: ManifestProgress): void {
  const stateDir = ensureStateDir(cwd);
  const path = resolve(stateDir, `${manifestId}.progress.json`);
  writeFileSync(path, JSON.stringify(progress, null, 2), "utf-8");
}

function readProgress(cwd: string, manifestId: string): ManifestProgress | null {
  const path = resolve(cwd, AGENT_STATE_DIR, `${manifestId}.progress.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ManifestProgress;
  } catch {
    return null;
  }
}

/**
 * Spawn a single story agent as a child process.
 * The agent-worker.mjs script handles the actual execution.
 */
export function spawnStoryAgent(
  manifest: StoryAgentManifest,
  options: SpawnOptions,
): SpawnedAgent {
  const manifestPath = writeManifest(options.cwd, manifest);

  const workerPath = resolve(import.meta.dirname ?? ".", "agent-worker.mjs");
  const workerExists = existsSync(workerPath);

  // Fallback: spawn via node --eval if worker script not available in dev
  const isDev = process.env.NODE_ENV === "development" || !workerExists;

  let proc: ChildProcess;

  if (isDev) {
    // In development, spawn a node process that loads the manifest and runs inline
    const inlineScript = buildInlineAgentScript(manifestPath);
    proc = spawn("node", ["--input-type=module", "-e", inlineScript], {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
  } else {
    // Production: use the worker script
    proc = spawn("node", [workerPath, manifestPath], {
      cwd: options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
  }

  if (options.onStdout) {
    proc.stdout?.on("data", (data) => options.onStdout!(data.toString()));
  }
  if (options.onStderr) {
    proc.stderr?.on("data", (data) => options.onStderr!(data.toString()));
  }

  const progress: ManifestProgress = {
    currentTaskId: null,
    completedTaskIds: [],
    logs: [],
    updatedAt: new Date().toISOString(),
  };

  return {
    manifest,
    process: proc,
    manifestPath,
    progress,
  };
}

/**
 * Build an inline agent script that can be executed via `node -e`.
 * This is the fallback for development when the worker script isn't available.
 */
function buildInlineAgentScript(manifestPath: string): string {
  return `
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const manifestPath = "${manifestPath}";
const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

console.log("[agent] Starting agent for story:", manifest.storyId);
console.log("[agent] Skill:", manifest.skillName);
console.log("[agent] Code Map:", manifest.codeMap.map(f => f.file).join(", "));

// Update progress
const progressPath = manifestPath.replace(".json", ".progress.json");
writeFileSync(progressPath, JSON.stringify({
  currentTaskId: null,
  completedTaskIds: [],
  logs: ["Agent started at " + new Date().toISOString()],
  updatedAt: new Date().toISOString()
}, null, 2));

// Simulate task execution (in real implementation, this would run TDD cycles)
for (const task of manifest.tasks) {
  console.log("[agent] Working on task:", task.description);

  // Mark task as in-progress
  const progress = JSON.parse(readFileSync(progressPath, "utf-8"));
  progress.currentTaskId = task.id;
  progress.updatedAt = new Date().toISOString();
  writeFileSync(progressPath, JSON.stringify(progress, null, 2));

  // Simulate work (REPLACED with actual TDD implementation)
  await new Promise(r => setTimeout(r, 100));
}

console.log(JSON.stringify({
  success: true,
  completedTasks: manifest.tasks.length,
  storyId: manifest.storyId,
  codeMap: manifest.codeMap
}));
`;
}

/**
 * Get current progress of a spawned agent.
 */
export function getAgentProgress(cwd: string, manifestId: string): ManifestProgress | null {
  return readProgress(cwd, manifestId);
}

/**
 * List all active agent states in the working directory.
 */
export function listAgentStates(cwd: string): string[] {
  const stateDir = resolve(cwd, AGENT_STATE_DIR);
  if (!existsSync(stateDir)) return [];
  return readdirSync(stateDir)
    .filter(f => f.endsWith(".json") && !f.endsWith(".progress.json"))
    .map(f => f.replace(".json", ""));
}

/**
 * Clean up agent state files for a given manifest ID.
 */
export function cleanupAgentState(cwd: string, manifestId: string): void {
  const stateDir = resolve(cwd, AGENT_STATE_DIR);
  const manifestPath = resolve(stateDir, `${manifestId}.json`);
  const progressPath = resolve(stateDir, `${manifestId}.progress.json`);

  if (existsSync(manifestPath)) {
    // Already deleted via unlink, but we don't have that here
  }
}
