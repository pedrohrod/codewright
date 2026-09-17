/**
 * Types for the agent runtime — spawn results, execution reports, and parallelism control.
 */

export interface AgentResult {
  id: string;
  storyId: string;
  specSlug: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  success: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ParallelExecutionPlan {
  groups: AgentGroup[];
  totalStories: number;
  estimatedParallelism: number;
}

export interface AgentGroup {
  name: string;
  stories: string[];
  dependencies: string[];
}

export interface ExecutionReport {
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  totalStories: number;
  successfulStories: number;
  failedStories: number;
  skippedStories: number;
  results: AgentResult[];
  errors: string[];
}

export interface GroupReport {
  name: string;
  startTime: string;
  endTime: string;
  results: AgentResult[];
  success: boolean;
}

export interface DevelopOptions {
  cwd?: string;
  storyIds?: string[];
  parallel?: boolean;
  maxConcurrent?: number;
  sequential?: boolean;
}

export interface DevelopResult {
  report: ExecutionReport;
  message: string;
}

export function createExecutionReport(startTime: Date, results: AgentResult[]): ExecutionReport {
  const endTime = new Date();
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const errors = results.filter(r => !r.success).map(r => `${r.storyId}: ${r.stderr || "unknown error"}`);

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalDurationMs: endTime.getTime() - startTime.getTime(),
    totalStories: results.length,
    successfulStories: successful,
    failedStories: failed,
    skippedStories: 0,
    results,
    errors,
  };
}
