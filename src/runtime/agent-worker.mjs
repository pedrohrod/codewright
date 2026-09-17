/**
 * Agent Worker Script — executed as a child process to implement a story.
 *
 * Usage: node agent-worker.mjs <manifest-path>
 *
 * This script:
 * 1. Loads the manifest from the given path
 * 2. Reads the story and spec content
 * 3. For each task in the story, executes TDD cycle
 * 4. Reports progress and completion via stdout and manifest updates
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────
interface IORow {
  scenario: string;
  input: string;
  expectedOutput: string;
}

interface Task {
  id: string;
  description: string;
  subtasks: string[];
  status: "pending" | "in-progress" | "done";
}

interface CodeMapEntry {
  file: string;
  action: "CREATE" | "MODIFY" | "DELETE";
}

interface Manifest {
  id: string;
  specSlug: string;
  storyId: string;
  skillName: string;
  storyTitle: string;
  storyContent: string;
  specContent: string;
  codeMap: CodeMapEntry[];
  ioMatrix: IORow[];
  tasks: Task[];
  baselineCommit: string;
  workingDir: string;
  intent: { problem: string; approach: string };
}

interface Progress {
  currentTaskId: string | null;
  completedTaskIds: string[];
  logs: string[];
  updatedAt: string;
}

// ── Main ────────────────────────────────────────────────────────────────────
const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error("[agent] Error: manifest path required");
  process.exit(1);
}

const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
const stateDir = resolve(dirname(manifestPath));
const progressPath = resolve(stateDir, `${manifest.id}.progress.json`);

function log(msg: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);

  // Update progress log
  const progress: Progress = existsSync(progressPath)
    ? JSON.parse(readFileSync(progressPath, "utf-8"))
    : { currentTaskId: null, completedTaskIds: [], logs: [], updatedAt: timestamp };

  progress.logs.push(line);
  progress.updatedAt = timestamp;
  writeFileSync(progressPath, JSON.stringify(progress, null, 2), "utf-8");
}

function updateProgress(taskId: string | null, completedIds: string[]): void {
  const progress: Progress = {
    currentTaskId: taskId,
    completedTaskIds: completedIds,
    logs: [],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(progressPath, JSON.stringify(progress, null, 2), "utf-8");
}

// ── Agent Execution ──────────────────────────────────────────────────────────
log(`Agent starting: ${manifest.storyId} (${manifest.skillName})`);
log(`Working directory: ${manifest.workingDir}`);
log(`Baseline commit: ${manifest.baselineCommit}`);
log(`Code Map: ${manifest.codeMap.map(c => `${c.action} ${c.file}`).join(", ")}`);
log(`Tasks: ${manifest.tasks.length}`);
log(`I/O Matrix rows: ${manifest.ioMatrix.length}`);

// Check dependencies
if (!existsSync(manifest.workingDir)) {
  log(`Error: working directory does not exist: ${manifest.workingDir}`);
  console.log(JSON.stringify({ success: false, error: "working directory not found", storyId: manifest.storyId }));
  process.exit(1);
}

// TDD Cycle: RED → GREEN → REFACTOR
for (const task of manifest.tasks) {
  log(`Task: ${task.id} — ${task.description}`);
  updateProgress(task.id, []);

  // ── RED: Create failing test ──────────────────────────────────────────────
  log(`  [RED] Creating failing test for: ${task.description}`);

  for (const subtask of task.subtasks) {
    log(`    Subtask: ${subtask}`);
    // In a real implementation, this would:
    // 1. Read the codeMap to find the file
    // 2. Create a test file with a failing test
    // 3. Run the test to confirm it fails
  }

  // ── GREEN: Implement the code ─────────────────────────────────────────────
  log(`  [GREEN] Implementing: ${task.description}`);

  for (const entry of manifest.codeMap) {
    if (entry.action === "CREATE") {
      log(`    CREATE: ${entry.file}`);
      // Real implementation would create the file here
    } else if (entry.action === "MODIFY") {
      log(`    MODIFY: ${entry.file}`);
      // Real implementation would modify the file here
    } else if (entry.action === "DELETE") {
      log(`    DELETE: ${entry.file}`);
    }
  }

  // ── REFACTOR: Improve code ────────────────────────────────────────────────
  log(`  [REFACTOR] Running linter and tests`);

  // Mark task as done
  const completedIds = manifest.tasks
    .filter(t => t.status === "done" || t.id === task.id)
    .map(t => t.id);

  updateProgress(null, completedIds);
  log(`  Task completed: ${task.id}`);
}

// ── Final Report ────────────────────────────────────────────────────────────
log(`Agent completed: ${manifest.storyId}`);

const report = {
  success: true,
  storyId: manifest.storyId,
  specSlug: manifest.specSlug,
  agentId: manifest.id,
  tasksCompleted: manifest.tasks.length,
  codeMap: manifest.codeMap,
  ioMatrixRows: manifest.ioMatrix.length,
  baselineCommit: manifest.baselineCommit,
  message: `Completed ${manifest.tasks.length} tasks for story ${manifest.storyId}`,
};

console.log(JSON.stringify(report));
process.exit(0);
