/**
 * Agent Manifest — describes a concrete agent instance that will implement a story.
 * This is the bridge between codewright's SDD artifacts (specs, stories) and
 * the agent runtime that executes the implementation.
 */

export interface IORow {
  scenario: string;
  input: string;
  expectedOutput: string;
}

export interface Task {
  id: string;
  description: string;
  subtasks: string[];
  status: "pending" | "in-progress" | "done";
}

export interface Boundaries {
  always: string[];
  askFirst: string[];
  never: string[];
}

export interface AgentConfig {
  skillName: string;
  spawnOnCreate?: boolean;
  maxConcurrent?: number;
}

export interface StoryAgentManifest {
  id: string;
  specSlug: string;
  storyId: string;
  skillName: string;
  storyTitle: string;
  storyContent: string;
  specContent: string;
  codeMap: Array<{ file: string; action: "CREATE" | "MODIFY" | "DELETE" }>;
  ioMatrix: IORow[];
  tasks: Task[];
  boundaries: Boundaries;
  intent: {
    problem: string;
    approach: string;
  };
  phase: string;
  baselineCommit: string;
  workingDir: string;
  agentConfig: AgentConfig;
  createdAt: string;
}

export interface ManifestProgress {
  currentTaskId: string | null;
  completedTaskIds: string[];
  logs: string[];
  updatedAt: string;
}

export function generateManifestId(specSlug: string, storyId: string): string {
  return `agent-${specSlug}-${storyId}-${Date.now()}`;
}

export function manifestToJson(manifest: StoryAgentManifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function manifestFromJson(json: string): StoryAgentManifest {
  return JSON.parse(json) as StoryAgentManifest;
}
